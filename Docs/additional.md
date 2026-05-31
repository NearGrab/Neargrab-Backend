# Additional Backend Plan

This document covers backend structure, middleware, validation, security, jobs, testing, and operational decisions that do not belong only to DB/routes/controllers/services.

## Recommended Stack

- Runtime: Node.js 20+
- Framework: Express.js
- Database: PostgreSQL
- ORM: Prisma
- Auth: JWT access tokens plus hashed refresh-token sessions
- Validation: Zod
- Password hashing: argon2 or bcrypt
- File uploads: multer for MVP, S3/R2/Cloudinary adapter later
- Logging: pino
- Tests: Jest or Vitest + Supertest
- API docs: OpenAPI generated from route schemas or maintained in `Docs/openapi.yaml`

## Folder Structure

```text
Backend/
├── package.json
├── .env
├── .env.example
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
└── src/
    ├── server.js
    ├── app.js
    │
    ├── config/
    │   ├── env.js
    │   ├── prisma.js
    │   └── logger.js
    │
    ├── lib/
    │   ├── response.js          # success/error response helpers
    │   ├── pagination.js
    │   ├── errors.js            # AppError class, error codes
    │   └── upload.js            # multer setup
    │
    ├── middlewares/
    │   ├── requestId.js
    │   ├── auth.js              # requireAuth
    │   ├── optionalAuth.js
    │   ├── role.js              # requireRole(...roles)
    │   ├── validate.js          # Zod middleware
    │   ├── rateLimit.js
    │   ├── upload.js
    │   ├── notFound.js
    │   └── errorHandler.js
    │
    ├── features/
    │   │
    │   ├── auth/
    │   │   ├── auth.routes.js
    │   │   ├── auth.controller.js
    │   │   ├── auth.service.js
    │   │   ├── token.service.js
    │   │   ├── otp.service.js
    │   │   └── auth.schema.js
    │   │
    │   ├── user/
    │   │   ├── user.routes.js
    │   │   ├── user.controller.js
    │   │   ├── user.service.js
    │   │   └── user.schema.js
    │   │
    │   ├── explore/
    │   │   ├── explore.routes.js
    │   │   ├── explore.controller.js
    │   │   └── explore.service.js
    │   │
    │   ├── search/
    │   │   ├── search.routes.js
    │   │   ├── search.controller.js
    │   │   ├── search.service.js
    │   │   └── search.schema.js
    │   │
    │   ├── product/
    │   │   ├── product.routes.js
    │   │   ├── product.controller.js
    │   │   ├── product.service.js
    │   │   └── product.schema.js
    │   │
    │   ├── shop/
    │   │   ├── shop.routes.js
    │   │   ├── shop.controller.js
    │   │   ├── shop.service.js
    │   │   └── shop.schema.js
    │   │
    │   ├── cart/
    │   │   ├── cart.routes.js
    │   │   ├── cart.controller.js
    │   │   ├── cart.service.js
    │   │   └── cart.schema.js
    │   │
    │   ├── reservation/
    │   │   ├── reservation.routes.js
    │   │   ├── reservation.controller.js
    │   │   ├── reservation.service.js
    │   │   └── reservation.schema.js
    │   │
    │   ├── notification/
    │   │   ├── notification.routes.js
    │   │   ├── notification.controller.js
    │   │   ├── notification.service.js
    │   │   └── notification.schema.js
    │   │
    │   ├── media/
    │   │   ├── media.routes.js
    │   │   ├── media.controller.js
    │   │   └── media.service.js
    │   │
    │   ├── analytics/
    │   │   └── analytics.service.js  # called internally, no routes
    │   │
    │   ├── audit/
    │   │   └── audit.service.js      # called internally, no routes
    │   │
    │   ├── shopkeeper/
    │   │   ├── onboarding/
    │   │   │   ├── onboarding.routes.js
    │   │   │   ├── onboarding.controller.js
    │   │   │   ├── onboarding.service.js
    │   │   │   └── onboarding.schema.js
    │   │   ├── dashboard/
    │   │   │   ├── dashboard.routes.js
    │   │   │   ├── dashboard.controller.js
    │   │   │   └── dashboard.service.js
    │   │   ├── catalog/
    │   │   │   ├── catalog.routes.js
    │   │   │   ├── catalog.controller.js
    │   │   │   ├── catalog.service.js
    │   │   │   └── catalog.schema.js
    │   │   └── profile/
    │   │       ├── profile.routes.js
    │   │       ├── profile.controller.js
    │   │       ├── profile.service.js
    │   │       └── profile.schema.js
    │   │
    │   └── admin/
    │       ├── auth/
    │       │   ├── auth.routes.js
    │       │   ├── auth.controller.js
    │       │   └── auth.schema.js
    │       ├── dashboard/
    │       │   ├── dashboard.routes.js
    │       │   ├── dashboard.controller.js
    │       │   └── dashboard.service.js
    │       ├── users/
    │       │   ├── users.routes.js
    │       │   ├── users.controller.js
    │       │   ├── users.service.js
    │       │   └── users.schema.js
    │       ├── products/
    │       │   ├── products.routes.js
    │       │   ├── products.controller.js
    │       │   ├── products.service.js
    │       │   └── products.schema.js
    │       ├── banners/
    │       │   ├── banners.routes.js
    │       │   ├── banners.controller.js
    │       │   ├── banners.service.js
    │       │   └── banners.schema.js
    │       ├── content/
    │       │   ├── content.routes.js
    │       │   ├── content.controller.js
    │       │   └── content.service.js
    │       └── moderation/
    │           ├── moderation.routes.js
    │           ├── moderation.controller.js
    │           └── moderation.service.js
    │
    ├── routes/
    │   └── index.js             # mounts all feature routers
    │
    ├── jobs/
    │   ├── index.js
    │   ├── expireOtp.job.js
    │   ├── expireReservations.job.js
    │   ├── expireBanners.job.js
    │   ├── publishBanners.job.js
    │   ├── recomputeRatings.job.js
    │   └── dailyMetrics.job.js
    │
    └── constants/
        ├── roles.js
        ├── statuses.js
        └── enums.js
```

