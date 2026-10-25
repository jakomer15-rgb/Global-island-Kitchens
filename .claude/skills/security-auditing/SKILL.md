---
name: security-auditing
description: Security checklist for the Global Island Kitchens platform — auth, authorisation, IDOR, uploads, sessions, CSRF, headers, secrets, personal data. Use when reviewing changes, before releases, or when building auth, uploads or portals.
---

# Security auditing

## Checklist per entry point

- **Authentication**: is a session required, and is it checked on the server (not only in the proxy)?
- **Authorisation**: does the service call `assertCan` with the right permission?
- **Ownership (IDOR)**: can a designer or customer reach another's record by changing an ID? Queries
  must filter by owner.
- **Validation**: Zod on every input, including IDs, enums, lengths and file metadata.
- **Mass assignment**: only whitelisted fields reach Prisma `data`.
- **Uploads**: type allow-list checked by magic bytes, size limits, private bucket, signed URLs,
  no SVG or HTML from users.
- **Sessions**: `HttpOnly`, `Secure`, `SameSite=Lax`, rotation on sign-in, idle timeout, sign-out
  revokes the session.
- **CSRF**: server actions rely on origin checks; data-changing route handlers check `Origin`.
- **Rate limits**: sign-in, registration, password reset, public forms, uploads.
- **Output**: no user HTML rendered without sanitising; CSV exports escape formula characters.
- **Headers**: CSP with nonces, HSTS, frame-ancestors none, Referrer-Policy, Permissions-Policy.
- **Secrets**: only in environment variables; none in logs, errors, client bundles or the repo.
- **Personal data**: collect only what's used; consent recorded; IP addresses hashed; retention
  documented in the privacy policy.
- **Audit**: sensitive actions (roles, approvals, deletions, exports) are logged.

## Reporting

Each finding: file:line, concrete failure scenario, severity (critical/high/medium/low), confirmed or
plausible, suggested fix. Fix confirmed findings before the phase closes.
