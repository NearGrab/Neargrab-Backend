# API Routes Plan

Base path: `/api/v1`

Use JSON for all normal endpoints. File upload endpoints should accept `multipart/form-data` and return `MediaAsset` records. All protected routes require `Authorization: Bearer <accessToken>`.

## Public And Health

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/health` | Process health check | Public |
| GET | `/api/v1/meta` | App config: cities, roles, statuses, banner sections, categories | Public |
| GET | `/api/v1/content/:key` | Landing/legal/help content by key | Public |

## Authentication

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/auth/signup` | Create user with email/password or phone | Public |
| POST | `/auth/login` | Login with email/password | Public |
| POST | `/auth/google` | Google OAuth login/signup | Public |
| POST | `/auth/otp/request` | Send OTP for phone/email login or verification | Public |
| POST | `/auth/otp/verify` | Verify OTP and optionally login | Public |
| POST | `/auth/refresh` | Rotate refresh token | Public |
| POST | `/auth/logout` | Revoke current session | User |
| POST | `/auth/logout-all` | Revoke all user sessions | User |
| POST | `/auth/password/forgot` | Start reset flow | Public |
| POST | `/auth/password/reset` | Complete reset flow | Public |

## Current User

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/me` | Current user, role, shop summary, profile | User |
| PATCH | `/me` | Update name, username, avatar, city | User |
| GET | `/me/profile` | Customer profile details | User |
| PATCH | `/me/profile` | Update bio, language, privacy, preferences | User |
| GET | `/me/settings` | Account/privacy/security settings | User |
| PATCH | `/me/settings` | Update preferences/settings | User |
| DELETE | `/me` | Deactivate own account | User |

## Discovery And Explore

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/explore` | Explore page payload: hero categories, nearby stores, top picks, banners | Optional |
| GET | `/categories` | List categories | Public |
| GET | `/brands` | List brands | Public |
| GET | `/search/products` | Product search with query, city, lat/lng, radius, category, brand, stock, sort | Optional |
| GET | `/search/suggestions` | Popular searches and autocomplete | Public |
| POST | `/search/events` | Track search query/result count | Optional |
| POST | `/product-requests` | User requests product not found | Optional |

## Products

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/products/:productId` | Product detail page | Optional |
| GET | `/products/:productId/stores` | Other stores selling similar/same product | Optional |
| GET | `/products/:productId/similar` | Similar products | Optional |
| GET | `/products/:productId/reviews` | Reviews list and rating breakdown | Optional |
| POST | `/products/:productId/reviews` | Create review | User |
| POST | `/products/:productId/view` | Track product view | Optional |
| POST | `/products/:productId/save` | Save product | User |
| DELETE | `/products/:productId/save` | Unsave product | User |
| POST | `/products/:productId/feedback` | Product feedback/report | Optional |

## Shops

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/shops/:shopId` | Public shop profile | Optional |
| GET | `/shops/:shopId/products` | Public shop catalog | Optional |
| GET | `/shops/:shopId/reviews` | Shop reviews | Optional |
| GET | `/shops/:shopId/updates` | Shop updates | Optional |
| POST | `/shops/:shopId/lead` | Track address/map/call/WhatsApp lead | Optional |
| POST | `/shops/:shopId/reviews` | Review shop | User |

## Cart And Reservations

Cart can remain frontend-local for first MVP, but server routes are useful once users log in.

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/cart` | Current user's cart | User |
| POST | `/cart/items` | Add item | User |
| PATCH | `/cart/items/:itemId` | Update quantity | User |
| DELETE | `/cart/items/:itemId` | Remove item | User |
| DELETE | `/cart/items` | Clear cart | User |
| POST | `/reservations` | Create offline purchase/hold request from cart or product | User |
| GET | `/reservations` | User's reservations | User |
| GET | `/reservations/:reservationId` | Reservation detail | User |
| PATCH | `/reservations/:reservationId/cancel` | Cancel request | User |

## Notifications

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/notifications` | List notifications with tab/type filters | User |
| PATCH | `/notifications/:notificationId/read` | Mark one read | User |
| PATCH | `/notifications/read-all` | Mark all read | User |
| DELETE | `/notifications/:notificationId` | Delete notification | User |
| GET | `/notification-preferences` | Preference matrix | User |
| PUT | `/notification-preferences` | Replace/update preferences | User |

