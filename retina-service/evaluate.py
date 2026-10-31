"""
Measure how well the retina matcher separates the same eye from different eyes.

Demo mode (no arguments): 1 real fundus photograph + 7 synthetic retinas, each
re-captured with simulated rotation, shift, scale, lighting, noise and JPEG.

Real-data mode:   python evaluate.py --dir PATH/TO/DATASET
  Files must be named <subject>_<sample>.<ext>, e.g. 001_1.jpg, 001_2.jpg, 002_1.jpg.
  Genuine pairs = same subject. Impostor pairs = different subjects.
  Datasets with several images per eye: RIDB, VARIA. For single-image sets
  (DRIVE, STARE) use --augment to create genuine pairs by simulated re-capture.
"""
from __future__ import annotations

import argparse
import itertools
import pathlib

import cv2
import numpy as np

import retina
from synth import recapture, synth_retina


def score(enrol_img: np.ndarray, probe_img: np.ndarray) -> float | None:
    try:
        t = retina.extract(cv2.imencode(".png", enrol_img)[1].tobytes())["template"]
        p = retina.extract(cv2.imencode(".png", probe_img)[1].tobytes())["template"]
    except retina.RetinaError:
        return None
    return retina.similarity(t, p)


def metrics(gen: list[float], imp: list[float]) -> dict:
    gen, imp = np.array(gen), np.array(imp)
    rows, eer = [], (1.0, 0.0)
    for th in np.round(np.arange(0.05, 0.96, 0.01), 2):
        far, frr = float((imp >= th).mean()), float((gen < th).mean())
        rows.append((float(th), far, frr))
        if abs(far - frr) < abs(eer[0] - eer[1]):
            eer = (far, frr)
    return {"rows": rows, "eer": (eer[0] + eer[1]) / 2, "gen": gen, "imp": imp}


def report(m: dict) -> None:
    g, i = m["gen"], m["imp"]
    print(f"genuine  n={len(g):4d}  min {g.min():.3f}  mean {g.mean():.3f}  max {g.max():.3f}")
    print(f"impostor n={len(i):4d}  min {i.min():.3f}  mean {i.mean():.3f}  max {i.max():.3f}")
    print("threshold   FAR     FRR")
    for th in (0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.70):
        far = float((i >= th).mean()); frr = float((g < th).mean())
        print(f"   {th:.2f}   {far:6.1%}  {frr:6.1%}")
    print(f"Equal error rate (EER): {m['eer']:.2%}")


def demo(n_genuine: int) -> None:
    import skimage.data as sd

    eyes = {"real-0": cv2.cvtColor(sd.retina(), cv2.COLOR_RGB2BGR)}
    for s in range(1, 8):
        eyes[f"synth-{s}"] = synth_retina(s)
    gen, imp = [], []
    for (name, img) in eyes.items():
        for k in range(n_genuine):
            s = score(img, recapture(img, 1000 + k))
            if s is not None: gen.append(s)
    for (a, ia), (b, ib) in itertools.permutations(eyes.items(), 2):
        for k in range(2):
            s = score(ia, recapture(ib, 2000 + k))
            if s is not None: imp.append(s)
    report(metrics(gen, imp))


def from_dir(path: str, augment: bool) -> None:
    files = sorted(p for p in pathlib.Path(path).iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".gif", ".ppm"})
    subjects: dict[str, list[np.ndarray]] = {}
    for f in files:
        img = cv2.imread(str(f))
        if img is not None:
            subjects.setdefault(f.stem.split("_")[0], []).append(img)
    gen, imp = [], []
    for sid, imgs in subjects.items():
        if augment:
            imgs = [imgs[0]] + [recapture(imgs[0], 10 + k) for k in range(3)]
        for a, b in itertools.combinations(imgs, 2):
            s = score(a, b)
            if s is not None: gen.append(s)
    ids = list(subjects)
    for a, b in itertools.permutations(ids, 2):
        s = score(subjects[a][0], recapture(subjects[b][0], 77) if augment else subjects[b][0])
        if s is not None: imp.append(s)
    print(f"{len(subjects)} subjects, {len(files)} images")
    report(metrics(gen, imp))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir"); ap.add_argument("--augment", action="store_true"); ap.add_argument("--n", type=int, default=4)
    a = ap.parse_args()
    from_dir(a.dir, a.augment) if a.dir else demo(a.n)
