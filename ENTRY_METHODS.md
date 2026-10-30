# Additional entry methods

Google and password login remain available. Guest requests work without creating
an account. Email OTP, email magic links and SMS login have provider adapters and
RU/KK UI, hidden until configured. No provider accounts or paid services are
created by this change. Apple sign-in is not implemented in this iteration.

## Email activation

Use a verified sender domain in Resend (SPF/DKIM DNS records). Add these server-only
Vercel Production variables, then redeploy:

- `AUTH_MAIL_PROVIDER` — `resend`
- `RESEND_API_KEY` — restricted sending key
- `AUTH_MAIL_FROM` — verified sender

Both email methods share one adapter; no SMTP password or token reaches the browser.
The Gmail support address is not a verified sender domain. Do not activate with a
test sender restricted to the provider account owner and claim public delivery.
Verify real inbox delivery, spam placement and provider budget before activation.
Provider docs: https://resend.com/docs/api-reference/emails/send-email

## SMS activation (requires separate spending approval)

Prepared adapter uses Twilio Verify's provider-generated codes. Configure the
service, Kazakhstan geographic permissions, Fraud Guard and provider spend alerts/
limits. Check current availability, sender requirements and pricing for Kazakhstan
with the provider before activation. No number purchase or subscription is made here.

- `AUTH_SMS_PROVIDER` — `twilio-verify`
- `AUTH_SMS_ENABLED` — `true` (explicit spending gate; absent by default)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

Set six-digit codes in the Verify service. The provider controls code expiry and
consumption; the app accepts only +76/+77 E.164 numbers. A verified phone creates a
separate BUYER with a non-deliverable `@phone.invalid` identifier. No automatic
matching against editable profile phone or email, no password reset through SMS.
The generated identifier is not a verified email. Staff use their existing login.
Docs: https://www.twilio.com/docs/verify/api/verification and
https://www.twilio.com/docs/verify/api/verification-check

## Persistence and security

- Better Auth's installed MIT-licensed plugins are reused; no new dependencies.
- Auth migration adds nullable `phoneNumber` (unique) and `phoneNumberVerified`.
  Business migration 002 adds guest inquiries and persisted entry rate counters.
  Migration 001 is immutable. No existing account/session/data reset or seed.
  Checksums accept LF/CRLF representations of the exact same SQL for existing
  Windows checkouts; new checksums use LF. SQL edits still fail verification.
- SQLite migration 2 is additive; presentation on port 3200 is not migrated or rebuilt.
- Apply `cloud:migrate` with the owner connection, then reapply
  `scripts/postgres-runtime-grants.sql` before deploying the new server. Runtime has
  SELECT/INSERT/UPDATE on guest inquiries, no DELETE, and no DDL or history updates.
- Every new login endpoint is explicitly allowlisted with strict input schemas,
  Origin checks, bounded body, local callback paths and signed-out requirement.
  Unneeded plugin endpoints (password reset, linking, phone changes, token checks)
  are not publicly exposed. BUYER/active/verified checks run before session creation.
- OTP: keyed digest, 5-minute expiry, 3 failed attempts, single-use consumption.
  Magic link: hashed token, 10-minute expiry, atomic consumption. The emailed URL
  carries a fragment; the landing page requires a deliberate POST confirmation.
  The raw Better Auth GET redemption route stays closed to prevent mail-scanner login.
- Delivery errors return a generic failure, without logging provider bodies/codes.
- Shared demo accounts and staff are suppressed with uniform send responses; no
  email/SMS fallback grants staff access. Existing daily signup/cap guards remain.
- Existing password accounts with unverified email must continue password login
  until separate email verification is enabled. This avoids Better Auth's
  intentional revocation of unproven password links during passwordless recovery;
  current passwords and sessions are preserved. New and already email-verified
  BUYER accounts can use email OTP/link. Magic-link preflight is pinned to the
  installed Better Auth namespaced SHA-256 record contract and tested on upgrades.
- Per channel: 50 sends/hour globally, 5 per IP/10min, 1 per recipient/minute;
  verification: 300/hour globally, 30 per IP/10min, 5 per recipient/minute.
  Global send/verification counters are shared conservatively. Recipient/IP keys
  are HMAC digests; expired counters are removed. Vercel's overwritten IP header
  is trusted only on Vercel; other hosting uses one conservative IP bucket.
- Guest: strict schema, affirmative demo-data consent, honeypot, same persisted
  limits, max 200 total records, no account/session. ADMIN sees all; SELLER only
  assigned inquiries; BUYER/anonymous cannot list/read/update. Revision conflicts
  return 409; assignments/status changes append protected audit entries.
- Guest inquiries are consultation requests, not calculated orders. The guest
  explicitly types their requirements; selection items are not silently copied.
  No promise of an actual callback and no notifications to the real store.

## Validation

`node scripts/test-public-demo.mjs --google --build` runs the provider-contract
simulation in a fresh loopback PostgreSQL database, never sends real messages, and
then runs the public HTTPS browser suite. It covers OTP expiry/attempts/reuse,
parallel magic-link redemption, SMS contract, strict inputs, staff/disabled-account
restrictions, missing provider configuration, delivery failure, guest assignment,
seller isolation, revision conflicts and audit. The app contains no test transport.
Real provider delivery must still be tested after credentials/domain are configured.

`npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` and
`npm run test:postgres` provide the existing regression checks.

## Sign in with Apple estimate

Medium integration effort: approximately 1–2 developer days after account access
and identifiers are ready; enrollment/verification can add external waiting time.
Requires Apple Developer Program membership (normally USD 99/year), a Services ID
associated with a primary App ID enabled for Sign in with Apple, a private signing
key and web return URL. Plan key/client-secret rotation, Hide My Email relay and
first-login-only profile handling. Do not buy membership without approval.
https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
https://developer.apple.com/programs/enroll/
