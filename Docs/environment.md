# Environment Variables Reference

This document describes all environment variables used by the Neargrab backend application, as parsed and validated in [src/config/env.js](file:///home/ariont/Code/StartUps/Backend/src/config/env.js).

## Environment Schema

| Variable Name | Data Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Enum (`development`, `test`, `production`) | `development` | The execution environment target stage. |
| `PORT` | Integer | `5000` | The network port the server listens on. |
| `DATABASE_URL` | String | *None* | Prisma connection URI for PostgreSQL database. Required in production. |
| `JWT_ACCESS_SECRET` | String | *None* | Secret key for signing Access JWTs. Required in production. |
| `JWT_REFRESH_SECRET` | String | *None* | Secret key for signing Refresh JWTs. Required in production. |
| `ACCESS_TOKEN_TTL` | String | `15m` | Expiry duration for Access Tokens. |
| `REFRESH_TOKEN_TTL` | String | `30d` | Expiry duration for Refresh Tokens. |
| `CORS_ORIGINS` | Comma-separated Strings | `http://localhost:5173,http://localhost:5174` | Allowed CORS request source URLs. |
| `UPLOAD_DRIVER` | String | `local` | Storage driver configuration (`local` or `cloudinary`). |
| `UPLOAD_DIR` | String | `uploads` | Directory folder target for local uploads. |
| `UPLOAD_MAX_FILE_SIZE_BYTES` | Integer | `5242880` (5MB) | Size limit allowed for media assets uploads. |
| `CLOUDINARY_URLS` | String | *None* | Cloudinary credentials URL. Required if driver is `cloudinary`. |
| `RATE_LIMIT_WINDOW_MS` | Integer | `60000` (1 min) | Time window in milliseconds for rate limiter. |
| `RATE_LIMIT_MAX` | Integer | `100` | Max requests allowed in rate-limit window per IP. |
| `LOG_LEVEL` | String | `info` | Logging verbosity for Pino (`debug`, `info`, `warn`, `error`). |
| `PUBLIC_BASE_URL` | String | `http://localhost:5000` | Host base URL for formatting absolute asset links. |
| `GOOGLE_CLIENT_ID` | String | *None* | Google Web OAuth app credentials client ID. |
| `SMS_PROVIDER` | String | `mock` | SMS gateway driver identifier (`mock` or real client provider). |
| `EMAIL_PROVIDER` | String | `mock` | Email dispatch service driver (`mock` or real client provider). |

---

## Environment Stage Differences

### 1. Development Stage (`NODE_ENV=development`)
- Database can connect to a local PostgreSQL instance.
- Mock providers are acceptable for `SMS_PROVIDER` and `EMAIL_PROVIDER`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` fallback to mock values if not defined, but it is recommended to set strong values.
- `UPLOAD_DRIVER` defaults to `local` to persist uploaded assets locally in the `Backend/uploads` directory.

### 2. Testing Stage (`NODE_ENV=test`)
- The database connection should connect to a test database (e.g. `postgresql://..._test`) so migrations can be reset safely during test suites run.
- Rate-limiting rules can be relaxed or bypass headers used.
- Environment variables are often loaded dynamically by the test runner (e.g. Jest).

### 3. Production Stage (`NODE_ENV=production`)
- **Strict Verification:** The server will fail to start if `DATABASE_URL`, `JWT_ACCESS_SECRET`, or `JWT_REFRESH_SECRET` are not provided.
- `DATABASE_URL` must connect to a robust, pooled PostgreSQL production instance.
- Security keys must use highly secure cryptographic random strings (at least 256-bit).
- `UPLOAD_DRIVER` should be configured to a cloud provider like `cloudinary` (with `CLOUDINARY_URLS` configured) or an S3 compatible driver.
- Log levels should typically be set to `info` or `warn` to prevent logging overflow while retaining actionable errors.
- CORS origins must be configured to the production domain hosting the frontend and admin panels.
