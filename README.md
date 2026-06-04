# CareMind AI

TypeScript/Node.js backend for CareMind AI (MVP). Multi-tenant healthcare platform with per-organization PostgreSQL databases, AI-assisted consultations, document processing, and doctor approval workflows.

Frontend is out of scope for this repository; all API code lives in `backend/`.

---

## Architecture at a glance

| Layer | Role |
|--------|------|
| **Central DB** | Organizations, users, refresh tokens (control plane) |
| **Tenant DB** | One PostgreSQL database per organization (PHI, appointments, vectors, audit logs) |
| **Redis** | BullMQ job queues |
| **MinIO** | Documents and recordings (S3-compatible) |
| **LiveKit Cloud** | Video consultations (hosted; configured via `LIVEKIT_*` in `.env`) |

### How tenant databases are named

Tenant databases are **not** named after the organization display name or slug.

When an org registers, the server assigns a **UUID** (`orgId`). The tenant database name is:

```text
{TENANT_DB_NAME_PREFIX}{orgId with hyphens replaced by underscores}
```

Example: prefix `caremind_tenant_` + org `f47ac10b-58cc-4372-a567-0e02b2c3d479` → database `caremind_tenant_f47ac10b_58cc_4372_a567_0e02b2c3d479`.

So two organizations both called "City Hospital" get **different** databases because their UUIDs differ. The **slug** (`orgSlug`) is only for human-readable URLs and must be unique at registration time; it is not used for database naming.

The full connection string for each tenant is stored in the central `organizations.dbUrl` column after provisioning.

---

## Prerequisites

- **Node.js** 20+
- **Docker** and **Docker Compose** (recommended for local infra)
- **psql** client (required when registering new orgs — creates tenant databases on the tenant Postgres host)
- API keys for MVP vendors (see `backend/.env.example`): OpenRouter, Voyage, Deepgram, Resend, etc. Document OCR uses local Tesseract (no API key).

---

## Quick start (Docker Compose — infrastructure only)

