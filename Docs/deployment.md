# Production Deployment & Database Migration Guide

This guide details best practices and workflows for deploying the Neargrab backend service to production environments, executing database migrations safely, and managing process configurations.

---

## 1. Deployment Prerequisites

Before launching in production, verify the following checklist:

### A. Environment Configuration
- Set `NODE_ENV=production`. This enables strict schema parsing in `env.js`, disabling fallback secrets and requiring actual keys.
- Ensure that `DATABASE_URL` is pointing to a highly-available PostgreSQL cluster.
- Set strong cryptographic secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (e.g., generated via `openssl rand -base64 32`).

### B. Database Connection Pooling
- PostgreSQL has a hard connection limit. Express instances running horizontally can easily exhaust connection limits.
- Use a connection pooler (like **PgBouncer**) in transaction mode.
- Set connection pooling parameters in the `DATABASE_URL` query string (e.g., `postgresql://...&connection_limit=10`).

### C. Media Storage
- Set `UPLOAD_DRIVER=cloudinary` (or S3-compatible driver) so that uploaded files are not lost when container nodes recycle.
- Set valid `CLOUDINARY_URLS` credentials.

---

## 2. Production Database Migration Workflow

When deploying updates that change the database schema, follow these steps to avoid downtime or service degradation:

### Safe Migration Steps
1. **Always perform a database backup before migration.**
2. **Execute migration in isolation:** Run the migration from a single worker node or pipeline container before booting the updated web servers.
3. **Command to migrate in production:**
   Use `prisma migrate deploy` instead of `prisma migrate dev`.
   ```bash
   npx prisma migrate deploy
   ```
   > [!IMPORTANT]
   > `prisma migrate deploy` runs pending migrations without interactive prompts, and will NOT drop data. Never run `migrate dev` in production.
4. **Generate Prisma Client:**
   Ensure the client is regenerated matching the schema on build:
   ```bash
   npx prisma generate
   ```

---

## 3. Best Practices & Rollback Strategies

### A. Migration Best Practices
- **Backward Compatibility:** Design schema changes to be backward compatible (add columns with default values or nullability first, deploy the code, then migrate/clean up old fields in subsequent steps). This supports zero-downtime rolling deployments.
- **Handling Table Locks:** PostgreSQL locks tables during alterations (e.g., adding a non-null column without a default value). For large tables, this can hang queries and exhaust connection pools.
  - Set timeouts on migration statements: `SET lock_timeout = '5s';`.
  - Add indexes concurrently: `CREATE INDEX CONCURRENTLY ...` using raw SQL migrations.

### B. Rollback Plan
- If a migration fails or introduces severe regressions:
  1. Roll back the web app server deployment to the previous stable release.
  2. If the schema changes were backward compatible, the old application code will run normally against the migrated schema.
  3. If you must revert the schema changes, restore the pre-deployment database dump, or execute a compensating migration:
     - Run `prisma db push` or write a custom SQL rollback script to reverse columns/tables additions.
     - Re-run `npx prisma generate`.

### C. Backup Dumps
Execute nightly and pre-migration backups using standard tools:
```bash
# Dump DB
pg_dump -U username -h host -d dbname -F c -b -v -f pre_migration_backup.dump

# Restore DB (if rollback is required)
pg_restore -U username -h host -d dbname -v pre_migration_backup.dump
```

---

## 4. Process Management & Clustering

### A. PM2 Configuration
PM2 is the recommended node process manager for virtual machines. It maintains uptime, restarts failed instances, and enables clustering.

Create a `ecosystem.config.js` in the `Backend/` root:
```javascript
module.exports = {
  apps: [
    {
      name: "neargrab-backend",
      script: "./src/server.js",
      instances: "max", // Scale to all available CPU cores
      exec_mode: "cluster", // Enable Node.js cluster mode
      env_production: {
        NODE_ENV: "production",
        PORT: 5000
      },
      max_memory_restart: "1G",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true
    }
  ]
};
```
To run:
```bash
pm2 start ecosystem.config.js --env production
```

### B. Docker setup
If deploying on Kubernetes or container engines (ECS, Render, DigitalOcean app platform):

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate

FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY . .
EXPOSE 5000
CMD [ "node", "src/server.js" ]
```
To build and run:
```bash
docker build -t neargrab-backend:latest .
docker run -d -p 5000:5000 --env-file .env neargrab-backend:latest
```
