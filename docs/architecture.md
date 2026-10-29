# Architecture

## Components
| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| API | Python 3.12, FastAPI | Registration, login, factor verification |
| Database | PostgreSQL 16 | Users, password hashes, TOTP secrets, encrypted templates, audit log |
| Cache | Redis 7 | Pending logins, challenges, rate-limit counters |
| Biometric engine | OpenCV, ONNX Runtime | Quality check, face detection, liveness, embedding, matching |
| Frontend | React | Login screens, camera capture, WebAuthn calls |

## How the pieces connect
Browser --HTTPS--> API --> PostgreSQL
                     |---> Redis
                     |---> Biometric engine (inside the API process)

## Why these choices
- FastAPI: type-checked request handling and automatic API docs.
- PostgreSQL: reliable storage with strong access control.
- Redis: automatic expiry suits one-time codes and login sessions.
- ONNX Runtime: runs a face model without a heavy ML framework.
- Docker Compose: one command starts the same setup on any machine.

## Code layout rules
- api/        route handlers only, no business logic
- factors/    one module per non-biometric factor, same interface
- biometrics/ the face pipeline, one module per stage
- core/       shared security code: crypto, tokens, rate limiting, audit
- services/   logic that combines factors, such as the MFA policy
- models/     database tables
- schemas/    request and response shapes

## Security rules for the codebase
1. Secrets come from environment variables only.
2. Database and Redis are never exposed outside the Docker network.
3. Raw biometric images are never written to disk or logs.
4. Every new route is checked against docs/threat-model.md.

## Decisions still open
- Face model choice, decided in Step 5.
- Secrets vault for production, decided in Step 9.