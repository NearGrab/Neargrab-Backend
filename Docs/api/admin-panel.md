# Admin Panel APIs

This document outlines the API endpoints, authentication requirements, roles, validation rules, request payloads, and response structures for the Neargrab Admin Panel module.

---

## Overview

All endpoints in this module (except public login) require:
1. **Authentication:** Bearer token via `Authorization: Bearer <token>`.
2. **Access Control:** Authenticated user must have one of the administrative roles: `SUPER_ADMIN`, `ADMIN`, `SUPPORT_ADMIN`, or `CONTENT_ADMIN`.
3. **Audit Logging:** Every mutating request (PATCH, POST, DELETE) will automatically create an entry in the `AuditLog` table capturing the actor, entity, IP address, user agent, and before/after states.

---

## 1. Authentication & Profile

### POST /api/v1/admin/auth/login
Authenticate administrative users.

* **Request Body:**
```json
{
  "email": "admin@neargrab.com",
  "password": "SecurePassword123"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "admin-id-cuid",
      "name": "Super Admin",
      "username": "superadmin",
      "email": "admin@neargrab.com",
      "phone": null,
      "role": "SUPER_ADMIN",
      "status": "ACTIVE",
      "avatar": null,
      "city": "Surat",
      "createdAt": "2026-06-01T10:00:00.000Z",
      "profile": null
    },
    "accessToken": "jwt-access-token-string",
    "refreshToken": "jwt-refresh-token-string"
  }
}
```

---

### GET /api/v1/admin/me
Retrieve the profile details of the currently authenticated administrator.

* **Response (200 OK):** Returns the normalized user profile structure.

---

## 2. Dashboard Analytics