Runs Postgres (central + tenant), Redis, and MinIO. LiveKit uses your **hosted project** from `.env` (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`). You typically run the **API on the host** with `npm run dev` so logs and debugging are easier.

```bash
cd backend
cp .env.example .env
# Edit .env: set JWT secrets (32+ chars) and external API keys

docker compose up -d postgres-central postgres-tenant-template redis minio mailhog
```

Wait until services are healthy:

```bash
docker compose ps
```

### Central database migrations

```bash
cd backend
npm install
npm run prisma:central:generate
npm run prisma:tenant:generate
npm run prisma:central:migrate
```

`prisma:central:migrate` reads `CENTRAL_DB_*` from `.env` and builds `CENTRAL_DATABASE_URL` for Prisma.

### Start the API (host)

```bash
cd backend
npm run dev
```

Health check: [http://localhost:3000/health](http://localhost:3000/health)

Tenant databases are created automatically when you call `POST /api/auth/register-org` (requires `psql` pointing at `TENANT_DB_HOST` / `TENANT_DB_PORT`).

---

## Quick start (Docker Compose — full stack including backend)

```bash
cd backend
cp .env.example .env
# Fill in all required secrets and API keys in .env

docker compose up -d --build
```

Run central migrations **once** (from your machine, against the exposed central port):

```bash
cd backend
npm install
npm run prisma:central:generate
npm run prisma:central:migrate
```

The backend container depends on healthy Postgres, Redis, and MinIO. Register an org via API or Postman to provision the first tenant DB.

---

## Local development (`npm run dev`) — step by step

### 1. Environment

```bash
cd backend
cp .env.example .env
```

Important groups in `.env`:

| Group | Variables | Purpose |
|--------|-----------|---------|
| Central DB | `CENTRAL_DB_HOST`, `CENTRAL_DB_PORT`, `CENTRAL_DB_USER`, `CENTRAL_DB_PASSWORD`, `CENTRAL_DB_NAME` | Control-plane Postgres; app builds connection URL at startup |
| Tenant DB server | `TENANT_DB_HOST`, `TENANT_DB_PORT`, `TENANT_DB_USER`, `TENANT_DB_PASSWORD`, `TENANT_DB_NAME_PREFIX` | Host where per-org databases are created |
| Auth | `JWT_SECRET`, `REFRESH_TOKEN_SECRET` (min 32 characters each) | Access and refresh tokens |
| Vendors | `OPENROUTER_*`, `VOYAGE_*`, `DEEPGRAM_*`, `LIVEKIT_*`, etc. | MVP integrations (LiveKit Cloud in dev and prod) |
| Email (dev) | `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT` | Mailhog — UI at [http://localhost:8025](http://localhost:8025) |
| Email (prod) | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` | Resend for real delivery |

### 2. Start infrastructure

```bash
cd backend
docker compose up -d postgres-central postgres-tenant-template redis minio mailhog
```

| Service | Host port | Notes |
|---------|-----------|--------|
| Central Postgres | 5432 | DB name: `caremind_central` |
| Tenant Postgres | 5433 | Used to `CREATE DATABASE` per org |
| Redis | 6379 | BullMQ |
| MinIO API / Console | 9000 / 9001 | `minioadmin` / `minioadmin` |
| Mailhog SMTP / UI | 1025 / 8025 | Dev email inbox (set `EMAIL_PROVIDER=smtp` in `.env`) |
| LiveKit | — | **Not in Docker** — use LiveKit Cloud URL/keys in `backend/.env` |

### 3. Install and generate Prisma clients

```bash
cd backend
npm install
npm run prisma:central:generate
npm run prisma:tenant:generate
npm run prisma:central:migrate
```

### 4. Run the server

```bash
cd backend
npm run dev
```

Production build:

```bash
cd backend
npm run build
npm start
```

### 5. Smoke test (curl)

```bash
# Register organization (creates central org + tenant DB + admin user)
curl -s -X POST http://localhost:3000/api/auth/register-org \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Demo Clinic",
    "orgSlug": "demo-clinic",
    "adminEmail": "admin@demo.clinic",
    "adminPassword": "SecurePass123!"
  }'
```

Save `accessToken` from `data` in the response for subsequent requests:

```bash
export TOKEN="<accessToken>"
curl -s http://localhost:3000/api/admin/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

---

## Postman

Import the collection from the repo root:

**File:** `caremind-ai.postman_collection.json`

1. Postman → **Import** → select the file.
2. Collection variables: `baseUrl` (default `http://localhost:3000`), emails/passwords for admin/doctor/patient.
3. Run folder **1. Auth** → **Register Organization** first (saves tokens).
4. Run **2. Users (Admin)** → invite doctor; **Login (Doctor)**; then **2b. Users (Doctor)** → invite patient (or invite patient as admin in step 2). Set `doctorPassword` / `patientPassword` from Mailhog or invite emails.
5. Continue through appointments, consent, consultations, etc.

Recommended order is documented in the collection description.

---

## Environment reference

### Central database (separate components)

```env
CENTRAL_DB_HOST=localhost
CENTRAL_DB_PORT=5432
CENTRAL_DB_USER=postgres
CENTRAL_DB_PASSWORD=password
CENTRAL_DB_NAME=caremind_central
```

The application constructs `CENTRAL_DATABASE_URL` internally when `validateEnv()` runs. You do not need to set `CENTRAL_DATABASE_URL` manually in `.env`.

### Tenant database server

```env
TENANT_DB_HOST=localhost
TENANT_DB_PORT=5433
TENANT_DB_USER=postgres
TENANT_DB_PASSWORD=password
TENANT_DB_NAME_PREFIX=caremind_tenant_
```

### Email (development vs production)

```env
# Development — Mailhog (any recipient; no Resend limits)
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=dev@caremind.local

# Production — Resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@your-verified-domain.com
```

### Auth tokens (why two secrets?)

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs **access tokens** sent as `Authorization: Bearer …` on every API call (short-lived, default 15m). |
| `REFRESH_TOKEN_SECRET` | Signs **refresh tokens** used only at `POST /api/auth/refresh` to obtain a new token pair (longer-lived, default 7d). |

They must be **different** secrets. Refresh tokens are also stored **hashed** in the central DB, rotated on each refresh, and revoked on logout.

---

## API overview

| Prefix | Auth | Description |
|--------|------|-------------|
| `/api/auth` | Public (except logout/MFA) | Register org, login, refresh, MFA |
| `/api/users` | Admin | Invite doctors/patients |
| `/api/appointments` | JWT + tenant | Scheduling, consent |
| `/api/consultations` | JWT + tenant | LiveKit tokens, recording, transcripts |
| `/api/documents` | JWT + tenant | Upload/list documents |
| `/api/ai` | JWT + tenant | AI assistant chat |
| `/api/ai-outputs` | JWT + tenant | Doctor review of AI notes |
| `/api/pdf-export` | JWT + tenant | Visit summary PDF |
| `/api/admin` | Admin | Dashboard, audit logs |

Responses use envelope: `{ "data": ..., "meta": { "requestId", "timestamp" } }`.

---

## Project layout

```text
caremind-ai/
├── README.md
├── caremind-ai.postman_collection.json
├── .gitignore                         ← repo-wide (covers backend/)
└── backend/
    ├── src/
    ├── prisma/central/
    ├── prisma/tenant/
    ├── docker-compose.yml
    ├── .env.example
    └── scripts/prisma-central-migrate.sh
```

---

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| `Missing or invalid environment variables` | Compare `.env` to `.env.example`; JWT secrets must be ≥ 32 characters |
| Tenant DB creation fails on register-org | `psql` installed; `TENANT_DB_HOST`/`PORT` reachable; tenant Postgres container up |
| `TENANT_ERROR` on register-org (tenant migrations) | Rebuild backend image (`docker compose build backend`). Ensure `postgres-tenant-template` is up. If a previous attempt half-failed, drop the orphan DB: `docker exec -it caremind-postgres-tenant psql -U postgres -c 'DROP DATABASE IF EXISTS \"caremind_tenant_<uuid>\";'`. Retry register with a **new** `orgSlug`. Check backend logs for Prisma stderr. |
| Prisma migrate can’t connect | `CENTRAL_DB_*` matches Docker ports (5432 for central) |
| Workers fail silently | Redis running; `REDIS_URL` correct |
| LiveKit token errors | `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` match your [LiveKit Cloud](https://cloud.livekit.io) project (use `wss://` URL) |

---

## License

Proprietary — CareMind AI MVP.
