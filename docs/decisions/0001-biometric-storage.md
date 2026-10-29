# 0001: How biometric data is stored

Status: Accepted
Date: **[EDIT]**

## Context
A leaked password can be changed. A leaked face or fingerprint
cannot. Storing biometric data carries a higher privacy and
security risk than any other factor, and may be regulated by
privacy law where your users live.

## Decision
1. Raw face images are never stored. Camera frames are processed in
   memory and discarded.
2. Only a numeric feature vector (embedding) is stored, per user.
3. The vector is encrypted with AES-256-GCM before it is written
   to the database.
4. The encryption key is kept outside the database, in an
   environment variable for development and a secrets vault for
   production.
5. Users can delete their biometric template at any time, and it
   is deleted when the account is deleted.
6. Only the biometric service module can decrypt templates. No
   admin screen displays them.

## Consequences
- A stolen database alone does not reveal usable biometric data.
- If the key is lost, users must re-enroll their face.
- Matching happens on the server, so the server must be secured
  accordingly.
- Consent text must be shown at enrollment (written in Step 8).