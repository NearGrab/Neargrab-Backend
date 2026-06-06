# Phase 7 Completion: Shopkeeper Onboarding

This document summarizes the completion of Phase 7 of the Neargrab backend, which implements the multi-step merchant/shopkeeper onboarding wizard. This flow allows standard users (`CUSTOMER` role) to register a shop draft and submit it for administrative review, upgrading their system role upon completion.

---

## 1. Modules Implemented

### Shopkeeper Onboarding (`src/features/shopkeeper-onboarding/`)
*   **Schemas (`onboarding.schema.js`):** Request validation rules for step-by-step wizard forms:
    *   `startDraftBody`: Basic shop name and unique username validation.
    *   `detailsBody`: Primary descriptors, category mapping, established year, and description.
    *   `addressBody`: Complete geographic details including coordinates (`lat`, `lng`) and service area radius validation.
    *   `contactBody`: Phone/WhatsApp numbers, weekly operational schedules, and notification preferences.
    *   `businessBody`: Tax IDs (GST/PAN), languages, price tier, delivery tags, and payment methods validation.
    *   `photosBody`: Storefront, interior, logo, and cover photo attachments.
*   **Mappers (`onboarding.mapper.js`):** Computes completion percentages, identifies missing fields dynamically, and serializes the combined database models into a unified wizard state.
*   **Service (`onboarding.service.js`):** Core business logic managing:
    *   **Atomic Updates:** Prisma-based transactions ensuring step changes (e.g. wiping and recreating weekly timings, languages, or tags) are atomic.
    *   **State Aggregation:** Consolidates address, contact details, payment rules, and photos into a single view.
    *   **Submission & Role Elevation:** Validates complete profiles before transitioning shop status to `PENDING_REVIEW` and upgrading the customer's role to `SHOPKEEPER`.
    *   **Notification Events:** Dispatches event triggers notifying the merchant and system administrators on successful submission.
*   **Controller (`onboarding.controller.js`):** Maps routing params to service functions.
*   **Routes (`onboarding.routes.js`):** REST API endpoints under the `/api/v1/shopkeeper/onboarding` namespace.

---

## 2. Shared Integration & Enhancements

*   **Error Registry Updates:** Utilizes standard validations and unique constraint checks (e.g., ensuring shop usernames and slugs are globally unique).
*   **Route Registration:** Registered onboarding routes within `src/routes/index.js` under `/api/v1/shopkeeper/onboarding`.

---

## 3. Verification & Testing

Comprehensive automated tests were written and verified:
*   **Service Unit Tests:** `src/features/shopkeeper-onboarding/onboarding.service.test.js`
*   **Integration Route Tests:** `src/features/shopkeeper-onboarding/onboarding.routes.test.js`

All tests pass cleanly, ensuring that draft transitions, step validations, unique checks, and role upgrading function correctly.
