# Backend Implementation Checklist

This checklist is divided into phases so one developer can build the complete backend without losing the product shape. Finish each phase with tests and a working API before moving to the next.

## Phase 0: Project Setup

- [x] Install backend dependencies: Express, Prisma, @prisma/client, zod, jsonwebtoken, bcrypt/argon2, cors, helmet, pino, multer, dotenv.
- [x] Add dev dependencies: nodemon, prisma, jest/vitest, supertest, eslint/prettier if desired.
- [x] Create `src/app.js` and `src/server.js`.
- [x] Create config modules for env, Prisma client, logger.
- [x] Add `.env.example`.
- [x] Add scripts: `dev`, `start`, `test`, `prisma:generate`, `prisma:migrate`, `prisma:seed`.
- [x] Add basic `/health` route.
- [x] Add centralized response helper and error class.

## Phase 1: Prisma Schema And Seed

- [x] Create `prisma/schema.prisma`.
- [x] Add enums from `db.md`.
- [x] Add user/auth/session/OTP models.
- [x] Add shop/address/contact/timing/photo/payment/tag/language models.
- [x] Add category/brand/product/image/attribute models.
- [x] Add saved product/cart/reservation models.
- [x] Add review/feedback models.
- [x] Add notification/preference models.
- [x] Add banner/pin/content/audit models.
- [x] Add analytics models: search event, product view, shop lead, banner impression.
- [x] Add media asset model.
- [x] Run initial migration.
- [x] Write seed script with demo cities, categories, users, shops, products, banners.
- [x] Verify Prisma Studio can browse seeded data.

## Phase 2: Middleware And Infrastructure

- [ ] Add request id middleware.
- [ ] Add JSON parser, CORS, Helmet, rate limiters.
- [ ] Add pino request logging.
- [ ] Add auth and optional auth middleware.
- [ ] Add role/permission middleware.
- [ ] Add Zod validation middleware.
- [ ] Add upload middleware for local media.
- [ ] Add 404 and error middleware.
- [ ] Add pagination utility.
- [ ] Add Prisma transaction helper if needed.

## Phase 3: Authentication And User APIs

- [ ] Implement AuthService, TokenService, OtpService.
- [ ] Implement signup/login/refresh/logout.
- [ ] Implement Google auth placeholder or real verification.
- [ ] Implement OTP request/verify with mock provider.
- [ ] Implement forgot/reset password.
- [ ] Implement `/me`, profile, settings, account deactivate.
- [ ] Add unit tests for token rotation and password auth.
- [ ] Add integration tests for signup/login/refresh/logout.
- [ ] Create Docs/api/auth.md for docs on auth.

## Phase 4: Public Discovery APIs

- [ ] Implement category and brand list.
- [ ] Implement explore feed.
- [ ] Implement product search with query, filters, sort, pagination.
- [ ] Implement search suggestions.
- [ ] Implement search event tracking.
- [ ] Implement product request creation.
- [ ] Add response mappers matching current frontend product card fields.
- [ ] Add tests for search filters and sort modes.
- [ ] Docs/api/.

## Phase 5: Product And Shop Public APIs

- [ ] Implement product detail endpoint.
- [ ] Implement available stores endpoint.
- [ ] Implement similar products endpoint.
- [ ] Implement product reviews list/create.
- [ ] Implement product save/unsave.
- [ ] Implement product view tracking.
- [ ] Implement product feedback/report.
- [ ] Implement public shop profile.
- [ ] Implement shop products, shop reviews, shop updates.
- [ ] Implement shop lead tracking for map/address/call/WhatsApp.
- [ ] Add integration tests for product detail and shop profile.

## Phase 6: Cart, Reservations, Notifications

- [ ] Implement server cart get/add/update/remove/clear.
- [ ] Snapshot product price/name/shop/image when adding cart item.
- [ ] Implement reservation create from cart/direct product.
- [ ] Implement user reservation list/detail/cancel.
- [ ] Implement reservation expiration job.
- [ ] Implement notification list/read/delete.
- [ ] Implement notification preferences.
- [ ] Trigger notifications for reservation status changes and security events.
- [ ] Add tests for cart totals and reservation state transitions.

