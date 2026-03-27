# ERP 全家桶 (ERP Fullhouse)

Cloud-based **multi-tenant ERP SaaS platform** designed for SMEs with 20–500 employees in manufacturing and distribution. A single subscription covers all 11 functional modules — sales, procurement, inventory, manufacturing, finance, HR, CRM, quality, BI, BPM, and POS — with no per-module licensing.

---

## Features

| Module | Description |
|---|---|
| **Sales** | Customer management, sales orders, delivery orders, and revenue tracking |
| **Procurement** | Supplier management, purchase requisitions, purchase orders, and goods receipt |
| **Inventory** | Item master, multi-warehouse stock control, stock transactions, and cycle counting |
| **Manufacturing** | Bill of Materials, work orders, production scheduling, and output recording |
| **Finance** | Chart of accounts, journal entries, AR/AP invoicing, payments, and financial reports |
| **HR** | Employee records, leave management, attendance tracking, and payroll processing |
| **CRM** | Lead and opportunity pipeline, customer activities, and service ticket management |
| **Quality** | Incoming/in-process inspection, non-conformance reports, and corrective actions |
| **BI** | Cross-module dashboards, KPI widgets, and custom report builder |
| **BPM** | Configurable multi-step approval workflows for any document type |
| **POS** | Point-of-sale terminal with session management, receipt printing, and end-of-day close |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **API** | Node.js 20, NestJS 10, Prisma 5, PostgreSQL 16 |
| **Auth** | JWT (access token) + rotating refresh tokens, TOTP 2FA via `otplib` |
| **Queue / Cache** | Redis 7, BullMQ |
| **File Storage** | MinIO (S3-compatible) |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript 5 |
| **UI** | Tailwind CSS, shadcn/ui, Recharts |
| **API Client** | TanStack Query v5, Axios |
| **Monorepo** | pnpm workspaces, Turborepo |
| **CI/CD** | GitHub Actions, Docker, ghcr.io |

---

## Architecture

### Multi-tenancy: Schema-per-Tenant PostgreSQL

Each tenant gets an isolated PostgreSQL schema (`tenant_<code>`). The public schema holds platform-wide data: tenants, users, roles, permissions, refresh tokens, and audit logs. The API sets `SET LOCAL search_path = tenant_<code>` at the start of each request so all Prisma queries route to the correct schema without any tenant ID columns in the tenant tables.

### Auth: JWT + Rotating Refresh Tokens + TOTP 2FA

Access tokens are short-lived JWTs (15 minutes). Refresh tokens are hashed and stored in the database; each use issues a new token and invalidates the old one (rotation). Optional TOTP 2FA is provisioned via QR code and verified on every login when enabled.

### Monorepo: pnpm Workspaces + Turborepo

```
erp-fullhouse/
├── apps/
│   ├── api/     # NestJS backend
│   └── web/     # Next.js frontend
├── packages/
│   └── shared/  # Shared TypeScript types and utilities
```

Turborepo caches build, lint, and type-check outputs. Remote caching can be enabled via `TURBO_TOKEN`.

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Docker** (for PostgreSQL, Redis, and MinIO)

### 1. Clone & Install

```bash
git clone https://github.com/marchmuffin/erp-fullhouse.git
cd erp-fullhouse
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your local values (see Environment Variables section)
```

### 3. Start Infrastructure

```bash
docker compose up -d
# Wait ~10 seconds for PostgreSQL to initialize, then verify:
docker compose ps
```

### 4. Database Setup

```bash
pnpm db:migrate        # Run Prisma migrations against public schema
pnpm db:generate       # Generate Prisma client types
pnpm --filter api exec ts-node prisma/seed.ts   # Seed demo data
```

### 5. Start Development Servers

```bash
pnpm dev               # Starts API on :4001 and Web on :4000 in parallel
```

### Demo Accounts

All accounts use the password **`Admin@123`**.

| Role | Email | Tenant |
|---|---|---|
| Platform Super Admin | `admin@erp.local` | (platform-wide) |
| Demo Admin | `admin@demo.erp.local` | demo |
| Demo Manager | `manager@demo.erp.local` | demo |
| Demo Staff | `staff@demo.erp.local` | demo |

