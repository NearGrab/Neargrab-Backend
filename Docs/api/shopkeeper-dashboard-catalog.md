# Shopkeeper Dashboard & Catalog APIs

This document outlines the API endpoints, authentication requirements, validation rules, request payloads, and response structures for the Shopkeeper Dashboard and Catalog Management modules.

---

## Overview

All endpoints in this module require:
1. **Authentication:** Bearer token via `Authorization: Bearer <token>`.
2. **Access Control:** Authenticated user must have the `SHOPKEEPER` role.
3. **Shop Ownership:** The user must own a valid, active/pending shop profile (`ownerId = user.id`). If no active shop profile is found (or if the shop status is still `DRAFT`), the endpoints will return a `404 Not Found` or `403 Forbidden` response.

---

## 1. Dashboard & Analytics

### GET /api/v1/shopkeeper/dashboard
Retrieve aggregated analytics and summary reports for the merchant's store.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "shopProfile": {
      "id": "shop-123",
      "name": "Patel General Store",
      "username": "patelgeneralstore",
      "slug": "patel-general-store",
      "logo": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=150",
      "coverImage": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600",
      "rating": 4.6,
      "reviewCount": 56,
      "isVerified": true,
      "distance": null,
      "openingHours": "Configured",
      "description": "Your one-stop neighborhood shop for fresh groceries and daily essentials."
    },
    "stats": [
      {
        "id": "views",
        "label": "Profile Views",
        "value": "1,248",
        "growth": "+18.6%",
        "isPositive": true,
        "timeframe": "vs last 7 days",
        "trendData": [700, 750, 720, 850, 1050, 950, 1248]
      },
      {
        "id": "clicks",
        "label": "Direction Clicks",
        "value": "856",
        "growth": "+22.3%",
        "isPositive": true,
        "timeframe": "vs last 7 days",
        "trendData": [450, 480, 520, 500, 680, 600, 856]
      },
      {
        "id": "inquiries",
        "label": "Inquiries",
        "value": "124",
        "growth": "+15.8%",
        "isPositive": true,
        "timeframe": "vs last 7 days",
        "trendData": [60, 75, 80, 95, 110, 105, 124]
      },
      {
        "id": "followers",
        "label": "Followers",
        "value": "312",
        "growth": "+12.9%",
        "isPositive": true,
        "timeframe": "vs last 7 days",
        "trendData": [180, 195, 220, 210, 260, 240, 312]
      },
      {
        "id": "rating",
        "label": "Avg. Rating",
        "value": "4.6",
        "stars": 5,
        "timeframe": "From 56 reviews",
        "trendData": null
      }
    ],
    "performanceData": [
      { "date": "17 May", "Profile Views": 750, "Direction Clicks": 460, "Inquiries": 85, "Followers": 190 },
      { "date": "18 May", "Profile Views": 820, "Direction Clicks": 510, "Inquiries": 95, "Followers": 205 },
      { "date": "19 May", "Profile Views": 780, "Direction Clicks": 490, "Inquiries": 90, "Followers": 198 },
      { "date": "20 May", "Profile Views": 980, "Direction Clicks": 620, "Inquiries": 110, "Followers": 250 },
      { "date": "21 May", "Profile Views": 1120, "Direction Clicks": 710, "Inquiries": 120, "Followers": 290 },
      { "date": "22 May", "Profile Views": 1060, "Direction Clicks": 680, "Inquiries": 115, "Followers": 275 },
      { "date": "23 May", "Profile Views": 1248, "Direction Clicks": 856, "Inquiries": 124, "Followers": 312 }
    ],
    "topActions": [
      { "label": "Product Views", "value": "2,356", "growth": "+19.4%", "isPositive": true },
      { "label": "Chat Messages", "value": "98", "growth": "+17.2%", "isPositive": true },
      { "label": "Calls Received", "value": "32", "growth": "+11.1%", "isPositive": true },
      { "label": "Saved by Users", "value": "312", "growth": "+12.9%", "isPositive": true }
    ],
    "reviews": [
      {
        "id": "rev-1",
        "authorName": "Neha P.",
        "authorAvatar": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80",
        "rating": 4,
        "comment": "Good quality and always available. Shop owner is very polite.",
        "verifiedPurchase": true,
        "productId": "prod-1",
        "productName": "Fortune Oil 1L",
        "createdAt": "2026-06-05T12:00:00.000Z",
        "dateRelative": "2 days ago"
      }
    ],
    "lowStockProducts": [
      {
        "id": "prod-1",
        "name": "Fortune Sunlite Oil 1L",
        "stockLeft": 8,
        "status": "Low",
        "image": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=80"
      }
    ],
    "growthTips": [
      { "id": "tip_1", "title": "Add more products", "desc": "Shops with more products get more views." },
      { "id": "tip_2", "title": "Keep stock updated", "desc": "Updated stock builds trust and gets more inquiries." },
      { "id": "tip_3", "title": "Promote your shop", "desc": "Share your QR Code with customers to get direct leads." }
    ],
    "qrPayload": "neargrab://shops/patel-general-store"
  }
}
```

---

## 2. Profile & Timings Management

### GET /api/v1/shopkeeper/profile
Retrieve details of the merchant's own shop profile.

* **Response (200 OK):** Returns the normalized shop profile details structure.

---

### PATCH /api/v1/shopkeeper/profile
Update public storefront profile properties, contact details, payment rules, or tags.

* **Request Body (All fields optional):**
```json
{
  "name": "Patel Groceries & Fresh Store",
  "description": "Premium organic groceries and daily items.",
  "logoMediaId": "media-logo-cuid",
  "coverMediaId": "media-cover-cuid",
  "categoryId": "cat-grocery-cuid",
  "address": {
    "street": "GIDC Road, Phase 2",
    "landmark": "Near Sai Temple",
    "city": "Navsari",
    "state": "Gujarat",
    "pincode": "396445",
    "latitude": 20.9416,
    "longitude": 72.9522,
    "serviceRadiusKm": 8.5
  },
  "contact": {
    "phone": "9876543210",
    "whatsapp": "9876543210",
    "email": "patel@example.com",
    "acceptCalls": true,
    "enableStockRequests": true
  },
  "paymentMethods": [
    { "method": "CASH", "enabled": true },
    { "method": "UPI", "upiId": "patel@upi", "enabled": true }
  ],
  "languages": ["English", "Hindi", "Gujarati"],
  "tags": ["Organic", "Fast Delivery"]
}
```
* **Response (200 OK):** Returns the updated shop profile detail.

---

### GET /api/v1/shopkeeper/profile/timings
Get weekly operating schedules.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { "weekday": 0, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
    { "weekday": 1, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false }
  ]
}
```

