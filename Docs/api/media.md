# Media Management APIs

This document details the endpoints for single file upload, bulk file upload, and secure deletion of media assets under the Media Management module.

---

## 1. Single File Upload

Uploads a single media asset to the active storage driver (Local or Cloudinary) and registers it in the database.

* **URL**: `/api/v1/media/upload`
* **Method**: `POST`
* **Auth Required**: Yes (Bearer Token)
* **Request Format**: `multipart/form-data`
* **Request Body**:
  * `file` (File, required): The binary file to upload.
* **Constraints**:
  * Maximum file size defined by `UPLOAD_MAX_FILE_SIZE_BYTES` (default 5MB).
  * Allowed mime types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`.
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "cju1234560000y7890abcdefg",
      "ownerId": "user_id_123",
      "url": "http://localhost:5000/uploads/1780902020211-734594257.jpg",
      "key": "1780902020211-734594257.jpg",
      "bucket": "local",
      "mimeType": "image/jpeg",
      "sizeBytes": 1024,
      "width": null,
      "height": null,
      "altText": null,
      "createdAt": "2026-06-08T07:00:00.000Z"
    }
  }
  ```
* **Error Responses**:
  * **400 Bad Request (VALIDATION_ERROR)**: File is missing or invalid type.
  * **401 Unauthorized (UNAUTHENTICATED)**: Missing or invalid authentication token.
  * **413 Payload Too Large (UPLOAD_INVALID_TYPE)**: File exceeds size limit.

---

## 2. Bulk File Upload

Uploads multiple media files in a single request (up to 10 files).

* **URL**: `/api/v1/media/upload/bulk`
* **Method**: `POST`
* **Auth Required**: Yes (Bearer Token)
* **Request Format**: `multipart/form-data`
* **Request Body**:
  * `files` (Array of Files, required): Up to 10 binary files.
* **Constraints**:
  * Maximum of 10 files per request.
  * Each file must satisfy size and mime type constraints.
* **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "cju1234560000y7890abcdefg",
        "ownerId": "user_id_123",
        "url": "http://localhost:5000/uploads/1780902020211-734594257.jpg",
        "key": "1780902020211-734594257.jpg",
        "bucket": "local",
        "mimeType": "image/jpeg",
        "sizeBytes": 1024,
        "width": null,
        "height": null,
        "altText": null,
        "createdAt": "2026-06-08T07:00:00.000Z"
      },
      {
        "id": "cju1234560000y7891abcdefh",
        "ownerId": "user_id_123",
        "url": "http://localhost:5000/uploads/1780902020212-734594258.jpg",
        "key": "1780902020212-734594258.jpg",
        "bucket": "local",
        "mimeType": "image/jpeg",
        "sizeBytes": 2048,
        "width": null,
        "height": null,
        "altText": null,
        "createdAt": "2026-06-08T07:00:00.000Z"
      }
    ]
  }
  ```
* **Error Responses**:
  * **400 Bad Request (VALIDATION_ERROR)**: No files provided, or exceeding 10 files.
  * **401 Unauthorized (UNAUTHENTICATED)**: Missing or invalid authentication token.

---

## 3. Delete Media Asset

Deletes a media asset from both the database and the physical storage driver. Performs validation to prevent removing files currently referenced by active features (avatar, shop logo/cover, review media, product images, banners, shop updates).

* **URL**: `/api/v1/media/:mediaId`
* **Method**: `DELETE`
* **Auth Required**: Yes (Bearer Token)
* **URL Parameters**:
  * `mediaId` (string, required): The CUID/ID of the media asset.
* **Rules**:
  * Only the owner of the media asset or a user with `ADMIN` / `SUPER_ADMIN` roles can delete it.
  * Deletion is blocked if the asset is linked to user avatar, shop logo/cover, product images, review media, shop photo, banner, or shop updates.
* **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "success": true
    }
  }
  ```
* **Error Responses**:
  * **403 Forbidden (MEDIA_FORBIDDEN)**: The user is not the owner and is not an admin.
  * **404 Not Found (MEDIA_NOT_FOUND)**: The media asset does not exist.
  * **400 Bad Request (MEDIA_IN_USE)**: The asset is currently linked to one or more active features.
