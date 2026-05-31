# Services Plan

Services contain business logic and Prisma queries. They should not depend on Express request/response objects.

## Service Files

```text
src/services/
  auth.service.js
  token.service.js
  otp.service.js
  user.service.js
  explore.service.js
  search.service.js
  product.service.js
  shop.service.js
  cart.service.js
  reservation.service.js
  notification.service.js
  media.service.js
  analytics.service.js
  shopkeeper/onboarding.service.js
  shopkeeper/dashboard.service.js
  shopkeeper/product.service.js
  shopkeeper/profile.service.js
  admin/dashboard.service.js
  admin/user.service.js
  admin/product.service.js
  admin/banner.service.js
  admin/content.service.js
  admin/moderation.service.js
  audit.service.js
```

## AuthService

Responsibilities:

- Create users with normalized email/phone.
- Hash and verify passwords with bcrypt/argon2.
- Upsert OAuth/phone auth accounts.
- Enforce user status checks before login.
- Call TokenService to create access/refresh token pair.
- Rotate and revoke refresh sessions.

## TokenService

Responsibilities:

- Sign JWT access tokens with user id, role, and session id.
- Hash refresh tokens before database storage.
- Verify refresh tokens and detect reuse/revoked sessions.
- Support admin and user sessions with same Session model.

## OtpService

Responsibilities:

- Generate numeric OTP codes.
- Store only `codeHash`.
- Rate-limit OTP requests by identifier/IP.
- Integrate SMS/email provider later.
- Consume OTP only once.

## UserService

Responsibilities:

- Load current user payload used by frontend stores.
- Update profile, avatar, language, privacy, and settings.
- Deactivate account safely.
- Resolve role transitions when a user becomes a shopkeeper.

## ExploreService

Responsibilities:

- Build explore page payload from categories, nearby active shops, top products, and active banners.
- Respect guest access: hide exact sensitive details if product rules require login.
- Use city/lat/lng/radius when available, otherwise default city like Navsari.

## SearchService

Responsibilities:

- Product search across product name, SKU, category, brand, shop.
- Filters: category, brand, stock status, verified shop, price range, city, radius.
- Sorts: relevance, distance, rating, price low/high, newest, highest views.
- Return products in the frontend card shape: product summary, shop summary, distance, rating, stock, image.
- Create `SearchEvent` records through AnalyticsService.

## ProductService

Responsibilities:

- Product detail assembly with images, specs, badges, sold-by shop, price, stock, rating.
- Similar product discovery.
- Available store discovery for same brand/name/category.
- Create reviews and update aggregate rating counts.
- Save/unsave product.
- Track product views.
- Product feedback/report creation.

## ShopService

Responsibilities:

- Public shop profile assembly.
- Public shop product grid.
- Shop reviews and updates.
- Lead tracking for navigation, address reveal, contact, WhatsApp, product page clicks.
- Shop review creation and aggregate rating updates.

## CartService

Responsibilities:

- Create cart on first use.
- Add/update/remove/clear items.
- Snapshot product name, price, shop, and image at add time.
- Validate active product and stock status on add/update.

## ReservationService

Responsibilities:

- Convert cart or product into offline purchase request.
- Group reservation by shop.
- Calculate totals from current product prices or snapshots.
- Expire stale requests.
- Allow user cancellation and shopkeeper accept/reject/complete transitions.
- Notify customer/shopkeeper after status changes.

## NotificationService

Responsibilities:

- Create in-app notifications for stock, reservations, reviews, security, system, promo.
- List by read/unread/type.
- Mark one/all read.
- Store notification preference matrix.
- Later fan out to email/SMS/push according to preferences.

## MediaService

Responsibilities:

- Validate file type/size.
- Upload to local storage in dev and S3/R2/Cloudinary in production.
- Create `MediaAsset`.
- Enforce owner access.
- Delete unused media.
- Generate public URLs and optional image dimensions.

## AnalyticsService

Responsibilities:

- Track search events, product views, shop leads, banner impressions/clicks.
- Provide grouped metrics for admin dashboards.
- Provide shopkeeper dashboard counts and trends.

## Shopkeeper OnboardingService

Responsibilities:

- Create/retrieve draft shop for current user.
- Persist each onboarding step independently.
- Validate username/slug uniqueness.
- Normalize weekdays/timings.
- Attach uploaded registration documents and shop photos.
- On submit: validate required fields, set `PENDING_REVIEW`, notify admins.

## Shopkeeper DashboardService

Responsibilities:

- Product count, in-stock/out-of-stock/low-stock counts.
- View and lead trends.
- Recent reviews.
- Low-stock alerts.
- Top-performing products.
- QR code target URL for shop profile.
- Growth tips based on missing images, stale stock, low response rate, etc.

## Shopkeeper ProductService

Responsibilities:

- CRUD for own shop products only.
- Search/filter/sort/paginate own catalog.
- Validate SKU uniqueness within shop.
- Manage price/MRP, stock count, status, images, attributes, tags.
- Bulk update status/stock.
- Prevent shopkeeper from editing admin-only fields like global pin/flag.

## Shopkeeper ProfileService

Responsibilities:

- Edit public profile, contacts, timings, payment methods, tags, languages, photos.
- Review reply workflow.
- Validate active shop ownership.

## Admin DashboardService

Responsibilities:

- System summary: users, shops, products, reviews, tickets/feedback, flagged content.
- Totals/trends over date ranges.
- Top cities by leads.
- Leads by source.
- Recent activity from audit/event tables.

## Admin UserService

Responsibilities:

- User list filtering by role/status/city/search.
- User suspension/reactivation.
- Role updates with permission guards.
- Shop verification approval/rejection.
- Audit every admin mutation.

## Admin ProductService

Responsibilities:

- Product moderation list.
- Update status, pin, flag, category, stock.
- Validate pin limits by city.
- Bulk product operations.
- Product metrics for admin cards.

## Admin BannerService

Responsibilities:

- Banner CRUD.
- Validate date ranges, devices, sections, plan, image.
- Enforce banner pin rules per city/section.
- Compute banner metrics and performance by section.
- Track impression/click revenue metrics.

## Admin ContentService

Responsibilities:

- Manage editable content pages/config JSON.
- Validate content keys and JSON schema for landing/legal/help areas.
- Version content later if required.

## Admin ModerationService

Responsibilities:

- Review moderation queue.
- Feedback/support triage.
- Flagged product/shop handling.
- Audit log retrieval.

## AuditService

Responsibilities:

- Record admin and sensitive shopkeeper changes.
- Capture actor id, action, entity type/id, before/after JSON, IP, user agent.
- Provide helper wrappers for service-level mutations.