---

### PUT /api/v1/shopkeeper/profile/timings
Replace weekly schedule operating hours. Wipes and recreates timing rows in an atomic transaction.

* **Request Body (Must specify exactly 7 days, weekday index 0 to 6):**
```json
[
  { "weekday": 0, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
  { "weekday": 1, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
  { "weekday": 2, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
  { "weekday": 3, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
  { "weekday": 4, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
  { "weekday": 5, "opensAt": "09:00", "closesAt": "21:00", "isClosed": false },
  { "weekday": 6, "opensAt": "09:00", "closesAt": "18:00", "isClosed": true }
]
```
* **Response (200 OK):** Returns the updated 7-day timing list.

---

## 3. Reviews & Leads Listing

### GET /api/v1/shopkeeper/reviews
Fetch published reviews for this shop.

* **Query Parameters:**
  *   `rating` (1-5, optional)
  *   `page` (default: 1)
  *   `limit` (default: 20)
* **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "rev-1",
      "authorName": "Neha P.",
      "authorAvatar": "https://example.com/neha.jpg",
      "rating": 4,
      "comment": "Nice products.",
      "verifiedPurchase": true,
      "productId": "prod-1",
      "productName": "Fortune Oil 1L",
      "createdAt": "2026-06-05T12:00:00.000Z",
      "dateRelative": "2 days ago"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### GET /api/v1/shopkeeper/leads
Fetch customer lead engagement history (calls, chat clicks, direction clicks).

* **Query Parameters:**
  *   `page` (default: 1)
  *   `limit` (default: 20)
* **Response (200 OK):** Returns a list of lead records mapping the user, target product (if any), action type, and time.

---

## 4. Reservation Status Updates

