# Public Product and Shop APIs Documentation

This document describes the public and authenticated endpoints for Products (`/api/v1/products`) and Shops (`/api/v1/shops`).

---

## Product Endpoints (`/api/v1/products`)

### 1. Fetch Product Detail
Retrieve full product details including image gallery, specifications, parent shop details, category, brand, and review rating summary.
- **Route**: `GET /api/v1/products/:productId`
- **Auth**: Public (Optional Auth: checks if product is saved by user if authenticated)
- **Params**:
  - `productId`: ID or slug of the product.
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "prod-1",
      "name": "Amul Butter 500g",
      "slug": "amul-butter-500g",
      "sku": "AMUL-BUTTER-500",
      "description": "Premium salted butter",
      "size": "500g",
      "unit": "pack",
      "tags": ["dairy", "butter"],
      "pricePaise": 28000,
      "mrpPaise": 30000,
      "currency": "INR",
      "status": "ACTIVE",
      "stockStatus": "IN_STOCK",
      "stockAvailable": true,
      "stockCount": 100,
      "ratingAvg": 4.5,
      "reviewCount": 12,
      "viewCount": 120,
      "isSaved": false,
      "images": [
        {
          "id": "media-1",
          "url": "https://neargrab-uploads.s3.amazonaws.com/butter.jpg",
          "alt": "Amul Butter 500g"
        }
      ],
      "attributes": [
        {
          "key": "Fat Content",
          "value": "80%"
        }
      ],
      "category": {
        "id": "cat-1",
        "name": "Grocery",
        "slug": "grocery"
      },
      "brand": {
        "id": "brand-1",
        "name": "Amul",
        "slug": "amul"
      },
      "shop": {
        "id": "shop-1",
        "name": "Patel Daily Mart",
        "slug": "patel-daily-mart",
        "verificationStatus": "VERIFIED"
      },
      "reviewSummary": {
        "average": 4.5,
        "count": 12,
        "breakdown": {
          "5": 8,
          "4": 3,
          "3": 1,
          "2": 0,
          "1": 0
        }
      }
    }
  }
  ```

### 2. Available Stores (Locator)
Find other stores selling the same or similar products.
- **Route**: `GET /api/v1/products/:productId/stores`
- **Auth**: Public
- **Params**:
  - `productId`: ID or slug of reference product.
- **Query Parameters**:
  - `city` (string, optional): Filter by city name.
  - `latitude` (float, optional): Latitude for geo distance.
  - `longitude` (float, optional): Longitude for geo distance.
  - `radiusKm` (float, optional, max 100): Geolocation radius.
  - `page` (integer, optional, default: 1)
  - `limit` (integer, optional, default: 20)
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "product": {
          "id": "prod-2",
          "name": "Amul Butter 500g",
          "slug": "amul-butter-500g",
          "pricePaise": 28500,
          "stockStatus": "IN_STOCK"
        },
        "shop": {
          "id": "shop-2",
          "name": "Surat Super Store",
          "slug": "surat-super-store",
          "verificationStatus": "VERIFIED",
          "distanceKm": 1.2
        },
        "distanceKm": 1.2,
        "pricePaise": 28500,
        "stockStatus": "IN_STOCK"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
  ```

### 3. Similar Products
Get a list of active products in the same category or brand.
- **Route**: `GET /api/v1/products/:productId/similar`
- **Auth**: Public
- **Params**:
  - `productId`: ID or slug of reference product.
- **Query Parameters**:
  - `city` (string, optional): Filter by shop city.
  - `limit` (integer, optional, default: 10)
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "prod-3",
        "name": "Amul Cheese 200g",
        "slug": "amul-cheese-200g",
        "pricePaise": 14000,
        "stockStatus": "IN_STOCK",
        "shop": {
          "id": "shop-1",
          "name": "Patel Daily Mart"
        }
      }
    ]
  }
  ```

### 4. List Product Reviews
Retrieve paginated reviews for a product.
- **Route**: `GET /api/v1/products/:productId/reviews`
- **Auth**: Public
- **Params**:
  - `productId`: ID or slug.
- **Query Parameters**:
  - `page` (integer, optional, default: 1)
  - `limit` (integer, optional, default: 20)
  - `rating` (integer, optional): Filter by star rating (1-5).
  - `sort` (string, optional, enum: `["newest", "oldest", "rating_high", "rating_low"]`)
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "rev-1",
        "rating": 5,
        "comment": "Super fresh!",
        "verifiedPurchase": true,
        "createdAt": "2026-06-06T15:00:00.000Z",
        "user": {
          "id": "user-123",
          "name": "Jane Doe",
          "avatar": "https://..."
        },
        "media": [
          {
            "id": "media-rev-1",
            "url": "https://..."
          }
        ]
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
  ```

### 5. Create Product Review
Submit a review for a product.
- **Route**: `POST /api/v1/products/:productId/reviews`
- **Auth**: Authenticated User
- **Params**:
  - `productId`: ID or slug.
- **Request Body**:
  ```json
  {
    "rating": 5,
    "comment": "Very nice product, fresh stock",
    "reservationId": "optional-completed-reservation-id",
    "mediaIds": []
  }
  ```
- **Response Shape (200 OK)**:
  Returns the created review details.

