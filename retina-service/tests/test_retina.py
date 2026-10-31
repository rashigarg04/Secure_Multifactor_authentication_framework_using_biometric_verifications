import base64
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from skimage import data as sd

import retina
from synth import recapture, synth_retina, to_jpeg

THRESHOLD = 0.50
KEY = "test-service-key-0123456789"


@pytest.fixture(scope="module")
def real():
    return cv2.cvtColor(sd.retina(), cv2.COLOR_RGB2BGR)


def tpl(img):
    return retina.extract(to_jpeg(img))["template"]


def test_extracts_template_and_quality_from_real_fundus(real):
    r = retina.extract(to_jpeg(real))
    assert r["template"].shape == (256, 256)
    assert 0.03 <= r["quality"]["vessel_density"] <= 0.30
    assert r["quality"]["redness"] > 1.5


def test_same_eye_recaptured_matches(real):
    t = tpl(real)
    scores = [retina.similarity(t, tpl(recapture(real, s))) for s in range(6)]
    assert min(scores) >= THRESHOLD, scores


def test_same_synthetic_eye_matches():
    eye = synth_retina(3)
    t = tpl(eye)
    scores = [retina.similarity(t, tpl(recapture(eye, s))) for s in range(8)]
    assert min(scores) >= THRESHOLD, scores


def test_different_eyes_do_not_match(real):
    eyes = [real] + [synth_retina(s) for s in range(1, 5)]
    for i, a in enumerate(eyes):
        for j, b in enumerate(eyes):
            if i != j:
                assert retina.similarity(tpl(a), tpl(recapture(b, 5))) < THRESHOLD, (i, j)


@pytest.mark.parametrize("name", ["astronaut", "coffee", "chelsea", "rocket"])
def test_ordinary_photos_are_rejected(name):
    img = cv2.cvtColor(getattr(sd, name)(), cv2.COLOR_RGB2BGR)
    with pytest.raises(retina.RetinaError):
        retina.extract(to_jpeg(img))


def test_noise_and_flat_images_are_rejected():
    rng = np.random.default_rng(0)
    for img in (rng.integers(0, 255, (600, 600, 3), dtype=np.uint8), np.full((600, 600, 3), 120, np.uint8)):
        with pytest.raises(retina.RetinaError):
            retina.extract(to_jpeg(img))


def test_blurry_retina_is_rejected(real):
    with pytest.raises(retina.RetinaError) as e:
        retina.extract(to_jpeg(cv2.GaussianBlur(real, (0, 0), 12)))
    assert e.value.code in {"blurry", "no_vessels"}


def test_bad_bytes_and_tiny_images_are_rejected():
    with pytest.raises(retina.RetinaError):
        retina.extract(b"not an image")
    with pytest.raises(retina.RetinaError):
        retina.extract(to_jpeg(np.zeros((100, 100, 3), np.uint8)))


# ----------------------------- HTTP API -----------------------------
@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("RETINA_SERVICE_KEY", KEY)
    import app as app_module
    return TestClient(app_module.app)


def test_api_requires_service_key(client, real):
    r = client.post("/extract", files={"file": ("a.jpg", to_jpeg(real), "image/jpeg")})
    assert r.status_code == 401
    r = client.post("/extract", headers={"x-service-key": "wrong-key-wrong-key"}, files={"file": ("a.jpg", to_jpeg(real), "image/jpeg")})
    assert r.status_code == 401


def test_api_extract_then_match(client, real):
    h = {"x-service-key": KEY}
    r = client.post("/extract", headers=h, files={"file": ("a.jpg", to_jpeg(real), "image/jpeg")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["template_b64"] and body["preview_b64"]

    ok = client.post("/match", headers=h, data={"template_b64": body["template_b64"]},
                     files={"file": ("b.jpg", to_jpeg(recapture(real, 4)), "image/jpeg")})
    assert ok.status_code == 200 and ok.json()["score"] >= THRESHOLD

    other = client.post("/match", headers=h, data={"template_b64": body["template_b64"]},
                        files={"file": ("c.jpg", to_jpeg(synth_retina(9)), "image/jpeg")})
    assert other.status_code == 200 and other.json()["score"] < THRESHOLD


def test_api_rejects_bad_image_and_bad_template(client, real):
    h = {"x-service-key": KEY}
    r = client.post("/extract", headers=h, files={"file": ("a.jpg", b"garbage", "image/jpeg")})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "bad_image"
    r = client.post("/match", headers=h, data={"template_b64": "AAAA"}, files={"file": ("a.jpg", to_jpeg(real), "image/jpeg")})
    assert r.status_code == 422


def test_api_rejects_oversized_upload(client):
    h = {"x-service-key": KEY}
    r = client.post("/extract", headers=h, files={"file": ("a.jpg", b"0" * (5 * 1024 * 1024 + 10), "image/jpeg")})
    assert r.status_code == 413
