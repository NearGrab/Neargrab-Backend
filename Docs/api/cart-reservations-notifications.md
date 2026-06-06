# Cart, Reservations, and Notifications APIs

This document outlines the API endpoints, request payloads, and response structures for the Cart, Reservations, and Notifications modules in Phase 6.

---

## 1. Cart Management APIs

All cart endpoints require client authentication (`Authorization: Bearer <token>`).

### GET /api/v1/cart
Retrieve the current active shopping cart for the authenticated user. If no cart exists, a new empty cart is created.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cart-123",
    "status": "active",
    "items": [
      {
        "id": "item-456",
        "productId": "prod-789",
        "quantity": 2,
        "name": "Aashirvaad Shudh Chakki Atta",
        "pricePaise": 27500,
        "shopName": "Patel General Store",
        "imageUrl": "http://localhost:5000/uploads/atta.jpg",
        "product": {
          "id": "prod-789",
          "slug": "aashirvaad-atta-5kg",
          "name": "Aashirvaad Shudh Chakki Atta",
          "stockStatus": "IN_STOCK",
          "stockAvailable": true,
          "shop": {
            "id": "shop-1",
            "name": "Patel General Store",
            "slug": "patel-general-store"
          }
        },
        "lineTotalPaise": 55000,
        "createdAt": "2026-06-06T10:00:00.000Z"
      }
    ],
    "summary": {
      "totalItems": 2,
      "uniqueProducts": 1,
      "uniqueShops": 1,
      "subtotalPaise": 55000,
      "currency": "INR"
    }
  }
}
```

### POST /api/v1/cart/items
Add a product or increment its quantity in the shopping cart. A snapshot of the product details (price, name, shop, image) is captured at the time of adding.

* **Request Body:**
```json
{
  "productId": "prod-789",
  "quantity": 2
}
```
* **Response (200 OK):** (Returns the updated cart payload).

### PATCH /api/v1/cart/items/:itemId
Update the quantity of an item in the cart.

* **Request Body:**
```json
{
  "quantity": 5
}
```
* **Response (200 OK):** (Returns the updated cart payload).

### DELETE /api/v1/cart/items/:itemId
Remove a single item from the cart.

* **Response (200 OK):** (Returns the updated cart payload).

### DELETE /api/v1/cart
Clear all items in the user's active cart.

* **Response (200 OK):** (Returns the empty cart payload).

---

## 2. Reservation APIs

All reservation endpoints require authentication.

### POST /api/v1/reservations
Create a new reservation request. Can be created from either direct product selection or checking out items in the cart.

* **Request Body (Direct Checkout):**
```json
{
  "source": "direct",
  "productId": "prod-789",
  "quantity": 1,
  "customerNote": "Please keep this ready by 6 PM"
}
```
* **Request Body (Cart Checkout):**
```json
{
  "source": "cart",
  "shopId": "shop-1",
  "customerNote": "Please keep this ready"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "res-999",
    "status": "REQUESTED",
    "totalPaise": 27500,
    "currency": "INR",
    "customerNote": "Please keep this ready by 6 PM",
    "createdAt": "2026-06-06T10:15:00.000Z",
    "shop": {
      "id": "shop-1",
      "name": "Patel General Store",
      "slug": "patel-general-store"
    },
    "items": [
      {
        "id": "rit-999",
        "productId": "prod-789",
        "quantity": 1,
        "pricePaiseSnapshot": 27500,
        "product": {
          "id": "prod-789",
          "name": "Aashirvaad Shudh Chakki Atta",
          "slug": "aashirvaad-atta-5kg"
        }
      }
    ]
  }
}
```

### GET /api/v1/reservations
List paginated reservations for the authenticated customer.

* **Query Parameters:**
  * `status`: Optional filter by reservation status (e.g. `REQUESTED`, `ACCEPTED`, `COMPLETED`, `CANCELLED`, `EXPIRED`).
  * `page`: Page number (default: 1).
  * `limit`: Page limit (default: 20).
* **Response (200 OK):** (Returns array of reservations with standard pagination metadata).

### GET /api/v1/reservations/:reservationId
Retrieve the details of a single reservation.

* **Response (200 OK):** (Returns the single reservation payload).

### PATCH /api/v1/reservations/:reservationId/cancel
Cancel a reservation (only allowed when state is `REQUESTED` or `ACCEPTED`).

* **Request Body:**
```json
{
  "reason": "Found it cheaper nearby"
}
```
* **Response (200 OK):** (Returns the cancelled reservation payload).

### POST /api/v1/reservations/expire
Cron/admin trigger to scan and mark outdated `REQUESTED` and `ACCEPTED` reservations as `EXPIRED` if they have passed their pickup threshold (e.g., 2 hours). Restricted to administrators.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "ids": ["res-1", "res-2", "res-3"]
  }
}
```

---

## 3. Notifications & Preferences APIs

All notification endpoints require authentication.

### GET /api/v1/notifications
List paginated notifications for the user.

* **Query Parameters:**
  * `type`: Filter by type (`SYSTEM`, `PROMO`, `PRODUCT`, `SHOP`, `REVIEW`, `STOCK`, `RESERVATION`, `SECURITY`).
  * `read`: Filter by read status (`true` / `false`).
* **Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "not-111",
      "type": "RESERVATION",
      "uiType": "alerts",
      "title": "Reservation Confirmed",
      "description": "Your reservation at Patel General Store was accepted.",
      "message": "Your reservation at Patel General Store was accepted.",
      "data": {
        "reservationId": "res-999"
      },
      "actionUrl": "/reservations/res-999",
      "read": false,
      "readAt": null,
      "createdAt": "2026-06-06T10:30:00.000Z",
      "time": "10:30 AM",
      "dateGroup": "Today"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "unreadCount": 1
  }
}
```

### PATCH /api/v1/notifications/read-all
Mark all unread notifications for the user as read.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "updatedCount": 5
  }
}
```

### PATCH /api/v1/notifications/:notificationId/read
Mark a single notification as read.

* **Response (200 OK):** (Returns mapped read notification payload).

### DELETE /api/v1/notifications/:notificationId
Delete a notification record.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### GET /api/v1/notifications/preferences
Retrieve the notification preferences for all communication channels (IN_APP, EMAIL, SMS, WHATSAPP, PUSH) along with simplified frontend UI preference flags.

* **Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "preferences": [
      { "channel": "IN_APP", "type": "RESERVATION", "enabled": true },
      { "channel": "EMAIL", "type": "RESERVATION", "enabled": true }
    ],
    "ui": {
      "push": true,
      "email": true,
      "alerts": true,
      "likes": true,
      "follows": true
    }
  }
}
```

### PATCH /api/v1/notifications/preferences
Update the user's notification preferences. Supports either updating bulk preferences array or toggling a simple UI key.

* **Request Body (Bulk Update):**
```json
{
  "preferences": [
    {
      "channel": "IN_APP",
      "type": "PROMO",
      "enabled": false
    }
  ]
}
```
* **Request Body (Simple UI Toggle):**
```json
{
  "key": "email",
  "enabled": false
}
```
* **Response (200 OK):** (Returns the updated preference configuration payload).