## Middleware

### Required Middleware

- `requestId.middleware.js`: attach `req.id` for logs and responses.
- `logger.middleware.js`: log method, path, status, latency, user id when present.
- `cors.middleware.js`: allow frontend/admin origins from environment.
- `helmet.middleware.js`: security headers.
- `rateLimit.middleware.js`: general API limits plus stricter auth/OTP limits.
- `json.middleware.js`: body size limits.
- `auth.middleware.js`: verify access token and attach `req.user`.
- `optionalAuth.middleware.js`: attach user when token exists, continue for guests.
- `role.middleware.js`: `requireRole(...roles)` for shopkeeper/admin routes.
- `permission.middleware.js`: optional fine-grained admin permission checks.
- `validate.middleware.js`: run Zod schemas for params/query/body.
- `upload.middleware.js`: file upload handling and type/size validation.
- `notFound.middleware.js`: 404 response.
- `error.middleware.js`: centralized error mapping.

### Role Rules

- Guest: browse landing, explore, search, product/shop public pages.
- Customer: profile, save product, cart, reviews, notifications, reservations.
- Shopkeeper: all customer abilities plus own shop/profile/catalog/dashboard.
- Admin/support/content/super admin: admin panel APIs based on permission.

## Validation

Create Zod schemas per route group:

```text
  auth.schema.js
  user.schema.js
  search.schema.js
  product.schema.js
  shop.schema.js
  cart.schema.js
  reservation.schema.js
  notification.schema.js
  shopkeeper.schema.js
  admin.schema.js
  media.schema.js
```

Rules:

- Validate all route params as cuid/uuid-like strings.
- Validate pagination: `page >= 1`, `limit <= 100`.
- Validate coordinates: latitude `-90..90`, longitude `-180..180`.
- Validate price as non-negative integer paise.
- Validate enum values with exact backend machine names; map frontend lowercase strings at the API edge if needed.
- Never trust owner ids in body; derive ownership from `req.user`.

