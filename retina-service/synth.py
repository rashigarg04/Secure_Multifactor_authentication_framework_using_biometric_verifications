"""
Test helpers: synthetic fundus-like images and re-capture simulation.

Synthetic retinas are NOT real eyes. They only prove that the matcher separates
different vessel patterns. Use real datasets (see evaluate.py) for real numbers.
"""
from __future__ import annotations

import cv2
import numpy as np


def synth_retina(seed: int, size: int = 900) -> np.ndarray:
    rng = np.random.default_rng(seed)
    c = size // 2
    radius = int(size * 0.46)
    yy, xx = np.mgrid[:size, :size]
    r = np.hypot(yy - c, xx - c) / radius

    red = 205 - 70 * r**2
    green = 95 - 35 * r**2
    blue = 45 - 15 * r**2
    img = np.stack([blue, green, red], -1).astype(np.float32)

    # Optic disc somewhere left or right of centre
    side = rng.choice([-1, 1])
    dx, dy = side * rng.uniform(0.25, 0.4) * radius, rng.uniform(-0.15, 0.15) * radius
    disc = (int(c + dx), int(c + dy))

    vessel = np.zeros((size, size), np.uint8)

    def branch(p, ang, length, width, depth):
        if depth == 0 or width < 1:
            return
        pts = [p]
        for _ in range(int(length / 14)):
            ang += rng.normal(0, 0.18)
            p = (p[0] + 14 * np.cos(ang), p[1] + 14 * np.sin(ang))
            pts.append(p)
        cv2.polylines(vessel, [np.array(pts, np.int32)], False, 255, int(round(width)), cv2.LINE_AA)
        for k in range(1, len(pts) - 2):
            if rng.random() < 0.16:
                branch(pts[k], ang + rng.choice([-1, 1]) * rng.uniform(0.4, 1.0), length * 0.7, width * 0.7, depth - 1)
        branch(pts[-1], ang + rng.normal(0, 0.25), length * 0.7, width * 0.75, depth - 1)

    n_main = rng.integers(4, 7)
    base = np.arctan2(c - disc[1], c - disc[0])
    for i in range(n_main):
        branch(disc, base + rng.uniform(-1.3, 1.3), rng.uniform(300, 420), rng.uniform(5, 8), 4)

    v = cv2.GaussianBlur(vessel.astype(np.float32) / 255.0, (0, 0), 1.2)[..., None]
    img[..., 1:2] -= 60 * v  # vessels are dark in the green channel
    img[..., 2:3] -= 45 * v
    img[..., 0:1] -= 20 * v

    cv2.circle(img, disc, int(radius * 0.09), (150, 215, 245), -1, cv2.LINE_AA)
    img = cv2.GaussianBlur(img, (0, 0), 0.8)
    img += rng.normal(0, 3, img.shape)
    out = np.clip(img, 0, 255).astype(np.uint8)
    out[r > 1.0] = 0
    return out


def recapture(img: np.ndarray, seed: int) -> np.ndarray:
    """Simulate photographing the same eye again: small rotation, shift, scale,
    brightness change, noise, blur and JPEG compression."""
    rng = np.random.default_rng(seed)
    h, w = img.shape[:2]
    angle = rng.uniform(-12, 12)
    scale = rng.uniform(0.92, 1.08)
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, scale)
    m[:, 2] += (rng.uniform(-0.06, 0.06) * w, rng.uniform(-0.06, 0.06) * h)
    out = cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_LINEAR, borderValue=0)
    gamma = rng.uniform(0.8, 1.25)
    out = (255 * (out / 255.0) ** gamma * rng.uniform(0.85, 1.1)).clip(0, 255).astype(np.uint8)
    out = cv2.GaussianBlur(out, (0, 0), rng.uniform(0.3, 1.2))
    out = np.clip(out.astype(np.float32) + rng.normal(0, 5, out.shape), 0, 255).astype(np.uint8)
    ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, int(rng.integers(55, 90))])
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)


def to_jpeg(img: np.ndarray, quality: int = 92) -> bytes:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes()
