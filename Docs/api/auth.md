# Authentication And User APIs Documentation

This document describes the endpoints for Authentication (`/api/v1/auth`) and User Profile/Settings (`/api/v1/me`).

---

## Authentication Endpoints (`/api/v1/auth`)

### 1. User Signup
Create a new user profile, auth account, and default notification preferences.
- **Route**: `POST /api/v1/auth/signup`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "name": "Arion Test",
    "email": "customer@example.com",
    "phone": "9876543210",
    "password": "Password123!",
    "city": "Navsari"
  }
  ```
  *Note*: Either `email` or `phone` is required. If `email` is present, it must be unique and valid. `phone` must be a 10-digit number.
- **Response Shape (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "cuid-string",
        "name": "Arion Test",
        "username": "customer",
        "email": "customer@example.com",
        "phone": "9876543210",
        "role": "CUSTOMER",
        "status": "ACTIVE",
        "city": "Navsari",
        "createdAt": "2026-06-05T21:47:35.000Z",
        "updatedAt": "2026-06-05T21:47:35.000Z"
      },
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "40-byte-hex-refresh-token"
    }
  }
  ```

### 2. User Login
Authenticate user with email and password.
- **Route**: `POST /api/v1/auth/login`
- **Auth**: Public (Rate Limited)
- **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "password": "Password123!"
  }
  ```
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "cuid-string",
        "name": "Arion Test",
        "username": "customer",
        "email": "customer@example.com",
        "phone": "9876543210",
        "role": "CUSTOMER",
        "status": "ACTIVE"
      },
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "40-byte-hex-refresh-token"
    }
  }
  ```

### 3. Google OAuth Placeholder
Mock authentication pathway in non-production. In production, checks real tokens (or throws a setup error).
- **Route**: `POST /api/v1/auth/google`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "idToken": "mock-google-token",
    "email": "user@example.com",
    "name": "Google User",
    "providerUserId": "google-user-id"
  }
  ```
- **Response Shape (200 OK)**:
  Same structure as login/signup responses.

### 4. OTP Request
Generate a numeric 6-digit verification code.
- **Route**: `POST /api/v1/auth/otp/request`
- **Auth**: Public (Rate Limited)
- **Request Body**:
  ```json
  {
    "identifier": "9876543210",
    "purpose": "LOGIN"
  }
  ```
  *Note*: Purpose must be one of: `LOGIN`, `SIGNUP`, `PASSWORD_RESET`, `PHONE_VERIFY`, `EMAIL_VERIFY`.
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "expiresAt": "2026-06-05T21:57:35.000Z"
    }
  }
  ```
  *Note*: In non-production configurations, the response also includes the raw `"code"` for testing purposes.

### 5. OTP Verify
Verify a generated 6-digit code.
- **Route**: `POST /api/v1/auth/otp/verify`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "identifier": "9876543210",
    "purpose": "LOGIN",
    "code": "123456"
  }
  ```
- **Response Shape (200 OK)**:
  - If purpose is `LOGIN` or `SIGNUP`, returns user and auth tokens (same as login response).
  - For verify purposes (`PHONE_VERIFY`, `EMAIL_VERIFY`), returns `{ "success": true, "data": { "success": true } }`.

### 6. Token Rotation (Refresh)
Rotate the current session using the refresh token.
- **Route**: `POST /api/v1/auth/refresh`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "refreshToken": "40-byte-hex-refresh-token"
  }
  ```
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "new-jwt-access-token",
      "refreshToken": "new-refresh-token"
    }
  }
  ```

### 7. Logout Current Session
Revokes the session token used in the request.
- **Route**: `POST /api/v1/auth/logout`
- **Auth**: Authenticated User
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "success": true
    }
  }
  ```

### 8. Logout All Sessions
Revokes all active sessions for the user.
- **Route**: `POST /api/v1/auth/logout-all`
- **Auth**: Authenticated User
- **Headers**: `Authorization: Bearer <accessToken>`
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "success": true
    }
  }
  ```

### 9. Forgot Password
Trigger a password reset OTP code for the user with the given email.
- **Route**: `POST /api/v1/auth/password/forgot`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "customer@neargrab.test"
  }
  ```
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "success": true
    }
  }
  ```
  *Note*: In non-production, the JSON data contains the raw `"code"` property for testing.

### 10. Reset Password
Complete the password reset using the emailed OTP code.
- **Route**: `POST /api/v1/auth/password/reset`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "customer@neargrab.test",
    "code": "123456",
    "password": "NewPassword123!"
  }
  ```
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "success": true
    }
  }
  ```
  *Note*: Completing a reset revokes all active sessions for the user, forcing them to login with the new password.

---

## Current User Endpoints (`/api/v1/me`)

*All current user endpoints require a valid bearer access token inside `Authorization` header.*

### 1. Fetch User Data
- **Route**: `GET /api/v1/me`
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "cuid-string",
      "name": "Customer Name",
      "username": "customer",
      "email": "customer@neargrab.test",
      "phone": "9876543210",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "city": "Navsari",
      "state": "Gujarat",
      "pincode": "396445",
      "profile": {
        "id": "profile-id",
        "bio": "Sample user bio",
        "language": "en",
        "dateOfBirth": "2000-01-01T00:00:00.000Z"
      },
      "shop": null
    }
  }
  ```

