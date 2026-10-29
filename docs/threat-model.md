# Threat model

Likelihood and impact use Low, Medium, High. **[EDIT]** Adjust the
ratings to your own situation.

| ID | Threat | How it happens | Likelihood | Impact | Control | Where built |
|----|--------|----------------|-----------|--------|---------|-------------|
| T1 | Spoofing | Photo, video or mask shown to the camera | High | High | Liveness detection before matching | Step 6 |
| T2 | Replay | Captured code or frame sent again | Medium | High | Single-use codes, fresh challenge per attempt | Steps 4, 5 |
| T3 | Template theft | Database copied, biometric data read | Medium | High | Encrypted templates, key stored outside database | Step 6 |
| T4 | Brute force | Automated password or code guessing | High | Medium | Rate limiting and temporary lockout | Step 9 |
| T5 | Man-in-the-middle | Attacker between browser and server | Low | High | HTTPS only, WebAuthn origin binding | Steps 7, 9 |
| T6 | Recovery abuse | Account taken over via lost-device flow | Medium | High | One-time recovery codes, identity check | Step 7 |
| T7 | Credential stuffing | Passwords leaked elsewhere are tried here | High | Medium | Second and third factors still required, rate limiting | Steps 4, 9 |
| T8 | Insider access | Staff read or misuse biometric data | Low | High | Encryption, access logging, minimal access | Steps 6, 9 |

## Residual risks (accepted for now)
- A very high quality deepfake may pass basic liveness checks.
  Revisit with stronger liveness methods later.
- If a user's device is fully compromised, factors on that device
  are compromised too.

## Review rule
Every new feature must be checked against this table before it is
merged. Add a new row when a new threat appears.