## Response And Pagination Format

List response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 128,
    "totalPages": 7
  }
}
```

Mutation response:

```json
{
  "success": true,
  "data": {
    "id": "..."
  }
}
```

## Error Codes

Use stable machine codes:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INVALID_CREDENTIALS`
- `OTP_INVALID`
- `OTP_EXPIRED`
- `SHOP_NOT_ACTIVE`
- `PRODUCT_NOT_ACTIVE`
- `PIN_LIMIT_EXCEEDED`
- `UPLOAD_INVALID_TYPE`
- `INTERNAL_ERROR`

## Environment Variables

```text
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
UPLOAD_DRIVER=local
UPLOAD_DIR=uploads
PUBLIC_BASE_URL=http://localhost:5000
GOOGLE_CLIENT_ID=...
SMS_PROVIDER=mock
EMAIL_PROVIDER=mock
```

## Security

- Store only password hashes and token hashes.
- Rotate refresh tokens on every refresh.
- Revoke sessions on password change.
- Rate-limit login, OTP, password reset, and media upload endpoints.
- Use role checks and ownership checks together.
- For admin mutations, require admin roles and write audit logs.
- Sanitize user-provided text before rendering rich content.
- Keep exact phone/email/shop address hidden from guest-only flows if product policy requires login.

## Background Jobs

Initial jobs can run with node-cron; move to BullMQ/Redis when needed.

- Expire old OTP codes.
- Expire stale reservations.
- Expire scheduled/active banners based on `endAt`.
- Publish scheduled banners based on `startAt`.
- Recompute product/shop rating aggregates.
- Generate daily admin metrics summary.
- Send notification fanout for reservation status and stock updates.

## Seed Data

Seed data should mirror current frontend/admin mocks:

- Cities: Surat, Navsari, Valsad, Vapi, Bharuch.
- Roles/statuses from admin content data.
- Categories: Dairy, Bakery, Grocery, Household, Snacks, Personal Care, Refined, etc.
- Demo users: customer, shopkeeper, super admin.
- Demo shops: Patel General Store, Jain Kirana Store, Shree Provision Store.
- Demo products: Amul Taaza Milk, Britannia Brown Bread, Fortune Sunlite Oil, India Gate Rice, Surf Excel, Parle-G.
- Demo banners for each section/status.

## Testing Strategy

### Unit Tests

- Auth password/token/OTP services.
- Search filter/sort mapping.
- Pin-limit validation.
- Reservation state transitions.
- Role and ownership guards.

### Integration Tests

- Signup/login/refresh/logout.
- Product search and product detail.
- Shopkeeper onboarding submit.
- Shopkeeper product CRUD.
- Admin user/product/banner operations.
- Notification preferences.

### Contract Tests

- Frontend product card fields.
- Product detail fields.
- Shopkeeper catalog table fields.
- Admin user/product/banner table fields.

## API Compatibility With Current Apps

Frontend currently expects:

- Product cards: `id`, `name`, `brand`, `category`, `size`, `price`, `originalPrice`, `discount`, `store`, `verified`, `rating`, `reviewsCount`, `distance`, `inStock`, `image`.
- Product detail: `specs`, `boughtThisWeek`, `description`, `images`, `uspBadges`, `soldBy`.
- Shopkeeper product table: `id`, `name`, `sku`, `category`, `price`, `mrp`, `stockAvailable`, `stockCount`, `views`, `updatedRelative`, `image`.
- Admin product table: `shopId`, `shopName`, `city`, `stockStatus`, `status`, `isPinned`, `isFlagged`, `addedAt`.
- Admin banner table: `title`, `shopName`, `city`, `section`, `status`, `devices`, `plan`, `startAt`, `endAt`, `views`, `clicks`, `revenue`, `sortOrder`.

Services should return these shapes or route-level mappers should adapt Prisma records into these shapes.
