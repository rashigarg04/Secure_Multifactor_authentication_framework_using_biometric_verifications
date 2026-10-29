# Requirements

## 1. Goal and scope
**Goal:** Let users sign in only when they prove three independent
things: something they know, something they have, and something
they are.

**In scope:** registration, login, factor enrollment, factor
recovery, and audit logging.
**Out of scope:** authorization (what a user may do after login),
single sign-on with other providers, and mobile native apps.
**[EDIT]** Adjust scope to match your project.

## 2. Users and assurance level
- Users: **[EDIT]** e.g. students, employees, customers.
- What is protected: **[EDIT]** e.g. personal records, payments.
- Assurance level: high. A stolen password alone, or a stolen
  phone alone, must not allow access.

## 3. Authentication factors
| # | Type | Method | Notes |
|---|------|--------|-------|
| 1 | Knowledge | Password | Hashed with Argon2id, minimum 12 characters |
| 2 | Possession | TOTP app code, or WebAuthn security key | Security key preferred |
| 3 | Inherence | Face match with liveness check | Fingerprint via device WebAuthn as an option |

## 4. Functional requirements
- FR1: A user can register with an email and password.
- FR2: A user can enroll a TOTP authenticator and see recovery codes once.
- FR3: A user can enroll a face biometric through the browser camera.
- FR4: Login requires all three factors, in order.
- FR5: Biometric verification is rejected if liveness fails.
- FR6: Failed attempts are rate limited and lock the account
  temporarily.
- FR7: Every login attempt and enrollment change is written to an
  audit log.
- FR8: A user can recover access with a one-time recovery code.

## 5. Failure handling
| Situation | Behavior |
|-----------|----------|
| Phone lost | Use a recovery code, then re-enroll TOTP |
| Camera unavailable or poor quality | Retry up to 3 times, then use a security key or recovery code |
| Biometric repeatedly rejected | Lock the biometric factor and require recovery |
| Account locked | Unlock after the lockout period or by recovery |

## 6. Non-functional requirements
- Biometric accuracy targets **[EDIT]**: false accept rate at or
  below 0.1%, false reject rate at or below 5%. Confirm with test
  data in Step 5.
- Biometric step completes in under 3 seconds on a normal server.
- All traffic over HTTPS.
- Raw face images are never stored.
- Secrets and keys are never in source control.