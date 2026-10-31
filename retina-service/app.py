"""
HTTP wrapper around retina.py. Only the Node API server should call it.

Run:  RETINA_SERVICE_KEY=<secret> uvicorn app:app --host 127.0.0.1 --port 8001
"""
from __future__ import annotations

import base64
import hmac
import os

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile

import retina

MAX_BYTES = 5 * 1024 * 1024

app = FastAPI(title="Retina verification service", docs_url=None, redoc_url=None)


def _auth(key: str) -> None:
    expected = os.environ.get("RETINA_SERVICE_KEY", "")
    if len(expected) < 16:
        raise HTTPException(status_code=500, detail={"code": "misconfigured", "message": "RETINA_SERVICE_KEY is not set (16+ characters)."})
    if not hmac.compare_digest(key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": "Bad service key."})


def _read(file: UploadFile) -> bytes:
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail={"code": "too_big", "message": "Image is larger than 5 MB."})
    return data


def _b64(arr) -> str:
    return base64.b64encode(retina.encode_png(arr)).decode()


@app.get("/health")
def health():
    return {"status": "ok"}


# Plain `def` handlers run in a worker thread, so heavy image work does not block the server.
@app.post("/extract")
def extract(file: UploadFile = File(...), x_service_key: str = Header(default="")):
    _auth(x_service_key)
    try:
        result = retina.extract(_read(file))
    except retina.RetinaError as e:
        raise HTTPException(status_code=422, detail={"code": e.code, "message": e.message})
    return {
        "template_b64": _b64(result["template"]),
        "preview_b64": _b64(result["vessels"]),
        "quality": result["quality"],
    }


@app.post("/match")
def match(
    file: UploadFile = File(...),
    template_b64: str = Form(...),
    x_service_key: str = Header(default=""),
):
    _auth(x_service_key)
    try:
        stored = retina.decode_template(base64.b64decode(template_b64, validate=True))
    except (ValueError, retina.RetinaError):
        raise HTTPException(status_code=422, detail={"code": "bad_template", "message": "Stored template is damaged."})
    try:
        probe = retina.extract(_read(file))
    except retina.RetinaError as e:
        raise HTTPException(status_code=422, detail={"code": e.code, "message": e.message})
    return {"score": retina.similarity(stored, probe["template"]), "quality": probe["quality"]}
