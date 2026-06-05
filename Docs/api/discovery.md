# Public Discovery APIs

This document details endpoints for category lists, brand lists, home feed (explore) generation, multi-filter catalog searching, autocomplete suggestions, analytics logging, and user request collection.

---

## 1. Category List

Retrieves active categories.

* **URL**: `/api/v1/categories`
* **Method**: `GET`
* **Auth Required**: No (Public)
* **Query Parameters**:
  * `includeCounts` (boolean, optional, default: `false`): Include `productCount` field.
  * `parentId` (string, optional): Filter by parent category ID.
  * `status` (string, optional, default: `"active"`): Filter by status.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "cat_1",
        "name": "Grocery",
        "slug": "grocery",
        "icon": "grocery-icon",
        "parentId": null,
        "productCount": 12
      }
    ]
  }
  ```

---

## 2. Brand List

Retrieves active brands.

* **URL**: `/api/v1/brands`
* **Method**: `GET`
* **Auth Required**: No (Public)
* **Query Parameters**:
  * `includeCounts` (boolean, optional, default: `false`): Include `productCount` field.
  * `q` (string, optional): Search brand name (case-insensitive substring match).
  * `status` (string, optional, default: `"active"`): Filter by status.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "brand_1",
        "name": "Amul",
        "slug": "amul",
        "productCount": 4
      }
    ]
  }
  ```

---

## 3. Explore Feed

Generates a customized discover/home feed.

* **URL**: `/api/v1/explore`
* **Method**: `GET`
* **Auth Required**: No (Optional Auth)
* **Query Parameters**:
  * `city` (string, optional): Filter by city name.
  * `latitude` (float, optional): Latitude for geo-location.
  * `longitude` (float, optional): Longitude for geo-location.
  * `radiusKm` (float, optional, default: `10`): Max search radius.
  * `device` (string, optional, enum: `["WEB", "IOS", "ANDROID", "ALL"]`): Device target filter.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "city": "Navsari",
      "categories": [],
      "nearbyShops": [],
      "topProducts": [],
      "pinnedProducts": [],
      "banners": [],
      "sections": {
        "topPicks": [],
        "newArrivals": [],
        "popularNearby": []
      }
    }
  }
  ```

---

## 4. Product Search

Search products using queries, coordinates, and filters.

* **URL**: `/api/v1/search/products`
* **Method**: `GET`
* **Auth Required**: No (Optional Auth)
* **Query Parameters**:
  * `q` (string, optional): Text search query.
  * `city` (string, optional): Filter by city.
  * `latitude` (float, optional): Latitude coordinates.
  * `longitude` (float, optional): Longitude coordinates.
  * `radiusKm` (float, optional): Radius in Kilometers.
  * `categoryId` / `categorySlug` (string, optional): Category filters.
  * `brandId` / `brandSlug` (string, optional): Brand filters.
  * `stockStatus` (string, optional, enum: `["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]`).
  * `inStock` (boolean, optional): In-stock flag.
  * `minPricePaise` / `maxPricePaise` (integer, optional): Price boundaries.
  * `sort` (string, optional, default: `"relevance"`, enum: `["relevance", "distance", "rating", "price_asc", "price_desc", "newest", "popular"]`).
  * `page` (integer, optional, default: `1`).
  * `limit` (integer, optional, default: `20`, max: `100`).
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "prod_1",
        "name": "Amul Butter 500g",
        "slug": "amul-butter-500g",
        "sku": "AMUL-BUTTER-500",
        "pricePaise": 28000,
        "mrpPaise": 30000,
        "currency": "INR",
        "size": "500g",
        "unit": "pack",
        "stockStatus": "IN_STOCK",
        "stockAvailable": true,
        "ratingAvg": 4.5,
        "reviewCount": 12,
        "viewCount": 100,
        "isPinned": false,
        "image": {
          "id": "media_1",
          "url": "https://...",
          "alt": "Amul Butter 500g"
        },
        "category": {
          "id": "cat_1",
          "name": "Grocery",
          "slug": "grocery"
        },
        "brand": {
          "id": "brand_1",
          "name": "Amul",
          "slug": "amul"
        },
        "shop": {
          "id": "shop_1",
          "name": "Patel Daily Mart",
          "slug": "patel-daily-mart",
          "city": "Navsari",
          "pincode": "396445",
          "verificationStatus": "VERIFIED"
        },
        "distanceKm": 1.2
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPreviousPage": false,
      "filters": {
        "q": "butter",
        "city": "Navsari"
      },
      "sort": "relevance"
    }
  }
  ```

---

## 5. Search Suggestions

Retrieves autocomplete suggestions matching a partial prefix.

* **URL**: `/api/v1/search/suggestions`
* **Method**: `GET`
* **Auth Required**: No (Public)
* **Query Parameters**:
  * `q` (string, required): Partial query prefix.
  * `city` (string, optional): Filter by city.
  * `limit` (integer, optional, default: `10`): Max results.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "products": [
        {
          "label": "Amul Butter 500g",
          "value": "Amul Butter 500g",
          "type": "product"
        }
      ],
      "categories": [],
      "brands": [],
      "popular": []
    }
  }
  ```

---

## 6. Search Event Tracking

Logs a search event to database analytics.

* **URL**: `/api/v1/search/events`
* **Method**: `POST`
* **Auth Required**: No (Optional Auth - links userId if authenticated)
* **Body Parameters**:
  * `query` (string, required)
  * `city` (string, optional)
  * `latitude` (float, optional)
  * `longitude` (float, optional)
  * `radiusKm` (float, optional)
  * `filters` (object, optional)
  * `resultCount` (integer, required)
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "search_event_id_123"
    }
  }
  ```

---

## 7. Product Request Creation

Submits requests for items that are missing or out-of-stock.

* **URL**: `/api/v1/product-requests`
* **Method**: `POST`
* **Auth Required**: No (Optional Auth)
* **Body Parameters**:
  * `query` (string, required)
  * `categoryId` (string, optional)
  * `productId` (string, optional)
  * `city` (string, optional)
  * `latitude` (float, optional)
  * `longitude` (float, optional)
  * `radiusKm` (float, optional)
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "request_id_abc",
      "query": "iPhone 16 charger",
      "status": "open",
      "city": "Navsari",
      "createdAt": "2026-06-05T22:00:00.000Z"
    }
  }
  ```
