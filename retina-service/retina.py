"""
Retinal vessel-pattern verification (academic prototype).

Pipeline
  1. Decode the fundus photograph and find the circular field of view (FOV).
  2. Crop and resize so position and scale no longer matter.
  3. Take the green channel (best vessel contrast), equalise it, and run a
     multi-scale Frangi vesselness filter to highlight blood vessels.
  4. Store a small soft vessel map (256 x 256, 8-bit) as the template.
  5. To verify, extract the same map from the probe photo and compare it with
     the template using normalised cross-correlation over small rotations and
     shifts. The best score (0 to 1) is the similarity.

IMPORTANT LIMITS: a photograph can be replayed (no liveness check), and a
phone or webcam cannot capture a retina. This module only processes fundus
images. See README.md.
"""
from __future__ import annotations

import os

# Refuse absurdly large images before OpenCV decodes them (decompression bombs).
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", str(50_000_000))

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from skimage.filters import apply_hysteresis_threshold, frangi  # noqa: E402

WORK = 512  # working resolution after cropping to the FOV
TPL = 256  # stored template resolution
MIN_SIDE, MAX_SIDE = 300, 6000
ANGLES = list(range(-21, 22, 3))  # degrees of rotation tolerance
SCALES = (0.93, 1.0, 1.07)  # scale tolerance (re-captures are never exactly the same zoom)
SHIFT_MARGIN = 32  # pixels of shift tolerance at template resolution

# Quality gates (tuned on a real fundus photograph; recalibrate on your dataset)
MIN_FOV_FRACTION = 0.20
MIN_REDNESS = 1.5  # mean red / mean green inside the FOV (fundus photos are strongly red)
MAX_BLUE_TO_RED = 0.5  # fundus photos have very little blue
MIN_SHARPNESS = 8.0  # variance of Laplacian of the green channel
MIN_DENSITY, MAX_DENSITY = 0.03, 0.30  # fraction of FOV pixels that are vessels


