# 🔐 Secure Multi-Factor Authentication Framework Using Biometric Verification

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![WebAuthn](https://img.shields.io/badge/FIDO2-WebAuthn-orange)

A college capstone project that implements a multi-factor authentication (MFA) framework combining a **password**, a **device-bound biometric factor via WebAuthn/FIDO2**, and a **TOTP/recovery-code fallback**.

> **Privacy by design:** biometric data (fingerprint, face) is matched locally inside the user's device and **never reaches the server**. The server stores only public keys and credential IDs.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Authentication Flow](#-authentication-flow)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Overview](#-api-overview)
- [Security Considerations](#-security-considerations)
- [Testing](#-testing)
- [Roadmap](#-roadmap)
- [Team](#-team)
- [References](#-references)
- [License](#-license)

---

## 📖 Overview

Passwords alone are vulnerable to phishing, credential stuffing, and breaches. Server-side biometric storage creates a different problem: biometrics cannot be changed once leaked.

This project demonstrates a framework that addresses both issues:

1. **Factor 1 (knowledge):** Password verified with Argon2id.
2. **Factor 2 (inherence/possession):** Biometric or PIN verification performed by the platform authenticator (Face ID, Touch ID, Windows Hello, Android biometrics) using WebAuthn public-key cryptography.
3. **Fallback factor:** TOTP (authenticator app) or one-time recovery codes, with stricter rate limits and audit logging.

## ✨ Key Features

- Password + WebAuthn (FIDO2) multi-factor login
- Challenge-response authentication with single-use, expiring challenges
- Multiple registered devices per user, with device management
- TOTP fallback and hashed recovery codes
- Short-lived JWT access tokens with rotating refresh tokens and reuse detection
- Rate limiting, account lockout, and audit logging
- No biometric templates stored server-side

## 🏗 Architecture

```mermaid
flowchart LR
    U[User + Authenticator<br/>Secure Enclave / TPM] <--> B[React + Vite Frontend]
    B <-->|HTTPS / JSON| A[Node.js API]
    A --> DB[(PostgreSQL)]
    A --> C[Challenge Store]
```

> Detailed UML, sequence, and ER diagrams live in [`/docs/diagrams`](docs/diagrams).

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, `@simplewebauthn/browser` |
| Backend | Node.js, Express/Fastify, TypeScript, `@simplewebauthn/server` |
| Database | PostgreSQL (Docker or Supabase) |
| Password hashing | Argon2id |
| OTP | TOTP via `otplib` |
| Sessions | JWT (access) + rotating refresh token (HttpOnly cookie) |
| DevOps | Docker Compose, GitHub Actions |
| Testing | Vitest/Jest, Playwright, OWASP ZAP |

## 🔄 Authentication Flow

### Registration
1. User submits email and password; the server stores an Argon2id hash.
2. Server issues WebAuthn registration options (random challenge, `userVerification: "required"`).
3. Device prompts for biometric/PIN and generates a key pair; the private key never leaves the device.
4. Server verifies the response and stores **only** the public key and credential ID.
5. Server issues one-time recovery codes (stored hashed) and optionally enrolls TOTP.

### Login
1. **Password check** → server returns a short-lived `mfa_pending` pre-auth token (no resource access).
2. **WebAuthn assertion** → server issues a fresh challenge; the device signs it after biometric verification; the server validates signature, challenge, origin, rpId, UV flag, and signature counter.
3. **Fallback (if needed)** → TOTP or recovery code, rate-limited and logged.
4. Server issues the full access token and refresh token.

## 📁 Project Structure

```
.
├── client/                 # React + Vite frontend
│   └── src/
├── server/                 # Node.js backend
│   └── src/
│       ├── routes/
│       ├── services/       # auth, webauthn, totp, tokens
│       ├── middleware/     # rate limiting, auth guards
│       └── db/             # migrations and queries
├── docs/
│   ├── diagrams/           # UML, sequence, ER, deployment
│   ├── threat-model.md
│   ├── api-spec.yaml       # OpenAPI
│   └── report/
├── tests/                  # integration and E2E tests
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- A browser with WebAuthn support (Chrome, Edge, Safari, Firefox)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>

# 2. Configure environment
cp .env.example .env

# 3. Start PostgreSQL
docker compose up -d db

# 4. Install dependencies
cd server && npm install
cd ../client && npm install

# 5. Run database migrations
cd ../server && npm run migrate

# 6. Start the apps (in separate terminals)
cd server && npm run dev     # API on http://localhost:4000
cd client && npm run dev     # App on http://localhost:5173
```

> **Note:** WebAuthn requires HTTPS in production. `localhost` is allowed during development.

## ⚙️ Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/mfa` |
| `JWT_ACCESS_SECRET` | Secret for access tokens | *(long random string)* |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | *(long random string)* |
| `RP_ID` | WebAuthn relying party ID | `localhost` |
| `RP_NAME` | Relying party display name | `Capstone MFA` |
| `ORIGIN` | Expected frontend origin | `http://localhost:5173` |
| `TOTP_ENCRYPTION_KEY` | Key for encrypting TOTP secrets | *(32-byte key)* |

**Never commit `.env`.** Only commit `.env.example` with placeholder values.

## 🔌 API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account (password factor) |
| POST | `/api/auth/login` | Verify password, return pre-auth token |
| POST | `/api/webauthn/register/options` | Get registration options |
| POST | `/api/webauthn/register/verify` | Verify and store new credential |
| POST | `/api/webauthn/login/options` | Get authentication challenge |
| POST | `/api/webauthn/login/verify` | Verify assertion, issue session |
| POST | `/api/totp/enroll` | Enroll TOTP fallback |
| POST | `/api/totp/verify` | Verify TOTP code |
| POST | `/api/recovery/verify` | Use a recovery code |
| POST | `/api/auth/refresh` | Rotate refresh token |
| POST | `/api/auth/logout` | Revoke session |

Full specification: [`docs/api-spec.yaml`](docs/api-spec.yaml)

## 🛡 Security Considerations

| Threat | Mitigation |
|---|---|
| Replay attacks | Single-use random challenges with short TTL; signature counter check |
| Phishing / MITM | Origin- and rpId-bound signatures; HTTPS + HSTS |
| Biometric spoofing | Liveness handled by platform authenticator; `userVerification: "required"` |
| Brute force / credential stuffing | Argon2id, rate limiting, lockout |
| Database breach | Only public keys, hashed passwords/recovery codes, encrypted TOTP secrets |
| Token theft | Short-lived JWTs, HttpOnly/Secure/SameSite cookies, refresh rotation with reuse detection |
| CSRF / XSS | SameSite cookies, CSRF tokens, strict CSP |

See [`docs/threat-model.md`](docs/threat-model.md) for the full STRIDE analysis.

**Standards referenced:** NIST SP 800-63B, OWASP ASVS, W3C WebAuthn, FIDO2 CTAP, GDPR (Art. 9), India DPDP Act 2023.

## 🧪 Testing

```bash
# Unit and integration tests
cd server && npm test

# End-to-end tests (uses a virtual WebAuthn authenticator)
cd client && npm run test:e2e
```

Security tests include replay-attack rejection, expired-challenge rejection, brute-force throttling, and refresh-token reuse detection.

## 🗺 Roadmap

- [ ] **Weeks 1–2:** Research, threat model, architecture and UML design
- [ ] **Week 3:** Project scaffolding, Docker, CI
- [ ] **Week 4:** Password registration and login
- [ ] **Week 5:** JWT session management and refresh rotation
- [ ] **Weeks 6–7:** WebAuthn registration and authentication
- [ ] **Week 8:** TOTP and recovery-code fallback
- [ ] **Week 9:** Frontend polish and device management
- [ ] **Week 10:** Audit logging and security hardening
- [ ] **Week 11:** Security testing (ZAP, attack simulations)
- [ ] **Week 12:** Deployment
- [ ] **Week 13:** Usability study and evaluation
- [ ] **Week 14:** Final report and presentation

## 👥 Team

| Name | Role |
|---|---|
| **Your Name** | Lead developer: architecture, backend, security logic |
| **Teammate Name** | Research, documentation, UI/UX, testing, presentation |

**Supervisor:** *Prof. Name*
**Institution:** *University / College Name* · *Academic Year*

## 📚 References

1. W3C. *Web Authentication: An API for accessing Public Key Credentials, Level 2.*
2. FIDO Alliance. *FIDO2: CTAP and WebAuthn specifications.*
3. NIST. *SP 800-63B: Digital Identity Guidelines, Authentication and Lifecycle Management.*
4. OWASP. *Authentication Cheat Sheet* and *Application Security Verification Standard (ASVS).*
5. *(Add literature review sources here.)*

## 📄 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for details.

> ⚠️ **Disclaimer:** This is an academic project and has not undergone FIDO certification or a professional security audit. Do not use in production without further review.
