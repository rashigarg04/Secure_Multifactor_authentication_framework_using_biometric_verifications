# Login data flow

## Actors and stores
- Browser: password field, authenticator code field, camera
- API server: verifies each factor
- PostgreSQL: users, password hashes, TOTP secrets, encrypted
  biometric templates, audit log
- Redis: short-lived login sessions, challenges, rate-limit counters

## One login, in order

```
Browser                    API server                 Data stores
   |                           |                           |
   |--(1) email + password --->|                           |
   |                           |--- fetch password hash -->| PostgreSQL
   |                           |<-- hash ------------------|
   |                           |  verify (Argon2id)        |
   |<-- partial session -------|--- save pending login --->| Redis
   |                           |                           |
   |--(2) TOTP code / key ---->|                           |
   |                           |--- fetch TOTP secret ---->| PostgreSQL
   |                           |  verify, mark code used ->| Redis
   |<-- challenge issued ------|                           |
   |                           |                           |
   |--(3) camera frames ------>|                           |
   |   (with challenge)        |  quality check            |
   |                           |  liveness check           |
   |                           |  extract feature vector   |
   |                           |--- fetch template ------->| PostgreSQL
   |                           |  decrypt, compare         |
   |<-- full session ----------|--- write audit event ---->| PostgreSQL
```

## Where sensitive data lives
| Data | Where it travels | Where it is stored |
|------|------------------|--------------------|
| Password | Browser to server over HTTPS | Never stored, only the Argon2id hash |
| TOTP code | Browser to server over HTTPS | Never stored, secret is stored encrypted |
| Camera frames | Browser to server over HTTPS | Never stored, discarded after processing |
| Face feature vector | Inside the server only | PostgreSQL, encrypted |
| Encryption key | Server memory | Outside the database (environment or vault) |
| Session state | Server only | Redis, expires automatically |

## Trust boundaries
1. Browser to server: untrusted input, all of it validated.
2. Server to database: only the server holds credentials.
3. Server to key storage: the encryption key is never in the
   same place as the encrypted templates.