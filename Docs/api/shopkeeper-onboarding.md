# Shopkeeper Onboarding APIs

This document outlines the API endpoints, validation rules, request payloads, and response structures for the Shopkeeper Onboarding module.

---

## Overview

The onboarding process allows a standard user (`CUSTOMER` role) to register their shop.
The wizard saves the progress in a draft shop profile (`status: "DRAFT"`), returning a complete, aggregated state representation after each step. On final submission:
1. The shop's status transitions to `PENDING_REVIEW` and its verification status to `PENDING`.
2. The user's role is upgraded to `SHOPKEEPER`.
3. Notification events are sent to both the user and system administrators.

All onboarding endpoints require client authentication (`Authorization: Bearer <token>`).

---

## 1. Get Onboarding State

### GET /api/v1/shopkeeper/onboarding
Retrieve the current onboarding wizard state for the authenticated user. If no shop registration draft exists, it returns a blank template indicating which fields are missing.

* **Response (200 OK - No draft exists):**
```json
{
  "success": true,
  "data": {
    "shop": null,
    "completion": {
      "details": false,
      "address": false,
      "contact": false,
      "business": false,
      "photos": false,
      "submittable": false,
      "missing": [
        "details.name",
        "details.username",
        "details.categoryId",
        "details.type",
        "details.description",
        "address.street",
        "address.landmark",
        "address.city",
        "address.state",
        "address.pincode",
        "address.coordinates",
        "contact.phone",
        "contact.whatsapp",
        "contact.timings",
        "business.languages",
        "photos.front",
        "photos.inside"
      ]
    }
  }
}
```