### GET /api/v1/shopkeeper/reservations
Retrieve incoming cart item reservation requests.

* **Query Parameters:**
  *   `status` (`REQUESTED`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `COMPLETED`, optional)
  *   `page` (default: 1)
  *   `limit` (default: 20)
* **Response (200 OK):** Paginated array of reservations with items snapshot details.

---

### PATCH /api/v1/shopkeeper/reservations/:reservationId/status
Approve, reject, or mark a reservation as complete.
*   **REQUESTED** status can transition to **ACCEPTED** or **REJECTED**.
*   **ACCEPTED** status can transition to **COMPLETED** or **CANCELLED**.
*   Any invalid transition throws a `400 Bad Request` (`RESERVATION_STATUS_TRANSITION_INVALID`).
*   Transitions trigger automated notifications to the customer.
*   Rejection automatically returns the reserved item quantities to the product stock count.

* **Request Body:**
```json
{
  "status": "ACCEPTED",
  "shopkeeperNote": "Your items are set aside at the counter."
}
```
* **Response (200 OK):** Returns the updated reservation object.

---

## 5. Product Catalog CRUD

### GET /api/v1/shopkeeper/products
Get a list of products in the merchant's inventory.

* **Query Parameters:**
  *   `q` (search name, SKU, or description, optional)
  *   `categoryId` (optional)
  *   `stockStatus` (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, optional)
  *   `page` (default: 1)
  *   `limit` (default: 20)
* **Response (200 OK):** Paginated array of inventory product items.

---

### POST /api/v1/shopkeeper/products
Add a new product to the catalog. Products are created with `ACTIVE` status by default.
*   SKUs must be unique within the shop.
*   If SKU is omitted, a unique SKU is auto-generated (`SKU-SHOP_PREFIX-RANDOM`).

* **Request Body:**
```json
{
  "name": "Fortune Sunlite Oil 1L",
  "sku": "FORTUNE-SUN-1L",
  "categoryId": "cat-grocery-cuid",
  "brandId": "brand-fortune-cuid",
  "description": "Refined sunflower oil for cooking.",
  "size": "1",
  "unit": "Litre",
  "tags": ["Cooking Oil", "Sunflower"],
  "pricePaise": 15000,
  "mrpPaise": 18000,
  "stockStatus": "IN_STOCK",
  "stockAvailable": true,
  "stockCount": 25,
  "attributes": [
    { "key": "Pack Type", "value": "Pouch" }
  ],
  "imageMediaIds": ["media-img-1-cuid"]
}
```
* **Response (200 OK):** Returns the created product object.

---

### GET /api/v1/shopkeeper/products/:productId
Get single product details.

* **Response (200 OK):** Returns product detail representation.

---

### PATCH /api/v1/shopkeeper/products/:productId
Update product attributes, prices, tags, categories, or details. Replaces attributes and images atomically.

* **Request Body:** Similar to product creation (all fields optional).
* **Response (200 OK):** Returns the updated product object.

---

### DELETE /api/v1/shopkeeper/products/:productId
Soft-deletes a product from the inventory. Sets status to `DELETED` and fills `deletedAt`.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

### PATCH /api/v1/shopkeeper/products/:productId/stock
Quickly toggle stock availability status and counts.

* **Request Body:**
```json
{
  "stockAvailable": false,
  "stockCount": 0,
  "stockStatus": "OUT_OF_STOCK"
}
```
* **Response (200 OK):** Returns the updated product object.

---

### POST /api/v1/shopkeeper/products/:productId/images
Attach an image to the product catalog details.

* **Request Body:**
```json
{
  "mediaId": "media-new-img-cuid",
  "alt": "Side profile view",
  "sortOrder": 1
}
```
* **Response (200 OK):** Returns details of the newly attached image.

---

### DELETE /api/v1/shopkeeper/products/:productId/images/:imageId
Detach/delete an image from the product.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

---

### POST /api/v1/shopkeeper/products/bulk
Perform bulk operations on multiple product IDs (e.g. bulk delete, status change, stock adjustments).

* **Request Body:**
```json
{
  "productIds": ["prod-1", "prod-2"],
  "action": "toggle_stock",
  "stockAvailable": true,
  "stockStatus": "IN_STOCK"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "count": 2
  }
}
```