### GET /api/v1/admin/dashboard
Retrieve global real-time platform dashboard stats, city metrics, lead aggregations, and recent audit logs.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "systemSummary": {
      "activeUsers": 1420,
      "totalShops": 85,
      "pendingShops": 3,
      "totalProducts": 3520
    },
    "totals": {
      "totalShops": 85,
      "verifiedShops": 82,
      "totalReviews": 412,
      "totalDirections": 2150
    },
    "topCities": [
      { "city": "Surat", "shops": 54, "leads": 1250 },
      { "city": "Navsari", "shops": 31, "leads": 900 }
    ],
    "leadsBySource": {
      "calls": 450,
      "whatsapp": 380,
      "directions": 1320
    },
    "recentActivity": [
      {
        "id": "log-1",
        "action": "VERIFY_SHOP",
        "description": "Super Admin verified shop Patel Groceries",
        "timestamp": "2026-06-08T11:45:00.000Z"
      }
    ]
  }
}
```

---

## 3. User Management

### GET /api/v1/admin/users
List and search all users registered on the platform.

* **Query Parameters:**
  *   `search` (name, email, or username)
  *   `role` (`SUPER_ADMIN`, `ADMIN`, `SUPPORT_ADMIN`, `CONTENT_ADMIN`, `SHOPKEEPER`, `CUSTOMER`)
  *   `status` (`ACTIVE`, `SUSPENDED`, `DEACTIVATED`)
  *   `city`
  *   `page` (default: 1)
  *   `limit` (default: 20)
* **Response (200 OK):** Paginated array of user objects.

---

### GET /api/v1/admin/users/:userId
Retrieve the detailed profile of a single user.

---

### PATCH /api/v1/admin/users/:userId
Update user details or status. Suspending or deactivating a user immediately revokes all of their active login sessions.

* **Request Body (All fields optional):**
```json
{
  "name": "Jane Doe",
  "role": "SUPPORT_ADMIN",
  "status": "SUSPENDED"
}
```
* **Response (200 OK):** Returns the updated user object.

---

### DELETE /api/v1/admin/users/:userId
Hard-deletes a user and cascades dependencies where applicable.

---

## 4. Shop Moderation

### GET /api/v1/admin/shops
List and filter platform stores.

* **Query Parameters:**
  *   `search` (name or username)
  *   `status` (`DRAFT`, `PENDING_REVIEW`, `ACTIVE`, `SUSPENDED`)
  *   `verificationStatus` (`PENDING`, `VERIFIED`, `REJECTED`)
  *   `city`
  *   `page`
  *   `limit`
* **Response (200 OK):** Paginated array of shop objects.

---

### GET /api/v1/admin/shops/:shopId
Retrieve detailed shop details (including contact, timing schedule, and payment configurations).

---

### PATCH /api/v1/admin/shops/:shopId/verify
Update verification status of a merchant shop storefront. This sends a platform notification to the merchant.

* **Request Body:**
```json
{
  "status": "ACTIVE",
  "verificationStatus": "VERIFIED",
  "reason": "All verification documents match standard regulations."
}
```
* **Response (200 OK):** Returns the updated shop object.

---

## 5. Product Catalog & Pinning Rules

### GET /api/v1/admin/products
Retrieve all products listing globally.

* **Query Parameters:**
  *   `search`
  *   `category`
  *   `status`
  *   `stockStatus`
  *   `city`
  *   `isPinned`
  *   `page`, `limit`

---

### PATCH /api/v1/admin/products/:productId
Allows administrators to override product details or toggle flags.

* **Request Body:**
```json
{
  "isFlagged": true,
  "status": "SUSPENDED"
}
```
* **Response (200 OK):** Returns the updated product.

---

### PATCH /api/v1/admin/products/bulk
Perform bulk actions on a list of product IDs.

* **Request Body:**
```json
{
  "productIds": ["prod-1", "prod-2"],
  "isFlagged": true,
  "status": "ACTIVE"
}
```

---

### GET /api/v1/admin/pin-rules
Retrieve rules and limits for pinning products or banners by city.

* **Response (200 OK):**
```json
[
  {
    "id": "rule-1",
    "city": "Surat",
    "targetType": "PRODUCT",
    "pinLimit": 5
  },
  {
    "id": "rule-2",
    "city": "Surat",
    "targetType": "BANNER",
    "pinLimit": 3
  }
]
```

---

### POST /api/v1/admin/products/:productId/pin
Pin a product to the top of its city search category. Validates city limit rules prior to executing.

* **Response (200 OK):** Returns the updated product with `isPinned: true`.

---

### POST /api/v1/admin/products/:productId/unpin
Unpin a product.

* **Response (200 OK):** Returns the updated product with `isPinned: false`.

---

## 6. Banner Campaigns

### GET /api/v1/admin/banners
List banner assets and configurations.

* **Query Parameters:**
  *   `search`, `city`, `section`, `status`, `device`, `page`, `limit`

---

### POST /api/v1/admin/banners
Create a new advertising banner.

* **Request Body:**
```json
{
  "title": "Summer Grocery Sale",
  "city": "Surat",
  "section": "MAIN_HERO",
  "status": "ACTIVE",
  "devices": ["MOBILE", "DESKTOP"],
  "plan": "PREMIUM",
  "startAt": "2026-06-10T00:00:00.000Z",
  "endAt": "2026-06-20T00:00:00.000Z",
  "sortOrder": 1,
  "shopId": "shop-123",
  "mediaId": "media-banner-cuid"
}
```
* **Response (200 OK):** Returns the created banner.

---

### GET /api/v1/admin/banners/metrics
Retrieve system-wide aggregated banner performance totals.

* **Response (200 OK):**
```json
{
  "totalBanners": 12,
  "activeBanners": 5,
  "totalViews": 45000,
  "totalClicks": 890,
  "averageCTR": 1.98,
  "totalRevenuePaise": 2500000
}
```

---

### GET /api/v1/admin/banners/performance
Retrieve performance metrics aggregated by day.

* **Response (200 OK):** Array of metrics by date.

---

### POST /api/v1/admin/banners/:bannerId/pin
Pins a banner. Enforces city banner limit checking.

---

### POST /api/v1/admin/banners/:bannerId/unpin
Unpins a banner.

---

## 7. App Content Management

### GET /api/v1/admin/content
Retrieve list of static/content pages (Terms, Privacy, FAQs).

---

### PATCH /api/v1/admin/content/:key
Update the JSON schema content of a static page.

* **Request Body:**
```json
{
  "title": "Terms of Service",
  "content": {
    "sections": [
      { "heading": "1. Introduction", "body": "Welcome to Neargrab..." }
    ]
  }
}
```

---

## 8. Moderation & Audit Trails

### GET /api/v1/admin/reviews
Retrieve user review feeds.

* **Query Parameters:** `status` (`APPROVED`, `FLAGGED`, `ARCHIVED`), `page`, `limit`

---

### PATCH /api/v1/admin/reviews/:reviewId
Update status/moderation state of a review.

* **Request Body:**
```json
{
  "status": "FLAGGED"
}
```

---

### GET /api/v1/admin/feedback
Retrieve platform feedback tickets.

* **Query Parameters:** `type` (`BUG`, `SUGGESTION`, `GENERAL`), `status` (`NEW`, `IN_PROGRESS`, `RESOLVED`), `page`, `limit`

---

### PATCH /api/v1/admin/feedback/:feedbackId
Update status or metadata notes on a feedback ticket.

---

### GET /api/v1/admin/audit-logs
Query system-wide mutations. Access is restricted to `SUPER_ADMIN` and `ADMIN` roles.

* **Response (200 OK):** Paginated array of audit logs.
```json
{
  "success": true,
  "data": [
    {
      "id": "log-1",
      "action": "VERIFY_SHOP",
      "entityType": "SHOP",
      "entityId": "shop-999",
      "before": { "status": "PENDING_REVIEW" },
      "after": { "status": "ACTIVE" },
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0",
      "createdAt": "2026-06-08T11:45:00.000Z",
      "actor": {
        "id": "admin-123",
        "name": "Super Admin",
        "role": "SUPER_ADMIN"
      }
    }
  ]
}
```