* **Response (200 OK - Draft exists):**
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "shop-123",
      "name": "Patel Grocer",
      "username": "patel-grocer",
      "slug": "patel-grocer",
      "categoryId": "cat-grocery",
      "type": "Retail Store",
      "establishedYear": 2020,
      "description": "Locally sourced organic products and daily grocery essentials.",
      "gstNumber": null,
      "panNumber": null,
      "status": "DRAFT",
      "verificationStatus": "UNVERIFIED",
      "logo": "https://res.cloudinary.com/neargrab/image/upload/logo.jpg",
      "cover": null,
      "createdAt": "2026-06-06T10:00:00.000Z",
      "updatedAt": "2026-06-06T10:15:00.000Z",
      "address": {
        "street": "12 GIDC road",
        "landmark": "Near temple",
        "city": "Navsari",
        "state": "Gujarat",
        "pincode": "396445",
        "latitude": 20.94,
        "longitude": 72.95,
        "radius": "5 km"
      },
      "contact": {
        "phone": "9876543210",
        "whatsapp": "9876543210",
        "alternatePhone": null,
        "email": "patel@example.com",
        "preferences": {
          "acceptCalls": true,
          "enableStockRequests": true,
          "receiveNotifications": true
        }
      },
      "timings": {
        "openingTime": "09:00 AM",
        "closingTime": "09:00 PM",
        "weekdays": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      },
      "business": {
        "languages": ["Gujarati", "Hindi", "English"],
        "priceRange": "Budget Friendly",
        "homeDelivery": true,
        "digitalPayments": true,
        "upiId": "patel@upi",
        "tags": ["Organic", "Daily Fresh"],
        "registrationDoc": "https://res.cloudinary.com/neargrab/image/upload/license.pdf"
      },
      "photos": [
        { "id": "m-front", "url": "https://res.cloudinary.com/neargrab/image/upload/front.jpg", "kind": "front", "sortOrder": 0 },
        { "id": "m-inside", "url": "https://res.cloudinary.com/neargrab/image/upload/inside.jpg", "kind": "inside", "sortOrder": 0 }
      ]
    },
    "completion": {
      "details": true,
      "address": true,
      "contact": true,
      "business": true,
      "photos": true,
      "submittable": true,
      "missing": []
    }
  }
}
```

---

## 2. Onboarding Step APIs

### POST /api/v1/shopkeeper/onboarding
Start the onboarding process by registering a new draft shop with initial basic details.

* **Request Body:**
```json
{
  "name": "Patel Grocer",
  "username": "patel-grocer"
}
```
* **Response (201 Created):** Returns the initial onboarding wizard state.

---

### PATCH /api/v1/shopkeeper/onboarding/details
Update primary shop details.

* **Request Body:**
```json
{
  "name": "Patel Grocer",
  "username": "patel-grocer",
  "categoryId": "cat-grocery",
  "type": "Retail Store",
  "establishedYear": 2020,
  "description": "Locally sourced organic products and daily grocery essentials.",
  "logoMediaId": "media-logo-cuid"
}
```
* **Response (200 OK):** Returns the updated onboarding wizard state.

---

### PATCH /api/v1/shopkeeper/onboarding/address
Update shop geographic details. Coordinates are required.

* **Request Body:**
```json
{
  "street": "12 GIDC road",
  "landmark": "Near temple",
  "city": "Navsari",
  "state": "Gujarat",
  "pincode": "396445",
  "coordinates": {
    "lat": 20.9416,
    "lng": 72.9522
  },
  "radius": "5 km",
  "serviceRadiusKm": 5.0
}
```
* **Response (200 OK):** Returns the updated onboarding wizard state.

---

### PATCH /api/v1/shopkeeper/onboarding/contact
Update contact details and business hours. Timings are wiped and recreated atomically on each update.

* **Request Body:**
```json
{
  "phone": "9876543210",
  "whatsapp": "9876543210",
  "alternatePhone": "9876543211",
  "email": "patel@example.com",
  "openingTime": "09:00 AM",
  "closingTime": "09:00 PM",
  "weekdays": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  "preferences": {
    "acceptCalls": true,
    "enableStockRequests": true,
    "receiveNotifications": true
  }
}
```
* **Response (200 OK):** Returns the updated onboarding wizard state.

---

### PATCH /api/v1/shopkeeper/onboarding/business
Update business-related metrics, languages, payment preferences, and license document proof.

* **Request Body:**
```json
{
  "gstNumber": "24ABCDE1234F1Z5",
  "panNumber": "ABCDE1234F",
  "languages": ["Gujarati", "Hindi", "English"],
  "priceRange": "Budget Friendly",
  "homeDelivery": true,
  "digitalPayments": true,
  "upiId": "patel@upi",
  "tags": ["Organic", "Daily Fresh"],
  "registrationDocMediaId": "media-doc-cuid"
}
```
* **Response (200 OK):** Returns the updated onboarding wizard state.

---

### PATCH /api/v1/shopkeeper/onboarding/photos
Update shop visual branding elements and storefront photos.

* **Request Body:**
```json
{
  "logoMediaId": "media-logo-cuid",
  "coverMediaId": "media-cover-cuid",
  "photos": [
    { "mediaId": "media-front-cuid", "kind": "front", "sortOrder": 0 },
    { "mediaId": "media-inside-cuid", "kind": "inside", "sortOrder": 0 }
  ]
}
```
* **Response (200 OK):** Returns the updated onboarding wizard state.

---

## 3. Submit Onboarding

### POST /api/v1/shopkeeper/onboarding/submit
Trigger the final evaluation. If all required fields are validated, the shop transitions status to `PENDING_REVIEW` and the user role is upgraded to `SHOPKEEPER`.

* **Response (200 OK - On Success):**
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "shop-123",
      "status": "PENDING_REVIEW",
      "verificationStatus": "PENDING"
    }
  }
}
```

* **Response (400 Bad Request - On Incomplete Wizard):**
```json
{
  "success": false,
  "error": {
    "statusCode": 400,
    "code": "SHOP_ONBOARDING_INCOMPLETE",
    "message": "Please complete all required fields before submitting",
    "details": {
      "missing": [
        "address.street",
        "photos.front"
      ]
    }
  }
}
```
