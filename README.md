# SEO & GEO Visibility Dashboard

Multi-site monitoring for Google SEO, GA4, PageSpeed, technical SEO, AI visibility and AI crawler logs. The current baseline includes a production-shaped UI, multi-tenant Prisma schema, encrypted integration storage utilities, JWT cookie sessions, provider adapter contracts, worker schedules and Docker deployment.

## Local development

```powershell
Copy-Item .env.example .env
npm install
npm run db:generate
npm run dev
```

`npm run dev` automatically starts the local PostgreSQL and Redis dependencies from `docker-compose.yml`. It uses Windows Docker when available, otherwise it falls back to Docker inside WSL.

Open `http://localhost:3000`. The UI starts empty and shows configuration entry points until real sites, integrations and sync results are saved.

## Docker deployment

```powershell
Copy-Item .env.example .env
# Replace every secret and initial administrator credential in .env
docker compose up --build -d
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

Services: Next.js app, PostgreSQL, Redis and BullMQ worker. Persistent data is stored in named Docker volumes.

## Database

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
```

The seed command creates only the initial administrator and a primary workspace. It does not create sites, metrics, keywords, reports, logs or other business records.

## Security

- Set a unique `ENCRYPTION_KEY` and `SESSION_SECRET`.
- Integration configuration is encrypted with AES-256-GCM before storage.
- API credentials must never be returned by API serializers; return connection status and masked metadata only.
- Change `ADMIN_PASSWORD` before first deployment.
- Apply TLS and rate limiting at the reverse proxy in production.

## Backup and restore

```powershell
npm run backup
npm run restore -- -BackupDirectory .\backups\20260611-120000
```

Backups include a PostgreSQL dump plus existing `uploads`, `reports` and `logs` directories. Test restores before production migration.

## Quality checks

```powershell
npm run lint
npm test
npm run build
```

External APIs are represented by typed adapters with timeout/retry support. Live OAuth flows and provider-specific synchronization should be enabled only after credentials are configured; modules render empty states when a provider is absent.
