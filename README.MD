# Secure MFA Framework with Biometric Verification

A multi-factor authentication framework that combines a password,
a one-time code or security key, and biometric verification
(face match with liveness detection).

## Status
Step 1 of 9: requirements and threat model (documents only).

## Documentation
- docs/requirements.md        what the system must do
- docs/data-flow.md           how one login moves through the system
- docs/threat-model.md        attacks and the controls against them
- docs/decisions/             recorded design decisions

## Security notice
Never commit a real `.env` file. Copy `.env.example` to `.env`
and fill in your own values locally.