## Shopkeeper Onboarding

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/shopkeeper/onboarding` | Get draft onboarding state | User |
| POST | `/shopkeeper/onboarding` | Start or update shop draft | User |
| PATCH | `/shopkeeper/onboarding/details` | Shop name, username, category, GST, description | User |
| PATCH | `/shopkeeper/onboarding/address` | Address, coordinates, radius | User |
| PATCH | `/shopkeeper/onboarding/contact` | Phone, WhatsApp, timings, preferences | User |
| PATCH | `/shopkeeper/onboarding/business` | PAN/GST/docs/languages/payment flags | User |
| PATCH | `/shopkeeper/onboarding/photos` | Attach shop images | User |
| POST | `/shopkeeper/onboarding/submit` | Submit for admin verification | User |

## Shopkeeper Dashboard

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/shopkeeper/dashboard` | Stats, trends, tips, reviews, low stock, QR data | Shopkeeper |
| GET | `/shopkeeper/profile` | Own shop profile | Shopkeeper |
| PATCH | `/shopkeeper/profile` | Update public shop profile fields | Shopkeeper |
| GET | `/shopkeeper/profile/timings` | Own shop timings | Shopkeeper |
| PUT | `/shopkeeper/profile/timings` | Replace timings | Shopkeeper |
| GET | `/shopkeeper/reviews` | Reviews for own shop/products | Shopkeeper |
| POST | `/shopkeeper/reviews/:reviewId/reply` | Reply to review | Shopkeeper |
| GET | `/shopkeeper/leads` | Customer lead/activity history | Shopkeeper |
| GET | `/shopkeeper/reservations` | Incoming requests | Shopkeeper |
| PATCH | `/shopkeeper/reservations/:reservationId/status` | Accept/reject/complete request | Shopkeeper |

## Shopkeeper Product Catalog

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/shopkeeper/products` | Own products with search/filter/sort/pagination | Shopkeeper |
| POST | `/shopkeeper/products` | Create product | Shopkeeper |
| GET | `/shopkeeper/products/:productId` | Own product detail | Shopkeeper |
| PATCH | `/shopkeeper/products/:productId` | Update product | Shopkeeper |
| DELETE | `/shopkeeper/products/:productId` | Soft-delete product | Shopkeeper |
| PATCH | `/shopkeeper/products/:productId/stock` | Toggle stock, stock count, stock status | Shopkeeper |
| POST | `/shopkeeper/products/:productId/images` | Attach product image | Shopkeeper |
| DELETE | `/shopkeeper/products/:productId/images/:imageId` | Remove product image | Shopkeeper |
| POST | `/shopkeeper/products/bulk` | Bulk status/stock updates | Shopkeeper |

## Media

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/media` | Upload one file | User |
| POST | `/media/bulk` | Upload multiple files | User |
| DELETE | `/media/:mediaId` | Delete owned unused media | User |

## Admin Auth

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/admin/auth/login` | Admin login | Public |
| POST | `/admin/auth/logout` | Revoke admin session | Admin |
| GET | `/admin/me` | Current admin profile/permissions | Admin |

## Admin Dashboard

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/admin/dashboard/summary` | Active users, shops, stock, reviews, tickets, flagged content | Admin |
| GET | `/admin/dashboard/metrics` | Totals and trends | Admin |
| GET | `/admin/dashboard/top-cities` | Lead totals by city | Admin |
| GET | `/admin/dashboard/leads-by-source` | Lead source split | Admin |
| GET | `/admin/dashboard/recent-activity` | Audit/activity stream | Admin |

## Admin Users

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/admin/users` | List users with search/status/role/city filters | Admin |
| GET | `/admin/users/:userId` | User detail | Admin |
| PATCH | `/admin/users/:userId` | Update status/role/basic info | Admin |
| POST | `/admin/users/:userId/suspend` | Suspend user | Admin |
| POST | `/admin/users/:userId/activate` | Reactivate user | Admin |
| GET | `/admin/shops` | List shops and verification statuses | Admin |
| PATCH | `/admin/shops/:shopId/verification` | Approve/reject shop | Admin |

## Admin Products

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/admin/products` | Product management list | Admin |
| GET | `/admin/products/metrics` | Product metrics cards | Admin |
| PATCH | `/admin/products/:productId` | Update status, pin, flag, category, stock | Admin |
| POST | `/admin/products/bulk` | Bulk status/pin/flag updates | Admin |
| GET | `/admin/products/pin-rules` | Current product pin limits by city | Admin |
| PUT | `/admin/products/pin-rules/:city` | Update product pin limit | Admin |

## Admin Banners

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/admin/banners` | List banners with filters | Admin |
| POST | `/admin/banners` | Create banner | Admin |
| GET | `/admin/banners/metrics` | Banner metrics cards | Admin |
| GET | `/admin/banners/performance` | Views/clicks by section | Admin |
| GET | `/admin/banners/pin-rules` | Banner pin limits by city | Admin |
| GET | `/admin/banners/:bannerId` | Banner detail | Admin |
| PATCH | `/admin/banners/:bannerId` | Update banner | Admin |
| DELETE | `/admin/banners/:bannerId` | Delete or deactivate banner | Admin |
| POST | `/admin/banners/:bannerId/pin` | Pin banner with city limit validation | Admin |
| POST | `/admin/banners/:bannerId/unpin` | Unpin banner | Admin |

## Admin Content And Moderation

| Method | Route | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/admin/content` | List editable content pages/config | Content admin |
| PUT | `/admin/content/:key` | Update content JSON/body | Content admin |
| GET | `/admin/reviews` | Review moderation queue | Support/admin |
| PATCH | `/admin/reviews/:reviewId` | Hide/publish/flag review | Support/admin |
| GET | `/admin/feedback` | Feedback/support submissions | Support/admin |
| PATCH | `/admin/feedback/:feedbackId` | Update feedback status | Support/admin |
| GET | `/admin/audit-logs` | Audit log list | Super admin |