### 6. Save/Unsave Product
Save or unsave product in user's favorites list (idempotent).
- **Route**: `POST /api/v1/products/:productId/save` (Save)
- **Route**: `DELETE /api/v1/products/:productId/save` (Unsave)
- **Auth**: Authenticated User
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "saved": true
    }
  }
  ```

### 7. Track Product View
Increment view counters and write page views.
- **Route**: `POST /api/v1/products/:productId/view`
- **Auth**: Public (Optional Auth: captures user ID if logged in)
- **Request Body**:
  ```json
  {
    "source": "SEARCH",
    "shopId": "shop-123"
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

### 8. Product Feedback / Report
Submit reports or feedback regarding a product's details.
- **Route**: `POST /api/v1/products/:productId/feedback`
- **Auth**: Public (Optional Auth)
- **Request Body**:
  ```json
  {
    "type": "PRODUCT_REPORT",
    "subject": "Incorrect Price",
    "message": "MRP shown is wrong.",
    "metadata": {}
  }
  ```
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "feedback-id-cuid"
    }
  }
  ```

---

## Shop Endpoints (`/api/v1/shops`)

### 1. Fetch Public Shop Profile
Retrieve public shop metrics, addressing, timings, contacts, tags, and carousel images.
- **Route**: `GET /api/v1/shops/:shopId`
- **Auth**: Public
- **Params**:
  - `shopId`: ID or slug of the shop.
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "shop-1",
      "name": "Patel Daily Mart",
      "username": "patel-daily-mart",
      "slug": "patel-daily-mart",
      "description": "Full grocery and dairy supplies",
      "status": "ACTIVE",
      "verificationStatus": "VERIFIED",
      "ratingAvg": 4.5,
      "ratingCount": 12,
      "viewCount": 100,
      "leadCount": 15,
      "category": {
        "id": "cat-1",
        "name": "Grocery",
        "slug": "grocery"
      },
      "logo": {
        "id": "logo-1",
        "url": "https://..."
      },
      "cover": {
        "id": "cover-1",
        "url": "https://..."
      },
      "address": {
        "street": "12 Bazar Street",
        "landmark": "Near Clock Tower",
        "city": "Navsari",
        "state": "Gujarat",
        "pincode": "396445",
        "latitude": 20.94,
        "longitude": 72.95,
        "serviceRadiusKm": 3.0
      },
      "contact": {
        "phone": "9876543210",
        "whatsapp": "9876543210",
        "acceptCalls": true
      },
      "timings": [
        {
          "weekday": 1,
          "opensAt": "09:00",
          "closesAt": "21:00",
          "isClosed": false
        }
      ],
      "photos": [],
      "paymentMethods": [
        {
          "method": "UPI",
          "upiId": "patel@upi",
          "enabled": true
        }
      ],
      "languages": ["English", "Hindi", "Gujarati"],
      "tags": ["Grocery", "Organic", "Home Delivery"],
      "stats": {
        "productCount": 150,
        "reviewCount": 12
      }
    }
  }
  ```

### 2. Shop Products (Catalog)
Search and filter products matching a specific store storefront.
- **Route**: `GET /api/v1/shops/:shopId/products`
- **Auth**: Public
- **Query Parameters**:
  - `q` (string, optional): Search keyword.
  - `categoryId` / `brandId` (string, optional)
  - `stockStatus` (string, optional)
  - `inStock` (boolean, optional)
  - `minPricePaise` / `maxPricePaise` (integer, optional)
  - `sort` (string, optional, enum: `["relevance", "rating", "price_asc", "price_desc", "newest", "popular"]`)
  - `page` / `limit` (integer, optional)
- **Response Shape (200 OK)**:
  Returns standard paginated array of product cards.

### 3. List Shop Reviews
Retrieve reviews posted for the store.
- **Route**: `GET /api/v1/shops/:shopId/reviews`
- **Auth**: Public
- **Query Parameters**:
  - `page` / `limit` / `sort`
- **Response Shape (200 OK)**:
  Returns paginated review items.

### 4. Create Shop Review
Add reviews for a store.
- **Route**: `POST /api/v1/shops/:shopId/reviews`
- **Auth**: Authenticated User
- **Request Body**:
  ```json
  {
    "rating": 5,
    "comment": "Extremely fast service!",
    "reservationId": "optional-reservation-id",
    "mediaIds": []
  }
  ```
- **Response Shape (200 OK)**:
  Returns created review record.

### 5. Shop Updates (Feed)
Retrieve messages or deals broadcasted by the shop.
- **Route**: `GET /api/v1/shops/:shopId/updates`
- **Auth**: Public
- **Query Parameters**:
  - `page` / `limit`
- **Response Shape (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "update-1",
        "shopId": "shop-123",
        "title": "Diwali Offer",
        "body": "Flat 10% off on all sweets today!",
        "publishedAt": "2026-06-06T10:00:00.000Z",
        "expiresAt": null,
        "createdAt": "2026-06-06T10:00:00.000Z",
        "media": null
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false
    }
  }
  ```

### 6. Track Shop Lead
Log lead analytics (call clicks, whatsapp click, direction open etc).
- **Route**: `POST /api/v1/shops/:shopId/lead`
- **Auth**: Public (Optional Auth)
- **Request Body**:
  ```json
  {
    "source": "SHOP_PROFILE",
    "productId": "optional-product-id",
    "action": "WHATSAPP_CLICK",
    "metadata": {}
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