## Phase 7: Shopkeeper Onboarding

- [ ] Implement draft shop creation for a normal user.
- [ ] Implement details step.
- [ ] Implement address step with coordinates and radius.
- [ ] Implement contact/timings/preferences step.
- [ ] Implement business info/documents/languages/tags/payment step.
- [ ] Implement photos step.
- [ ] Implement submit flow with required-field validation.
- [ ] Upgrade role/status rules carefully: user can become shopkeeper after draft submit or after admin approval, based on product decision.
- [ ] Notify admins on new pending shop.
- [ ] Add integration test for complete onboarding.

## Phase 8: Shopkeeper Dashboard And Catalog

- [ ] Implement dashboard stats.
- [ ] Implement low stock alerts.
- [ ] Implement top-performing products.
- [ ] Implement recent reviews.
- [ ] Implement QR/profile URL payload.
- [ ] Implement own product list with search/filter/sort/pagination.
- [ ] Implement product create/update/delete.
- [ ] Implement product image add/remove.
- [ ] Implement stock toggle/count/status.
- [ ] Implement bulk product updates.
- [ ] Implement shopkeeper profile edit and timings replacement.
- [ ] Implement review reply.
- [ ] Add ownership tests to ensure shopkeepers cannot edit other shops.

## Phase 9: Admin Panel APIs

- [ ] Implement admin login and `/admin/me`.
- [ ] Implement admin dashboard summary, metrics, top cities, leads by source, recent activity.
- [ ] Implement users list/detail/status/role updates.
- [ ] Implement shop list and verification approval/rejection.
- [ ] Implement admin product list/metrics/update/bulk update.
- [ ] Implement product pin rules by city.
- [ ] Implement banner list/create/detail/update/delete.
- [ ] Implement banner metrics/performance.
- [ ] Implement banner pin/unpin with pin-limit validation.
- [ ] Implement content page list/update.
- [ ] Implement review and feedback moderation.
- [ ] Implement audit-log list for super admin.
- [ ] Add audit logs for every admin mutation.
- [ ] Add contract tests for admin table response shapes.

## Phase 10: Media And Upload Hardening

- [ ] Implement single and bulk media upload.
- [ ] Store local files under ignored upload directory in dev.
- [ ] Add MIME and size validation.
- [ ] Attach media to products, shops, banners, users, reviews.
- [ ] Prevent deletion of referenced media.
- [ ] Add production-ready adapter interface for S3/R2/Cloudinary.
- [ ] Add tests for invalid file type and ownership.

## Phase 11: Documentation And API Contracts

- [ ] Add OpenAPI document for every route.
- [ ] Add request/response examples for frontend, shopkeeper, and admin routes.
- [ ] Add Postman/Bruno collection.
- [ ] Add local setup guide.
- [ ] Add seed account credentials for development.
- [ ] Document all environment variables.
- [ ] Document deployment steps and migration process.

## Phase 12: Production Readiness

- [ ] Add structured logs with request id and user id.
- [ ] Add graceful shutdown.
- [ ] Add database connection health checks.
- [ ] Add rate-limit storage backed by Redis if deployed horizontally.
- [ ] Add background job runner for expiration and summary jobs.
- [ ] Add backup/migration rollback notes.
- [ ] Add monitoring hooks for errors and latency.
- [ ] Run full integration test suite.
- [ ] Connect frontend/admin apps to staging API and fix contract gaps.

## MVP Completion Definition

- [ ] Customer can browse, search, view products/shops, save products, review, receive notifications, and create a reservation.
- [ ] Shopkeeper can onboard, manage profile, manage products/stock/images, and see dashboard stats.
- [ ] Admin can login, view dashboard, manage users, verify shops, moderate products, and manage banners.
- [ ] Seed data makes the existing Frontend and Admin screens useful without manual database setup.
- [ ] All protected routes enforce auth, roles, ownership, and validation.
- [ ] The API response shapes match the current React/Vue mock data contracts.
