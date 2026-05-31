# Controllers Plan

Controllers should be thin. They validate input, call services, map service errors to HTTP responses, and return a consistent response shape:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

For errors:

```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Product not found",
    "details": {}
  }
}
```

## Controller Files

Recommended folder:

```text
src/controllers/
  auth.controller.js
  user.controller.js
  explore.controller.js
  search.controller.js
  product.controller.js
  shop.controller.js
  cart.controller.js
  reservation.controller.js
  notification.controller.js
  shopkeeper/onboarding.controller.js
  shopkeeper/dashboard.controller.js
  shopkeeper/product.controller.js
  shopkeeper/profile.controller.js
  admin/auth.controller.js
  admin/dashboard.controller.js
  admin/user.controller.js
  admin/product.controller.js
  admin/banner.controller.js
  admin/content.controller.js
  admin/moderation.controller.js
  media.controller.js
```

## AuthController

Actions:

- `signup(req, res)`: create customer account, hash password, return access/refresh tokens.
- `login(req, res)`: authenticate email/password and create session.
- `googleAuth(req, res)`: verify Google token and upsert user/auth account.
- `requestOtp(req, res)`: send OTP to phone/email.
- `verifyOtp(req, res)`: consume OTP and verify/login.
- `refresh(req, res)`: rotate refresh token.
- `logout(req, res)`: revoke current session.
- `logoutAll(req, res)`: revoke all sessions for user.
- `forgotPassword(req, res)`, `resetPassword(req, res)`.

## UserController

Actions:

- `getMe`: current user with role and shop summary.
- `updateMe`: profile basics.
- `getProfile`, `updateProfile`: customer profile page data.
- `getSettings`, `updateSettings`: settings page data.
- `deactivateAccount`: soft deactivate self.

## ExploreController

Actions:

- `getExploreFeed`: returns categories, nearby stores, top picks, active/pinned banners, and value props if served dynamically.
- `getCategories`: public category list.
- `getBrands`: public brand list.

## SearchController

Actions:

- `searchProducts`: validates query, location, filters, sort, pagination.
- `getSuggestions`: popular searches/autocomplete.
- `trackSearchEvent`: stores search analytics.
- `createProductRequest`: creates "request product" entry.

## ProductController

Actions:

- `getProduct`: product detail with sold-by shop, images, specs, badges, stock, review summary.
- `getAvailableStores`: nearby shops carrying same/similar product.
- `getSimilarProducts`: related products by category/brand/search.
- `getReviews`: paginated product reviews.
- `createReview`: authenticated review creation.
- `trackView`: product view analytics.
- `saveProduct`, `unsaveProduct`: customer saved product actions.
- `createFeedback`: product report/feedback collector.

## ShopController

Actions:

- `getShop`: public shop profile.
- `getShopProducts`: public shop product grid.
- `getShopReviews`: public shop reviews.
- `getShopUpdates`: shop update list.
- `trackLead`: address/map/call/WhatsApp/shop-profile lead.
- `createShopReview`: authenticated shop review.

## CartController

Actions:

- `getCart`, `addItem`, `updateItem`, `removeItem`, `clearCart`.
- Controllers must snapshot product price/name/image when adding to server cart.

## ReservationController

Actions:

- `createReservation`: creates request from cart or direct product.
- `listUserReservations`, `getReservation`.
- `cancelReservation`: user cancellation.
- Shopkeeper status updates live in shopkeeper reservation controller/service.

## NotificationController

Actions:

- `listNotifications`: supports tabs/type/read filters.
- `markRead`, `markAllRead`, `deleteNotification`.
- `getPreferences`, `updatePreferences`.

## Shopkeeper OnboardingController

Actions:

- `getDraft`: load current draft shop.
- `upsertDraft`: create shop draft if missing.
- `updateDetails`: shop name, username, category, type, GST, description.
- `updateAddress`: street, landmark, city, pincode, coordinates, radius.
- `updateContact`: phone, WhatsApp, weekdays, timings, preferences.
- `updateBusiness`: PAN/GST docs, languages, price range, tags, delivery/payment flags.
- `updatePhotos`: front/inside/logo/additional images.
- `submit`: validate minimum required fields, move shop to pending review, upgrade user role to shopkeeper only when appropriate.

## Shopkeeper DashboardController

Actions:

- `getDashboard`: stats, performance, low stock, recent reviews, growth tips, QR profile link.
- `listLeads`: customer lead history.
- `listReservations`: incoming reservations.
- `updateReservationStatus`: accept/reject/complete.

## Shopkeeper ProductController

Actions:

- `listProducts`: search/filter/sort/paginate own products.
- `createProduct`: product basic info, pricing, stock, tags, attributes.
- `getProduct`: own product detail.
- `updateProduct`: update editable fields.
- `deleteProduct`: soft delete.
- `updateStock`: stock availability/count/status.
- `addImage`, `removeImage`.
- `bulkUpdate`: bulk status/stock operations.

## Shopkeeper ProfileController

Actions:

- `getProfile`, `updateProfile`.
- `getTimings`, `replaceTimings`.
- `listReviews`, `replyToReview`.

## Admin Controllers

### AdminAuthController

- `login`, `logout`, `getMe`.
- Must restrict login to admin roles.

### AdminDashboardController

- `getSummary`, `getMetrics`, `getTopCities`, `getLeadsBySource`, `getRecentActivity`.

### AdminUserController

- `listUsers`, `getUser`, `updateUser`, `suspendUser`, `activateUser`.
- `listShops`, `updateShopVerification`.

### AdminProductController

- `listProducts`, `getMetrics`, `updateProduct`, `bulkUpdateProducts`.
- `getPinRules`, `updatePinRule`.

### AdminBannerController

- `listBanners`, `createBanner`, `getBanner`, `updateBanner`, `deleteBanner`.
- `getMetrics`, `getPerformance`, `getPinRules`.
- `pinBanner`, `unpinBanner`.

### AdminContentController

- `listContent`, `upsertContent`.

### AdminModerationController

- `listReviews`, `updateReviewStatus`.
- `listFeedback`, `updateFeedbackStatus`.
- `listAuditLogs`.

## MediaController

Actions:

- `uploadOne`, `uploadMany`, `deleteMedia`.
- Validates MIME type, file size, ownership, and whether the asset is currently referenced.
