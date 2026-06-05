# Phase 4 Completion: Public Discovery APIs

Phase 4 adds public product discovery, geo-location proximity filtering, explore pages, category lists, brand lists, suggestions autocomplete, and request capturing to the Neargrab backend using a feature-first architecture.

## Files Added

### 1. Shared Catalog Folder (`src/features/catalog/`)
- `product-card.mapper.js`: Implements centralized mapping logic for categories, brands, shops, banners, and products to ensure consistent response payloads.

### 2. Explore Feature Folder (`src/features/explore/`)
- `explore.routes.js`
- `explore.controller.js`
- `explore.service.js`
- `explore.schema.js`
- `explore.service.test.js`
- `explore.routes.test.js`

### 3. Search Feature Folder (`src/features/search/`)
- `search.routes.js`
- `search.controller.js`
- `search.service.js`
- `search.schema.js`
- `search.service.test.js`
- `search.routes.test.js`

### 4. Documentation
- `Docs/api/discovery.md`

## Routes Implemented

### Explore Routes (`/api/v1`)
- `GET /categories`: Public. Lists root/nested categories.
- `GET /brands`: Public. Lists active brand partners.
- `GET /explore`: Optional auth. Returns customized feed (banners, categories, top products, sections).

### Search Routes (`/api/v1`)
- `GET /search/products`: Optional auth. Performs advanced text search and multi-filtering.
- `GET /search/suggestions`: Public. Autocomplete keywords.
- `POST /search/events`: Optional auth. Tracks query analytics.
- `POST /product-requests`: Optional auth. Registers missing item requests.

## Search / Filter / Sort Proximity Behavior
- **Bounding Box Acceleration**: Coordinates (latitude, longitude, radiusKm) are mapped to a bounding box in the database before applying precise Haversine math and sorting in JavaScript.
- **Geocoding Fallback**: If coordinates are not provided but a `city` query is present, products are filtered by shop address cities. If sorting by distance is requested without coordinates, search defaults to relevance sorting.
- **Relevance Ranking**: Relevance sorting ranks results by `isPinned` (descending), `searchBoost` (descending), `ratingAvg` (descending), and `createdAt` (descending).

## Tests Added
A total of 4 new test files containing 13 tests were added:
1. `src/features/explore/explore.service.test.js` (4 tests)
2. `src/features/explore/explore.routes.test.js` (4 tests)
3. `src/features/search/search.service.test.js` (6 tests)
4. `src/features/search/search.routes.test.js` (5 tests)

Total project tests successfully passed: 92/92.

## Known Limitations
- Haversine distance calculations are computed in-memory on database candidates matching the bounding box delta. For large datasets, this approach is capped at bounding box candidate matching.
- Search suggestion event aggregates are group-by counts on raw SearchEvents and not stored in a specialized search cache index (which will be added in later phases).
