# Database Plan

This backend should use Prisma with PostgreSQL. The product is Neargrab: a location-based local marketplace for customers, shopkeepers, and admins. The schema must support guest discovery, authenticated customer actions, shopkeeper onboarding/catalog management, reviews, notifications, carts/reservations, admin moderation, and promoted banners.

## Core Conventions

- Primary keys: `String @id @default(cuid())` unless an external provider id is stored.
- Timestamps: every mutable model should have `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, and optional `deletedAt DateTime?` for soft delete where needed.
- Money: store as integer paise (`pricePaise`, `mrpPaise`, `revenuePaise`) plus `currency String @default("INR")`.
- Geo: for MVP use `latitude Decimal?`, `longitude Decimal?`, and indexed city/pincode fields. Later add PostGIS for radius search.
- Media: keep upload metadata in a shared `MediaAsset` table and reference it from products, shops, banners, profiles, and reviews.
- Audit: admin writes and sensitive shopkeeper actions should create `AuditLog` records.

## Enums

```prisma
enum UserRole { CUSTOMER SHOPKEEPER ADMIN SUPER_ADMIN SUPPORT_ADMIN CONTENT_ADMIN }
enum UserStatus { ACTIVE PENDING SUSPENDED DEACTIVATED }
enum AuthProvider { EMAIL GOOGLE PHONE }
enum OtpPurpose { LOGIN SIGNUP PASSWORD_RESET PHONE_VERIFY EMAIL_VERIFY }
enum ShopStatus { DRAFT PENDING_REVIEW ACTIVE REJECTED SUSPENDED CLOSED }
enum VerificationStatus { UNVERIFIED PENDING VERIFIED REJECTED }
enum ProductStatus { DRAFT PENDING_APPROVAL ACTIVE FLAGGED INACTIVE DELETED }
enum StockStatus { IN_STOCK LOW_STOCK OUT_OF_STOCK }
enum BannerStatus { DRAFT SCHEDULED ACTIVE PINNED EXPIRED INACTIVE }
enum BannerSection { TOP_HERO TOP_CAROUSEL MIDDLE_BANNER BOTTOM_BANNER }
enum DeviceTarget { MOBILE DESKTOP }
enum ReviewStatus { PUBLISHED PENDING FLAGGED HIDDEN DELETED }
enum NotificationType { SYSTEM PROMO PRODUCT SHOP REVIEW STOCK RESERVATION SECURITY }
enum NotificationChannel { IN_APP EMAIL SMS WHATSAPP PUSH }
enum LeadSource { SEARCH MAP_VIEW SHOP_PROFILE CATEGORY_BROWSE PRODUCT_PAGE BANNER OTHER }
enum ReservationStatus { DRAFT REQUESTED ACCEPTED REJECTED CANCELLED EXPIRED COMPLETED }
enum PaymentMethod { CASH UPI CARD WALLET }
```

## Users And Authentication

### User

Fields:

- `id`, `name`, `username? @unique`, `email? @unique`, `phone? @unique`
- `passwordHash?`
- `role UserRole @default(CUSTOMER)`
- `status UserStatus @default(ACTIVE)`
- `avatarId?`, `city?`, `state?`, `pincode?`
- `emailVerifiedAt?`, `phoneVerifiedAt?`, `lastLoginAt?`
- Relations: profile, auth accounts, sessions, shop, reviews, saved products, notifications, cart, reservations.

### AuthAccount

Stores Google, phone, and email provider identities.

- `id`, `userId`, `provider AuthProvider`, `providerUserId`
- `accessTokenHash?`, `refreshTokenHash?`, `expiresAt?`
- Unique: `[provider, providerUserId]`

### Session

Refresh-token/session storage.

- `id`, `userId`, `refreshTokenHash`, `userAgent?`, `ipAddress?`, `expiresAt`, `revokedAt?`

### OtpCode

For phone/email login and verification.

- `id`, `identifier`, `purpose OtpPurpose`, `codeHash`, `expiresAt`, `consumedAt?`, `attempts Int @default(0)`
- Index: `[identifier, purpose, expiresAt]`

### UserProfile

Customer profile metadata.

- `userId @unique`, `bio?`, `language?`, `dateOfBirth?`
- `privacyJson Json?`, `preferencesJson Json?`
- `impactScore Int @default(0)`

## Shops

### Shop

Represents a shopkeeper storefront.

- `id`, `ownerId @unique`
- `name`, `username @unique`, `slug @unique`
- `categoryId?`, `type?`, `establishedYear?`
- `description?`, `gstNumber?`, `panNumber?`
- `status ShopStatus @default(DRAFT)`
- `verificationStatus VerificationStatus @default(UNVERIFIED)`
- `logoId?`, `coverId?`
- `ratingAvg Decimal @default(0)`, `ratingCount Int @default(0)`
- `viewCount Int @default(0)`, `leadCount Int @default(0)`
- Relations: address, contacts, timings, photos, payment methods, products, updates, reviews, banners.

### ShopAddress

- `shopId @unique`
- `street`, `landmark?`, `city`, `state`, `pincode`
- `latitude Decimal`, `longitude Decimal`
- `serviceRadiusKm Decimal @default(1)`
- Index: `[city, pincode]`, `[latitude, longitude]`

### ShopContact

- `shopId @unique`
- `phone`, `whatsapp?`, `alternatePhone?`, `email?`
- `acceptCalls Boolean`, `enableStockRequests Boolean`, `receiveNotifications Boolean`

### ShopTiming

- `id`, `shopId`, `weekday Int`
- `opensAt String`, `closesAt String`, `isClosed Boolean @default(false)`
- Unique: `[shopId, weekday]`

### ShopPhoto

- `id`, `shopId`, `mediaId`, `kind String` (`front`, `inside`, `logo`, `additional`)
- `sortOrder Int @default(0)`

### ShopPaymentMethod

- `id`, `shopId`, `method PaymentMethod`, `upiId?`, `enabled Boolean @default(true)`

### ShopLanguage

- `id`, `shopId`, `language`
- Unique: `[shopId, language]`

### ShopTag

- `id`, `shopId`, `tag`
- Unique: `[shopId, tag]`

### ShopUpdate

- `id`, `shopId`, `title`, `body`, `mediaId?`, `publishedAt?`, `expiresAt?`

## Catalog

### Category

- `id`, `name`, `slug @unique`, `parentId?`, `icon?`, `status`
- Supports frontend categories and admin product filters.

### Brand

- `id`, `name`, `slug @unique`, `status`

### Product

Canonical product listing owned by a shop.

- `id`, `shopId`, `categoryId?`, `brandId?`
- `name`, `slug`, `sku?`
- `description?`, `size?`, `unit?`, `tags String[]`
- `pricePaise`, `mrpPaise?`, `currency`
- `status ProductStatus @default(DRAFT)`
- `stockStatus StockStatus @default(IN_STOCK)`
- `stockAvailable Boolean @default(true)`, `stockCount Int?`
- `isPinned Boolean @default(false)`, `isFlagged Boolean @default(false)`
- `ratingAvg Decimal @default(0)`, `reviewCount Int @default(0)`
- `viewCount Int @default(0)`, `searchBoost Int @default(0)`
- Unique: `[shopId, sku]`
- Index: `[status, stockStatus]`, `[categoryId]`, `[brandId]`, `[isPinned]`

### ProductImage

- `id`, `productId`, `mediaId`, `alt?`, `sortOrder Int`

### ProductAttribute

- `id`, `productId`, `key`, `value`
- Use for specs like "1 Litre", "Refined", "Sunflower Oil".

### ProductAvailability

Optional table if multiple shops sell the same canonical item later. For MVP, `Product` can remain shop-specific; create this only if product normalization is introduced.

- `id`, `canonicalProductId`, `shopId`, `pricePaise`, `mrpPaise?`, `stockStatus`, `stockCount?`

## Customer Actions

### SavedProduct

- `userId`, `productId`, `createdAt`
- Primary key: `[userId, productId]`

### Cart

- `id`, `userId @unique`, `status String @default("active")`

### CartItem

- `id`, `cartId`, `productId`, `quantity`
- Snapshot fields: `nameSnapshot`, `pricePaiseSnapshot`, `shopNameSnapshot`, `imageUrlSnapshot?`
- Unique: `[cartId, productId]`

### Reservation

Represents "offline purchase intent" or request to hold/confirm product.

- `id`, `userId`, `shopId`, `status ReservationStatus`
- `totalPaise`, `currency`, `customerNote?`, `shopkeeperNote?`
- `expiresAt?`, `acceptedAt?`, `completedAt?`, `cancelledAt?`

### ReservationItem

- `id`, `reservationId`, `productId`, `quantity`, `pricePaiseSnapshot`

### ProductRequest

For "request product" search flow.

- `id`, `userId?`, `query`, `categoryId?`, `city?`, `latitude?`, `longitude?`, `radiusKm?`, `status`

## Reviews And Feedback

### Review

- `id`, `userId`, `shopId?`, `productId?`, `reservationId?`
- `rating Int`, `comment`, `status ReviewStatus @default(PUBLISHED)`
- `verifiedPurchase Boolean @default(false)`
- Index: `[productId, status]`, `[shopId, status]`

### ReviewMedia

- `id`, `reviewId`, `mediaId`, `sortOrder`

### ReviewVote

- `userId`, `reviewId`, `value Int`
- Primary key: `[userId, reviewId]`

### Feedback

For product page feedback collector and support feedback.

- `id`, `userId?`, `type`, `subject?`, `message`, `metadata Json?`, `status`

## Notifications And Preferences

### Notification

- `id`, `userId`, `type NotificationType`, `title`, `message`
- `data Json?`, `readAt?`, `actionUrl?`
- Index: `[userId, readAt, createdAt]`

### NotificationPreference

- `id`, `userId`, `channel NotificationChannel`, `type NotificationType`
- `enabled Boolean @default(true)`
- Unique: `[userId, channel, type]`

## Admin, Content, Promotions

### Banner

- `id`, `title`, `shopId?`, `productId?`
- `city?`, `section BannerSection`, `status BannerStatus`
- `devices DeviceTarget[]`, `plan String?`, `imageId?`
- `startAt`, `endAt`, `sortOrder Int @default(0)`
- `views Int @default(0)`, `clicks Int @default(0)`, `revenuePaise Int @default(0)`
- Index: `[city, section, status, startAt, endAt]`

### PinRule

- `id`, `city`, `targetType String` (`product`, `banner`)
- `pinLimit Int @default(10)`
- Unique: `[city, targetType]`

### ContentPage

For editable landing/help/legal content if admin content management is added.

- `id`, `key @unique`, `title`, `body Json`, `status`, `publishedAt?`

### AdminPermission

- `id`, `role UserRole`, `permission`
- Unique: `[role, permission]`

### AuditLog

- `id`, `actorId?`, `action`, `entityType`, `entityId?`
- `before Json?`, `after Json?`, `ipAddress?`, `userAgent?`

## Analytics And Metrics

### SearchEvent

- `id`, `userId?`, `query`, `city?`, `latitude?`, `longitude?`, `radiusKm?`, `filters Json?`, `resultCount Int`

### ProductView

- `id`, `userId?`, `productId`, `shopId?`, `source LeadSource?`

### ShopLead

- `id`, `userId?`, `shopId`, `productId?`, `source LeadSource`
- `metadata Json?`
- Create when user opens map, address, phone, WhatsApp, or shop profile from a product/search flow.

### BannerImpression

- `id`, `bannerId`, `userId?`, `device?`, `city?`, `clickedAt?`

## Media And Uploads

### MediaAsset

- `id`, `ownerId?`
- `url`, `key`, `bucket`, `mimeType`, `sizeBytes`, `width?`, `height?`
- `altText?`, `createdAt`

## Prisma Implementation Notes

- Add indexes for text search fields: `Product.name`, `Product.sku`, `Brand.name`, `Shop.name`, `Category.name`.
- For PostgreSQL MVP, implement search with `contains` plus city/radius filters. Upgrade to full-text search or Meilisearch/Typesense after core APIs are stable.
- Keep admin metrics derived from event tables, but cache daily summaries later if dashboard queries become slow.
- Soft-delete products, shops, users, and banners where admin restoration is useful.
