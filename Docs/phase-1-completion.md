# Phase 1 Completion

Phase 1 adds the database foundation for Neargrab. It follows `Docs/db.md` and keeps runtime API work intentionally small: only metadata and seed-preview endpoints were added so the database can be verified after migration and seeding.

## Added Files

- `prisma/schema.prisma`
- `prisma/seed.js`
- `src/controllers/meta.controller.js`
- `src/controllers/seed-preview.controller.js`
- `src/services/meta.service.js`
- `src/services/seed-preview.service.js`
- `src/routes/meta.routes.js`
- `src/routes/seed-preview.routes.js`

## Models Created

User/auth:

- `User`
- `AuthAccount`
- `Session`
- `OtpCode`
- `UserProfile`

Shop/storefront:

- `Shop`
- `ShopAddress`
- `ShopContact`
- `ShopTiming`
- `ShopPhoto`
- `ShopPaymentMethod`
- `ShopLanguage`
- `ShopTag`
- `ShopUpdate`

Catalog:

- `Category`
- `Brand`
- `Product`
- `ProductImage`
- `ProductAttribute`

Customer actions:

- `SavedProduct`
- `Cart`
- `CartItem`
- `Reservation`
- `ReservationItem`
- `ProductRequest`

Reviews/feedback:

- `Review`
- `ReviewMedia`
- `ReviewVote`
- `Feedback`

Notifications:

- `Notification`
- `NotificationPreference`

Admin/content/promotions:

- `Banner`
- `PinRule`
- `ContentPage`
- `AdminPermission`
- `AuditLog`

Analytics/media:

- `SearchEvent`
- `ProductView`
- `ShopLead`
- `BannerImpression`
- `MediaAsset`

## How To Run

From `Neargrab-Backend`:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm test
```

`DATABASE_URL` must point to a running PostgreSQL database before migration and seeding.

## Seed Data

The seed script creates demo data for:

- Cities: Navsari, Surat, Ahmedabad
- Categories: Grocery, Electronics, Stationery, Hardware, Pharmacy, Clothing
- Brands: Generic, Amul, Surf Excel, Samsung, Classmate, Fevicol
- Users, profiles, auth accounts, shops, addresses, contacts, timings, payment methods, products, images, reviews, saved products, cart, reservation, notifications, banners, pin rules, content pages, permissions, analytics, feedback, and audit logs

Seed credentials:

```text
customer@neargrab.test / Password123!
shopkeeper1@neargrab.test / Password123!
shopkeeper2@neargrab.test / Password123!
admin@neargrab.test / Password123!
superadmin@neargrab.test / Password123!
```

## Verification Endpoints

`GET /api/v1/meta`

Returns cities, categories, brands, and enum/status values useful to frontend clients.

`GET /api/v1/seed-preview`

Returns compact database counts and sample products, shops, and banners.

## Known Limitations

- Full auth, search, product, shopkeeper, admin, media upload, and notification APIs are intentionally not implemented in Phase 1.
- Radius search is modeled with latitude/longitude fields only. PostGIS or search infrastructure can be added later.
- The seed script uses placeholder image URLs and a mock local media bucket.
- Tests mock Prisma for the verification routes, so they do not prove that a live PostgreSQL database is available.

## Phase 2 Next

Phase 2 should add middleware and infrastructure:

- Request id middleware
- CORS/Helmet/rate-limit hardening
- Pino request logging improvements
- Auth and optional-auth middleware
- Role/permission middleware
- Zod validation middleware
- Upload middleware
- 404/error middleware refinements
- Pagination utility
- Prisma transaction helper if needed
