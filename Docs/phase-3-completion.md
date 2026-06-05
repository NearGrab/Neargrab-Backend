# Phase 3 Completion: Authentication And User APIs

Phase 3 adds full-featured production-ready Authentication and User Profile/Settings Management endpoints to the Neargrab backend. All new logic uses a **feature-first** directory structure.

## Files Added

### 1. Auth Feature Folder (`src/features/auth/`)
- `auth.routes.js`
- `auth.controller.js`
- `auth.service.js`
- `auth.service.test.js`
- `token.service.js`
- `token.service.test.js`
- `otp.service.js`
- `otp.service.test.js`
- `auth.schema.js`
- `auth.routes.test.js`

### 2. User Feature Folder (`src/features/user/`)
- `user.routes.js`
- `user.controller.js`
- `user.service.js`
- `user.schema.js`
- `user.routes.test.js`

### 3. Documentation
- `Docs/api/auth.md`

## Routes Implemented

### Auth Routes (`/api/v1/auth`)
- `POST /signup`: Basic name, email/phone registration.
- `POST /login`: E-mail/password verification.
- `POST /google`: Mock Google OAuth validation.
- `POST /otp/request`: Generates 6-digit OTP codes.
- `POST /otp/verify`: Consumes and validates codes.
- `POST /refresh`: Session rotation (rotates refresh tokens).
- `POST /logout`: Revoke one session.
- `POST /logout-all`: Revoke all sessions for a user.
- `POST /password/forgot`: Generates password-reset OTP.
- `POST /password/reset`: Updates password and logs out active sessions.

### User Routes (`/api/v1/me`)
- `GET /`: Retrieves current user details, profile, and shop summaries.
- `PATCH /`: Updates name, username, city, state, pincode, and avatar.
- `DELETE /`: soft-deactivates the user account and revokes active sessions.
- `GET /profile`: Fetches detailed profile.
- `PATCH /profile`: Updates bio, language, dateOfBirth, and profile JSONs.
- `GET /settings`: Fetches preferences and notification channel configurations.
- `PATCH /settings`: Updates privacy preferences and maps notification preferences.

## Authentication & Session Security Flow

- **Session Handling**: Raw refresh tokens are never saved. Only their SHA-256 hashes are written to the `Session` database table.
- **Token Rotation**: Rotation occurs on `POST /refresh`. It requires the active refresh token, matches its SHA-256 hash in the DB, verifies expiry and revocation status, generates a new token pair, overwrites the hash, and pushes new access/refresh tokens.
- **Deactivation & Password Reset**: Soft deactivation (`status = DEACTIVATED`) and completing a password reset automatically revoke all session rows belonging to the user (`revokedAt = new Date()`).

## OTP Mocking Behavior
- Generated OTPs are 6-digit numeric strings.
- Only the SHA-256 hash of the OTP is saved to `OtpCode`.
- OTP codes expire after 10 minutes, can only be consumed once, and block after 3 verification attempts.
- Under non-production environments (`NODE_ENV !== "production"`), the raw `"code"` is logged and returned in the HTTP response JSON for easy testing.

## Tests Added
A total of 5 new test files containing 27 new tests were added:
1. `src/features/auth/otp.service.test.js` (6 tests)
2. `src/features/auth/token.service.test.js` (5 tests)
3. `src/features/auth/auth.service.test.js` (6 tests)
4. `src/features/auth/auth.routes.test.js` (5 tests)
5. `src/features/user/user.routes.test.js` (5 tests)

All tests passed successfully (71/71 total tests in the suite).

## Known Limitations
- Google OAuth is currently simulated. Token signature verifying and checking against Google's client APIs is locked behind production checks (`NODE_ENV === "production"`).
- Third-party email and SMS providers (e.g. Twilio, SendGrid) are simulated via local console logging. Real integrations will occur in Phase 10.