---

## Project Structure

```
erp-fullhouse/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Prisma data model (public schema)
│   │   │   ├── seed.ts         # Development seed script
│   │   │   └── migrations/     # Prisma migration history
│   │   └── src/
│   │       └── modules/        # One NestJS module per ERP module
│   │           ├── auth/
│   │           ├── sales/
│   │           ├── procurement/
│   │           ├── inventory/
│   │           ├── manufacturing/
│   │           ├── finance/
│   │           ├── hr/
│   │           ├── crm/
│   │           ├── quality/
│   │           ├── bi/
│   │           ├── bpm/
│   │           ├── pos/
│   │           ├── tenant/
│   │           └── user/
│   └── web/                    # Next.js 15 frontend
│       └── src/app/
│           ├── (auth)/         # Login, 2FA setup
│           └── (dashboard)/    # Protected ERP pages (one route per module)
├── packages/
│   └── shared/                 # Shared types, constants, utilities
│       └── src/
├── docker/
│   └── postgres/
│       ├── init.sql            # Postgres schema bootstrap
│       └── tenant-schema-init.sql
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── .github/
    └── workflows/
        └── ci.yml              # CI pipeline + Docker image build/push
```

---

## API Documentation

Swagger UI is served at **[http://localhost:4001/api/docs](http://localhost:4001/api/docs)** in development mode.

The API follows RESTful conventions. All endpoints require a `Bearer <access_token>` header except `/auth/login` and `/auth/refresh`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://erp:password@localhost:5432/erp`) |
| `REDIS_URL` | Redis connection string (e.g. `redis://localhost:6379`) |
| `JWT_SECRET` | Secret key for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens (different from access secret) |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (e.g. `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (e.g. `7d`) |
| `MINIO_ENDPOINT` | MinIO host (e.g. `localhost`) |
| `MINIO_PORT` | MinIO port (default `9000`) |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_BUCKET` | Default storage bucket name |
| `APP_URL` | Public base URL of the frontend (used in email links) |
| `SMTP_HOST` | SMTP server host for outbound email |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |

---

## Development

### Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start API (`:4001`) and Web (`:4000`) in watch mode |
| `pnpm build` | Production build for all apps |
| `pnpm lint` | ESLint across all workspaces |
| `pnpm type-check` | TypeScript type check (no emit) |
| `pnpm test` | Run all unit tests |
| `pnpm db:migrate` | Run pending Prisma migrations |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:studio` | Open Prisma Studio at `:5555` |
| `pnpm docker:up` | Start all Docker services |
| `pnpm docker:down` | Stop all Docker services |
| `pnpm docker:logs` | Tail Docker service logs |

### Module Permissions

Permissions follow the `resource:action` format. Every API endpoint is guarded by a specific permission code.

| Code | Meaning |
|---|---|
| `so:view` | Can read sales orders |
| `so:create` | Can create sales orders |
| `so:approve` | Can approve sales orders |
| `po:approve` | Can approve purchase orders |
| `payroll:process` | Can run payroll processing |
| `workflow:manage` | Can configure approval workflows |

Roles are sets of permissions. The three system roles (`Super Admin`, `Manager`, `Staff`) are seeded automatically. Tenant administrators can create additional custom roles via the UI.

---

## Deployment

### Docker

Build production images from the repository root (so `packages/shared` is in build context):

```bash
docker build -f apps/api/Dockerfile -t erp-fullhouse-api .
docker build -f apps/web/Dockerfile -t erp-fullhouse-web .
```

### GitHub Actions

The CI pipeline (`.github/workflows/ci.yml`) runs on every push and pull request:

1. **Lint + type-check** — all workspaces
2. **Unit tests** — all workspaces
3. **Build** — all apps

On a successful push to `main`, the pipeline additionally:

4. Builds Docker images for `api` and `web`
5. Pushes them to `ghcr.io/marchmuffin/erp-fullhouse-api` and `ghcr.io/marchmuffin/erp-fullhouse-web`

Images are tagged with both the short Git SHA and `latest`.