### 2. Update Basic Fields
- **Route**: `PATCH /api/v1/me`
- **Request Body**:
  ```json
  {
    "name": "New Name",
    "username": "new_username",
    "city": "Surat"
  }
  ```
- **Response Shape (200 OK)**:
  Returns the updated user payload.

### 3. Fetch User Profile
- **Route**: `GET /api/v1/me/profile`
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "profile-id",
      "userId": "user-id",
      "bio": "Bio content",
      "language": "en",
      "dateOfBirth": "2000-01-01T00:00:00.000Z",
      "privacyJson": {},
      "preferencesJson": {}
    }
  }
  ```

### 4. Update Profile
- **Route**: `PATCH /api/v1/me/profile`
- **Request Body**:
  ```json
  {
    "bio": "New bio statement",
    "language": "en",
    "dateOfBirth": "1995-12-15"
  }
  ```
- **Response Shape (200 OK)**:
  Returns the updated profile object.

### 5. Fetch Settings
- **Route**: `GET /api/v1/me/settings`
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "privacyJson": {},
      "preferencesJson": {},
      "notificationPreferences": [
        { "channel": "EMAIL", "type": "SECURITY", "enabled": true },
        { "channel": "PUSH", "type": "SYSTEM", "enabled": true }
      ]
    }
  }
  ```

### 6. Update Settings
- **Route**: `PATCH /api/v1/me/settings`
- **Request Body**:
  ```json
  {
    "privacyJson": { "showEmail": false },
    "notificationPreferences": [
      { "channel": "EMAIL", "type": "PROMO", "enabled": false }
    ]
  }
  ```
- **Response Shape (200 OK)**:
  Returns the updated settings view.

### 7. Deactivate Account
Soft-delete the current user account and revoke all of their active sessions.
- **Route**: `DELETE /api/v1/me`
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "success": true
    }
  }
  ```

### 8. Fetch User Public Profile by Username
Retrieve public stats, badges, and review stream of any user.
- **Route**: `GET /api/v1/users/:username/profile`
- **Auth**: Authenticated User
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "profile-id-123",
      "userId": "user-id-abc",
      "bio": "I love local shopping.",
      "user": {
        "id": "user-id-abc",
        "createdAt": "2026-06-05T21:47:35.000Z",
        "name": "Aarav Customer",
        "username": "aarav-customer",
        "avatar": {
          "url": "https://placehold.co/150"
        }
      },
      "isFollowing": false,
      "stats": {
        "reviewsCount": 5,
        "avgRatingGiven": 4.2,
        "helpfulVotes": 12,
        "shopsVisited": 3,
        "areasExplored": 2,
        "savedProductsCount": 8,
        "followingCount": 10,
        "followersCount": 15
      },
      "reviews": [],
      "whoToFollow": [
        {
          "id": "cuid-another",
          "name": "Jane Doe",
          "username": "jane_doe",
          "avatar": "https://placehold.co/150"
        }
      ]
    }
  }
  ```

### 9. Follow User
Establish a connection to follow another user.
- **Route**: `POST /api/v1/users/:userId/follow`
- **Auth**: Authenticated User
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "following": true
    }
  }
  ```

### 10. Unfollow User
Terminate the follow connection to another user.
- **Route**: `DELETE /api/v1/users/:userId/follow`
- **Auth**: Authenticated User
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "following": false
    }
  }
  ```

---

## Seed Accounts (Development Only)
Use these credentials for testing authentication and permissions:

- **Customer**: `customer@neargrab.test` / `Password123!`
- **Shopkeeper**: `shopkeeper1@neargrab.test` / `Password123!`
- **Admin**: `admin@neargrab.test` / `Password123!`
- **SuperAdmin**: `superadmin@neargrab.test` / `Password123!`
