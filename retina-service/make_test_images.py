"""Write sample images for the Node smoke test:  python make_test_images.py <output-folder>"""
import pathlib, sys

import cv2
from skimage import data as sd

from synth import recapture, synth_retina, to_jpeg

out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "samples")
out.mkdir(parents=True, exist_ok=True)
eye = cv2.cvtColor(sd.retina(), cv2.COLOR_RGB2BGR)

(out / "enrol_eye.jpg").write_bytes(to_jpeg(eye))
(out / "same_eye_recaptured.jpg").write_bytes(to_jpeg(recapture(eye, 3)))   # same eye, new photo
(out / "different_eye.jpg").write_bytes(to_jpeg(synth_retina(9)))           # a different (synthetic) eye
(out / "not_a_retina.jpg").write_bytes(to_jpeg(cv2.cvtColor(sd.coffee(), cv2.COLOR_RGB2BGR)))
(out / "blurry_eye.jpg").write_bytes(to_jpeg(cv2.GaussianBlur(eye, (0, 0), 12)))
print("wrote", sorted(p.name for p in out.iterdir()))