class RetinaError(Exception):
    """A problem the user can fix by uploading a better image."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def decode_image(data: bytes) -> np.ndarray:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise RetinaError("bad_image", "The file could not be read as an image.")
    h, w = img.shape[:2]
    if min(h, w) < MIN_SIDE:
        raise RetinaError("too_small", f"Image is too small. Use at least {MIN_SIDE} pixels on each side.")
    if max(h, w) > MAX_SIDE:
        raise RetinaError("too_large", f"Image is too large. Use at most {MAX_SIDE} pixels per side.")
    return img


def _find_fov(img: np.ndarray):
    """Return (mask, bbox) of the retina disc. Mask has the same size as img."""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    k = max(8, min(h, w) // 10)
    corners = [gray[:k, :k], gray[:k, -k:], gray[-k:, :k], gray[-k:, -k:]]
    dark_border = float(np.mean([c.mean() for c in corners])) < 35

    if dark_border:
        blur = cv2.GaussianBlur(gray, (0, 0), 3)
        _, bw = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            raise RetinaError("no_fov", "No retina was found in the image.")
        cnt = max(contours, key=cv2.contourArea)
        mask = np.zeros((h, w), np.uint8)
        cv2.drawContours(mask, [cnt], -1, 255, thickness=cv2.FILLED)  # also fills holes
        x, y, bw_, bh_ = cv2.boundingRect(cnt)
        hull_area = cv2.contourArea(cv2.convexHull(cnt))
        solidity = cv2.contourArea(cnt) / hull_area if hull_area else 0
        aspect = bw_ / bh_ if bh_ else 0
        if solidity < 0.9 or not (0.6 <= aspect <= 1.6):
            raise RetinaError("no_fov", "The image does not show a round retinal field of view.")
    else:
        # Real fundus photographs have a dark surround. Anything else (a selfie, a cat,
        # a coffee cup) is refused instead of being guessed at.
        raise RetinaError("no_fov", "Upload the full retinal photograph including its dark border.")

    if mask.mean() / 255.0 < MIN_FOV_FRACTION:
        raise RetinaError("no_fov", "The retina covers too little of the image.")
    return mask, (x, y, bw_, bh_)


def _square_resize(img: np.ndarray, mask: np.ndarray, bbox) -> tuple[np.ndarray, np.ndarray]:
    x, y, bw, bh = bbox
    img, mask = img[y : y + bh, x : x + bw], mask[y : y + bh, x : x + bw]
    side = max(bw, bh)
    pad_y, pad_x = (side - bh) // 2, (side - bw) // 2
    sq_img = np.zeros((side, side, 3), np.uint8)
    sq_mask = np.zeros((side, side), np.uint8)
    sq_img[pad_y : pad_y + bh, pad_x : pad_x + bw] = img
    sq_mask[pad_y : pad_y + bh, pad_x : pad_x + bw] = mask
    return (
        cv2.resize(sq_img, (WORK, WORK), interpolation=cv2.INTER_AREA),
        (cv2.resize(sq_mask, (WORK, WORK), interpolation=cv2.INTER_NEAREST) > 0).astype(np.uint8),
    )


def extract(data: bytes) -> dict:
    """Image bytes -> {'template': 256x256 uint8, 'vessels': 256x256 uint8, 'quality': {...}}."""
    img = decode_image(data)
    mask_full, bbox = _find_fov(img)
    work, mask = _square_resize(img, mask_full, bbox)

    inside = mask > 0
    b, g, r = (work[..., i][inside].mean() for i in range(3))
    redness = float(r / (g + 1e-6))
    if redness < MIN_REDNESS or g < b or b / (r + 1e-6) > MAX_BLUE_TO_RED:
        raise RetinaError("not_fundus", "This does not look like a colour retinal (fundus) photograph.")

    # Green channel, background filled with the mean so the FOV edge gives no response
    green = work[..., 1].copy()
    green[~inside] = int(green[inside].mean())
    sharpness = float(cv2.Laplacian(green, cv2.CV_64F)[cv2.erode(mask, np.ones((15, 15), np.uint8)) > 0].var())

    eq = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)).apply(green)
    eq = cv2.GaussianBlur(eq, (0, 0), 1.0)
    v = frangi(eq.astype(np.float32) / 255.0, sigmas=(2, 3, 4), black_ridges=True)

    safe = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41))) > 0
    v = np.where(safe, v, 0).astype(np.float32)
    scale = float(np.percentile(v[safe], 99)) if safe.any() else 0.0
    if scale <= 0:
        raise RetinaError("no_vessels", "No blood-vessel pattern could be detected.")
    v = np.clip(v / scale, 0, 1)

    binary = apply_hysteresis_threshold(v, 0.10, 0.35)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binary.astype(np.uint8), connectivity=8)
    keep = np.zeros_like(binary, dtype=bool)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= 80:
            keep |= labels == i
    density = float(keep[safe].mean())

    if sharpness < MIN_SHARPNESS:
        raise RetinaError("blurry", "The image is too blurry. Retake it in focus.")
    if not (MIN_DENSITY <= density <= MAX_DENSITY):
        raise RetinaError("no_vessels", "The blood-vessel pattern is not clear enough in this image.")

    soft = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 2.0)
    soft = np.clip(soft * 1.5, 0, 1)
    template = (cv2.resize(soft, (TPL, TPL), interpolation=cv2.INTER_AREA) * 255).astype(np.uint8)
    vessels = (cv2.resize(keep.astype(np.uint8) * 255, (TPL, TPL), interpolation=cv2.INTER_AREA)).astype(np.uint8)

    return {
        "template": template,
        "vessels": vessels,
        "quality": {
            "sharpness": round(sharpness, 1),
            "vessel_density": round(density, 3),
            "redness": round(redness, 2),
            "fov_fraction": round(float(mask_full.mean() / 255.0), 3),
        },
    }


def encode_png(arr: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", arr)
    if not ok:
        raise RuntimeError("png encode failed")
    return buf.tobytes()


def decode_template(png: bytes) -> np.ndarray:
    arr = cv2.imdecode(np.frombuffer(png, np.uint8), cv2.IMREAD_GRAYSCALE)
    if arr is None or arr.shape != (TPL, TPL):
        raise RetinaError("bad_template", "Stored template is damaged.")
    return arr


def similarity(template: np.ndarray, probe: np.ndarray) -> float:
    """Best normalised cross-correlation (0 to 1) over small rotations, scales and shifts."""
    t = template.astype(np.float32) / 255.0
    p = probe.astype(np.float32) / 255.0
    core = t[SHIFT_MARGIN:-SHIFT_MARGIN, SHIFT_MARGIN:-SHIFT_MARGIN]
    if core.std() < 1e-4:
        return 0.0
    centre = ((TPL - 1) / 2, (TPL - 1) / 2)
    best = 0.0
    for angle in ANGLES:
        for scale in SCALES:
            rot = cv2.warpAffine(p, cv2.getRotationMatrix2D(centre, angle, scale), (TPL, TPL), flags=cv2.INTER_LINEAR, borderValue=0)
            res = cv2.matchTemplate(rot, core, cv2.TM_CCOEFF_NORMED)
            score = float(np.nan_to_num(res, nan=0.0, posinf=0.0, neginf=0.0).max())
            best = max(best, score)
    return round(max(0.0, min(1.0, best)), 4)
