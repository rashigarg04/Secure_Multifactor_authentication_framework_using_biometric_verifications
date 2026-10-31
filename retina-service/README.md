# Retina verification service (academic prototype)

Compares **retinal (fundus) photographs** by their blood-vessel pattern. It is called only by the Node API.

## Read this first: what it is and is not

- A phone or webcam **cannot scan a retina**. Real retinal scanners are specialised infrared devices.
  This prototype works on fundus photographs (the kind taken by an eye clinic camera).
- It has **no liveness detection**. A saved photograph of an enrolled eye can be replayed. Do not use it to
  protect real accounts without dedicated hardware and liveness checks.
- It is a **second factor only**, used after the password.
- Accuracy numbers in the report come from 1 real photograph and synthetic images. Measure on a real
  dataset (RIDB, VARIA, or DRIVE/STARE with `--augment`) before drawing conclusions.

## Privacy design

- The uploaded photo is processed in memory and discarded.
- Only a 256x256 vessel-pattern template is kept. The Node API encrypts it (AES-256-GCM, bound to the user id)
  before storing it, and the field is excluded from normal database queries.
- Enrolment needs an explicit consent tick, recorded with a timestamp. The user can delete the template at any time.
- Administrators cannot read templates (they are encrypted with a server key that is not in the database).

## Setup

```bash
cd retina-service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export RETINA_SERVICE_KEY=<same value as in server/.env>   # Windows PowerShell: $env:RETINA_SERVICE_KEY="..."
uvicorn app:app --host 127.0.0.1 --port 8001
```

Bind to 127.0.0.1 only. Never expose this service to the internet.

## server/.env additions

```ini
RETINA_SERVICE_URL=http://127.0.0.1:8001
RETINA_SERVICE_KEY=<random string, 16+ characters>
RETINA_TEMPLATE_KEY=<64 hex characters>
RETINA_THRESHOLD=0.5
```

Generate the keys with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"        # RETINA_TEMPLATE_KEY
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"  # RETINA_SERVICE_KEY
```

Leave `RETINA_SERVICE_URL` empty to switch the feature off; everything else keeps working.
Losing `RETINA_TEMPLATE_KEY` makes every stored template unreadable, so back it up.

## Tests

```bash
python -m pytest -q tests                        # 15 tests: matching, rejection of non-retina photos, API key, size limits
python make_test_images.py ../server/scripts/retina-samples
node ../server/scripts/retina-smoke-test.mjs     # needs the API, database and this service running
python evaluate.py                               # genuine vs impostor scores, FAR, FRR, EER
python evaluate.py --dir PATH --augment          # on a real dataset (files named <subject>_<n>.jpg)
```

## How the matcher works

1. Find the circular retina area and crop it, so position and scale stop mattering.
2. Take the green channel (best vessel contrast), equalise contrast, run a multi-scale Frangi vesselness filter.
3. Keep strong, connected vessel pixels. Refuse images that are blurry, not red enough, have no dark border,
   or whose vessel density is implausible.
4. Compare templates by normalised cross-correlation, searching small rotations (+/-21 degrees),
   scales (0.93 to 1.07) and shifts (+/-32 px). The best score from 0 to 1 is the similarity.
5. The API accepts a login when the score reaches `RETINA_THRESHOLD` (default 0.5).
