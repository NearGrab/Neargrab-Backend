# Neargrab Backend

The hyper-local product discovery platform backend service. Built with Node.js, Express, Prisma, and PostgreSQL.

---

## System Prerequisites

Before starting, ensure you have the following installed on your system:
- **Node.js**: `v18.x` or `v20.x` (LTS recommended)
- **npm**: `v9.x` or higher
- **PostgreSQL**: `v14` or higher (configured and running locally or remotely)
- **Operating System**: Linux/macOS/Windows

---

## Local Development Setup

Follow these steps to set up the backend service locally:

### 1. Install Dependencies
Navigate to the `Backend` directory and install the Node.js packages:
```bash
npm install
```

### 2. Configure Environment Variables
Create a local `.env` file by copying the template file:
```bash
cp .env.example .env
```
Open `.env` and fill in your PostgreSQL database details, JWT secrets, and other settings. See [Docs/environment.md](Docs/environment.md) for full descriptions.

### 3. Database Initialization
Generate the Prisma Client, run migrations to establish database schemas, and seed demo records:
```bash
# Generate the Prisma Client
npm run prisma:generate

# Execute migrations to the database
npm run prisma:migrate

# Seed demo datasets
npm run prisma:seed
```

### 4. Spin Up the Development Server
Start the server in hot-reload mode:
```bash
npm run dev
```
The server will boot by default on [http://localhost:5000](http://localhost:5000). You can verify its health via [http://localhost:5000/health](http://localhost:5000/health).

### 5. Run Test Suites
Validate the codebase against integration and unit test packages:
```bash
npm test
```

---

## Seed Accounts & Testing Credentials

The database seeding scripts create the following default administrative and customer credentials for testing (password is uniform for all):

- **Common Password**: `Password123!`

| Role / User Profile | Email Identifier | Usage / Scope |
| :--- | :--- | :--- |
| **Customer** | `customer@neargrab.test` | Public exploration, cart management, checking out reservations. |
| **Shopkeeper 1** | `shopkeeper1@neargrab.test` | Managing "Patel Daily Mart" in Navsari. Add products, accept reservations. |
| **Shopkeeper 2** | `shopkeeper2@neargrab.test` | Managing "Shah Electronics Hub" in Surat. |
| **Admin** | `admin@neargrab.test` | Verify merchant shops, pin products, moderate content. |
| **Super Admin** | `superadmin@neargrab.test` | Full administrative credentials, including viewing mutation audit logs. |

---

## API Documentation

- **OpenAPI 3.0 Specification**: Found in [Docs/openapi.yaml](Docs/openapi.yaml)
- **Postman API Collection**: Load [Docs/neargrab.postman_collection.json](Docs/neargrab.postman_collection.json) directly in Postman or Bruno.
- **Module Details**:
  - [Authentication & User APIs](Docs/api/auth.md)
  - [Public Discovery APIs](Docs/api/discovery.md)
  - [Product & Shop APIs](Docs/api/product-shop.md)
  - [Cart & Reservations](Docs/api/cart-reservations-notifications.md)
  - [Shopkeeper Onboarding Wizard](Docs/api/shopkeeper-onboarding.md)
  - [Shopkeeper Dashboard Catalog](Docs/api/shopkeeper-dashboard-catalog.md)
  - [Admin Moderation Console](Docs/api/admin-panel.md)
  - [Media Management & Uploads](Docs/api/media.md)
