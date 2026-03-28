# Technical Architecture

**Project**: ERP 全家桶
**Version**: 1.1.0
**Last Updated**: 2026-03-28

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Multi-tenancy Design](#3-multi-tenancy-design)
4. [Authentication Flow](#4-authentication-flow)
5. [API Design](#5-api-design)
6. [Database Schema](#6-database-schema)
7. [User Roles & Permissions](#7-user-roles--permissions)
8. [Module Structure](#8-module-structure)
9. [Frontend Architecture](#9-frontend-architecture)

---

## 1. System Overview

ERP 全家桶 is built as a **monorepo** managed by pnpm workspaces and Turborepo. The system follows a standard client-server architecture with a NestJS REST API backend and a Next.js frontend, backed by PostgreSQL with schema-per-tenant isolation.

### Repository Structure

```
ERP全家桶/
├── apps/
│   ├── api/                    # NestJS backend (port 4001)
│   │   ├── src/
│   │   │   ├── auth/           # Authentication & 2FA
│   │   │   ├── users/          # User management
│   │   │   ├── tenants/        # Tenant management
│   │   │   ├── admin/          # Admin-only features (backup)
│   │   │   ├── sales/          # Sales module
│   │   │   ├── procurement/    # Procurement module
│   │   │   ├── inventory/      # Inventory module
│   │   │   ├── manufacturing/  # Manufacturing module
│   │   │   ├── finance/        # Finance module
│   │   │   ├── hr/             # Human resources module
│   │   │   ├── crm/            # CRM module
│   │   │   ├── quality/        # Quality management module
│   │   │   ├── bi/             # Business intelligence module
│   │   │   ├── bpm/            # Business process management module
│   │   │   ├── pos/            # POS module
│   │   │   ├── prisma/         # Prisma service & schema
│   │   │   ├── common/         # Shared utilities, guards, decorators
│   │   │   └── main.ts         # Application entry point
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Prisma schema definition
│   │   │   └── seed.ts         # Demo data seed script
│   │   └── package.json
│   └── web/                    # Next.js 14 frontend (port 4000)
│       ├── app/                # App Router pages
│       │   ├── (auth)/         # Login, 2FA verification pages
│       │   ├── (dashboard)/    # Protected dashboard pages
│       │   │   ├── dashboard/
│       │   │   ├── sales/
│       │   │   ├── procurement/
│       │   │   ├── inventory/
│       │   │   ├── manufacturing/
│       │   │   ├── finance/
│       │   │   ├── hr/
│       │   │   ├── crm/
│       │   │   ├── quality/
│       │   │   ├── bi/
│       │   │   ├── bpm/
│       │   │   ├── pos/
│       │   │   └── admin/      # Admin panel (users, tenants, system)
│       │   └── layout.tsx
│       ├── components/         # Shared UI components
│       ├── lib/                # Utilities, API client, stores
│       └── package.json
├── packages/
│   └── shared/                 # Shared types and utilities
├── turbo.json                  # Turborepo pipeline config
├── pnpm-workspace.yaml
└── package.json
```

### Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Next.js Frontend | 4000 | User-facing web application |
| NestJS API | 4001 | REST API backend |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Session/cache store |

---

## 2. Tech Stack

### Backend (apps/api)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Node.js | 20+ | JavaScript runtime |
| Framework | NestJS | 10+ | Backend framework with DI, modules, guards |
| ORM | Prisma | 5+ | Type-safe database access, migrations |
| Database | PostgreSQL | 15+ | Primary relational database |
| Auth | @nestjs/jwt | - | JWT token generation and validation |
| Auth | passport-jwt | - | JWT passport strategy |
| 2FA | otplib | - | TOTP implementation (RFC 6238) |
| 2FA | qrcode | - | QR code generation for 2FA setup |
| Password | bcrypt | - | Password hashing (cost factor 12) |
| Validation | class-validator | - | DTO validation decorators |
| Validation | class-transformer | - | Request payload transformation |
| Docs | @nestjs/swagger | - | OpenAPI/Swagger documentation |
| Cache | ioredis | - | Redis client |

### Frontend (apps/web)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js | 14 | React framework with App Router |
| Language | TypeScript | 5+ | Type safety |
| Styling | Tailwind CSS | 3+ | Utility-first CSS framework |
| UI Components | shadcn/ui | - | Accessible component library |
| State | Zustand | - | Auth state management |
| Server State | TanStack Query (React Query) | 5+ | Server state, caching, mutations |
| Forms | React Hook Form | - | Form state management |
| Validation | Zod | - | Schema validation |
| HTTP | Axios | - | HTTP client with interceptors |
| Charts | Recharts | - | Data visualization |
| Icons | Lucide React | - | Icon library |

### Infrastructure & Tooling

| Category | Technology | Purpose |
|----------|-----------|---------|
| Monorepo | Turborepo | Build caching, pipeline orchestration |
| Package Manager | pnpm | Efficient dependency management |
| Database Migrations | Prisma Migrate | Schema versioning |
| Code Quality | ESLint + Prettier | Linting and formatting |

---

## 3. Multi-tenancy Design

### Architecture Pattern: Schema-per-Tenant

The platform uses PostgreSQL's native schema support to provide complete data isolation between tenants. Each tenant's data lives in its own dedicated schema, preventing any possibility of cross-tenant data leakage at the database level.

```
PostgreSQL Database
├── public (platform schema)
│   ├── users           # Platform-level user accounts
│   ├── tenants         # Tenant registry
│   ├── roles           # Role definitions
│   ├── permissions     # Permission definitions
│   └── role_permissions
├── tenant_0001 (tenant schema)
│   ├── customers
│   ├── products
│   ├── sales_orders
│   ├── purchase_orders
│   ├── inventory_items
│   └── ... (all business tables)
├── tenant_0002
│   └── ... (identical structure, isolated data)
└── tenant_XXXX
    └── ...
```

### TenantMiddleware

Every incoming API request passes through `TenantMiddleware`, which:

1. Reads the `X-Tenant-ID` header (or extracts tenant from JWT claims)
2. Looks up the tenant in the `public.tenants` table
3. Verifies tenant status is `active`
4. Sets the PostgreSQL `search_path` to `tenant_XXXX, public` for the duration of the request
5. Attaches the tenant context to the NestJS request object

```typescript
// Simplified TenantMiddleware flow
async use(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.headers['x-tenant-id'] || req.user?.tenantId;
  const tenant = await this.tenantsService.findById(tenantId);

  if (!tenant || tenant.status !== 'active') {
    throw new UnauthorizedException('Tenant not found or suspended');
  }

  // Set schema search path for this request's DB connection
  await this.prisma.$executeRaw`SET search_path TO ${tenant.schema}, public`;
  req['tenant'] = tenant;
  next();
}
```

### Tenant Schema Provisioning

When a new tenant is created via `POST /api/v1/tenants`, the system:

1. Creates a new entry in `public.tenants` with a unique schema name (e.g., `tenant_0042`)
2. Executes `CREATE SCHEMA tenant_0042`
3. Runs Prisma migrations against the new schema to create all business tables
4. Creates the default `tenant_admin` user for the new tenant
5. Seeds initial reference data (roles, permissions, lookup tables)

---

## 4. Authentication Flow

### JWT + Refresh Token Architecture

The system uses a dual-token approach:

- **Access Token**: Short-lived JWT (15 minutes), stateless, signed with `JWT_SECRET`
- **Refresh Token**: Long-lived opaque token (7 days), stored server-side in Redis, supports rotation

```
Client                          API Server                      Redis / DB
  │                                 │                               │
  │  POST /auth/login               │                               │
  │  { email, password }            │                               │
  ├────────────────────────────────►│                               │
  │                                 │  Verify credentials            │
  │                                 │  Check account status          │
  │                                 │  Check if 2FA enabled         │
  │                                 │                               │
  │  ← 200 { requiresTwoFactor: true } (if 2FA enabled)            │
  │                                 │                               │
  │  POST /auth/2fa/verify          │                               │
  │  { tempToken, totp }            │                               │
  ├────────────────────────────────►│                               │
  │                                 │  Validate TOTP                │
  │                                 ├──────────────────────────────►│
  │                                 │  Store refresh token (7d TTL) │
  │                                 │◄──────────────────────────────┤
  │  ← 200 { accessToken, refreshToken }                            │
  │                                 │                               │
  │  GET /api/v1/* (with Bearer)   │                               │
  ├────────────────────────────────►│                               │
  │                                 │  Verify JWT signature          │
  │                                 │  Check expiry (15min)         │
  │  ← 401 Unauthorized (if expired)│                               │
  │                                 │                               │
  │  POST /auth/refresh             │                               │
  │  { refreshToken }               │                               │
  ├────────────────────────────────►│                               │
  │                                 │  Validate refresh token        │
  │                                 ├──────────────────────────────►│
  │                                 │  Invalidate old token (rotation)│
  │                                 │  Store new refresh token       │
  │                                 │◄──────────────────────────────┤
  │  ← 200 { accessToken, refreshToken (new) }                      │
```

### 2FA TOTP Flow

The TOTP implementation uses `otplib` conforming to RFC 6238:

**Setup Flow:**
1. Client calls `POST /api/v1/auth/2fa/setup`
2. Server generates a TOTP secret using `authenticator.generateSecret()`
3. Server stores the secret (unconfirmed) against the user record
4. Server returns the secret and `otpauth://` URI
5. Client renders the URI as a QR code for the user to scan
6. User scans with Google Authenticator
7. User submits the 6-digit code to `POST /api/v1/auth/2fa/enable`
8. Server verifies the code with `authenticator.verify({ token, secret })`
9. On success, marks `twoFactorEnabled = true` and stores the confirmed secret

**Verification Flow (at login):**
1. After password validation, server detects `twoFactorEnabled = true`
2. Server returns `{ requiresTwoFactor: true, tempToken: <short-lived JWT> }`
3. Frontend redirects to 2FA verification screen
4. User enters 6-digit TOTP from Authenticator app
5. Server calls `authenticator.verify()` — TOTP codes are valid for 30-second windows, with ±1 window tolerance
6. On success, server issues full access + refresh tokens

### Token Storage

- **Access Token**: Stored in memory (JavaScript variable) on the client — never in localStorage or cookies
- **Refresh Token**: Stored in an `httpOnly`, `secure`, `SameSite=strict` cookie to prevent XSS access

---

## 5. API Design

### Base URL and Versioning

All API endpoints are prefixed with `/api/v1/`. The version prefix allows future non-breaking API versions to be introduced as `/api/v2/` without affecting existing clients.

### Guards

NestJS Guards are applied at the controller or route handler level to enforce authentication and authorization:

| Guard | Purpose | Applied To |
|-------|---------|-----------|
| `JwtAuthGuard` | Validates Bearer JWT token | All protected routes (globally applied, with `@Public()` exemptions) |
| `PermissionsGuard` | Checks user has required permission string | Routes decorated with `@RequirePermissions()` |
| `SuperAdminGuard` | Ensures user has `super_admin` role | Admin-only routes (tenants, backup) |
| `TenantActiveGuard` | Verifies requesting tenant is not suspended | All tenant-scoped routes |

### Decorators

Custom decorators improve readability and enforce conventions:

```typescript
// Mark a route as publicly accessible (bypasses JwtAuthGuard)
@Public()
@Post('login')
login(@Body() dto: LoginDto) {}

// Require specific permission(s) — all must be satisfied
@RequirePermissions('sales:orders:create')
@Post('orders')
createOrder(@Body() dto: CreateOrderDto) {}

// Require super admin role
@SuperAdmin()
@Get('backup')
downloadBackup() {}

// Inject the current user from JWT claims
@Get('me')
getMe(@CurrentUser() user: JwtPayload) {}

// Inject the current tenant context
@Get('orders')
listOrders(@CurrentTenant() tenant: Tenant) {}
```

### Request/Response Conventions

**Success Response:**
```json
{
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

**Error Response:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "must be a valid email" }
  ],
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

**Pagination Parameters:**
- `?page=1` — page number (1-indexed)
- `?pageSize=20` — items per page (max: 100)
- `?sortBy=createdAt` — sort field
- `?sortOrder=desc` — sort direction (asc/desc)
- `?search=keyword` — full-text search

### Swagger Documentation

Swagger UI is available at `http://localhost:4001/api/docs` in development. It is disabled in production by default and can be re-enabled via the `SWAGGER_ENABLED=true` environment variable.

---

## 6. Database Schema

### Public Schema (Platform Layer)

The `public` schema contains platform-wide tables shared across all tenants. These tables are never tenant-scoped.

```sql
-- Tenants registry
public.tenants
  id            UUID PRIMARY KEY
  name          VARCHAR(255) UNIQUE NOT NULL
  schema_name   VARCHAR(100) UNIQUE NOT NULL  -- e.g., tenant_0001
  plan          ENUM('basic', 'standard', 'enterprise')
  status        ENUM('active', 'suspended')
  created_at    TIMESTAMP
  updated_at    TIMESTAMP

-- Platform users (includes super admins and all tenant users)
public.users
  id                  UUID PRIMARY KEY
  tenant_id           UUID REFERENCES tenants(id)  -- NULL for super_admin
  email               VARCHAR(255) UNIQUE NOT NULL
  password_hash       VARCHAR(255) NOT NULL
  name                VARCHAR(255) NOT NULL
  role                ENUM('super_admin', 'tenant_admin', 'user')
  status              ENUM('active', 'inactive', 'locked')
  failed_login_count  INTEGER DEFAULT 0
  two_factor_enabled  BOOLEAN DEFAULT false
  two_factor_secret   VARCHAR(255)  -- encrypted at rest
  last_login_at       TIMESTAMP
  created_at          TIMESTAMP
  updated_at          TIMESTAMP

-- Role definitions
public.roles
  id          UUID PRIMARY KEY
  name        VARCHAR(100) UNIQUE NOT NULL
  description TEXT
  is_system   BOOLEAN DEFAULT false  -- system roles cannot be deleted

-- Fine-grained permissions
public.permissions
  id          UUID PRIMARY KEY
  name        VARCHAR(255) UNIQUE NOT NULL  -- format: module:resource:action
  description TEXT
  module      VARCHAR(100)

-- Role-to-permission mapping
public.role_permissions
  role_id       UUID REFERENCES roles(id)
  permission_id UUID REFERENCES permissions(id)
  PRIMARY KEY (role_id, permission_id)

-- Refresh token store (also in Redis for performance)
public.refresh_tokens
  id          UUID PRIMARY KEY
  user_id     UUID REFERENCES users(id)
  token_hash  VARCHAR(255) UNIQUE NOT NULL
  expires_at  TIMESTAMP NOT NULL
  created_at  TIMESTAMP
  revoked_at  TIMESTAMP  -- NULL if still valid
```

### Tenant Schema (Business Layer)

Each tenant schema contains identical table structures but completely isolated data. Key tables:

```sql
-- Products / Items master
tenant_XXXX.products
  id          UUID PRIMARY KEY
  code        VARCHAR(100) UNIQUE NOT NULL
  name        VARCHAR(255) NOT NULL
  category    VARCHAR(100)
  unit        VARCHAR(50)
  cost_price  DECIMAL(15,4)
  sell_price  DECIMAL(15,4)
  is_active   BOOLEAN DEFAULT true
  created_at  TIMESTAMP

-- Customers
tenant_XXXX.customers
  id            UUID PRIMARY KEY
  code          VARCHAR(100) UNIQUE NOT NULL
  name          VARCHAR(255) NOT NULL
  credit_limit  DECIMAL(15,2)
  status        ENUM('active', 'inactive')
  created_at    TIMESTAMP

-- Sales Orders
tenant_XXXX.sales_orders
  id            UUID PRIMARY KEY
  order_no      VARCHAR(100) UNIQUE NOT NULL
  customer_id   UUID REFERENCES customers(id)
  status        ENUM('draft', 'confirmed', 'shipped', 'completed', 'cancelled')
  order_date    DATE NOT NULL
  total_amount  DECIMAL(15,2)
  created_by    UUID  -- references public.users(id)
  created_at    TIMESTAMP

-- Sales Order Lines
tenant_XXXX.sales_order_lines
  id              UUID PRIMARY KEY
  sales_order_id  UUID REFERENCES sales_orders(id)
  product_id      UUID REFERENCES products(id)
  quantity        DECIMAL(15,4) NOT NULL
  unit_price      DECIMAL(15,4) NOT NULL
  total_price     DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED

-- Suppliers
tenant_XXXX.suppliers
  id      UUID PRIMARY KEY
  code    VARCHAR(100) UNIQUE NOT NULL
  name    VARCHAR(255) NOT NULL
  rating  INTEGER CHECK (rating BETWEEN 1 AND 5)

-- Purchase Orders (similar structure to sales_orders)
-- Inventory (current stock levels)
-- Manufacturing Work Orders
-- Financial Journals + Journal Lines
-- HR Employees + Attendance + Payroll
-- CRM Contacts + Opportunities
-- Quality Inspections
-- BPM Process Definitions + Instances
-- POS Sessions + Transactions
```

---

## 7. User Roles & Permissions

### RBAC Model

The platform implements a Role-Based Access Control (RBAC) model with the following hierarchy:

```
super_admin  ──► Full platform access, all tenants
    │
tenant_admin ──► Full access within their tenant
    │
user         ──► Access governed by assigned permission set
```

### Three User Types

| Role | Scope | Can Manage |
|------|-------|-----------|
| `super_admin` | Platform-wide | All tenants, all users, system backup |
| `tenant_admin` | Single tenant | Users within their tenant, all business modules |
| `user` | Single tenant | Only modules/actions with explicit permissions |

### Permission Format

Permissions follow a three-part dot-separated format:

```
{module}:{resource}:{action}
```

Examples:
- `sales:orders:view` — Can view sales orders
- `sales:orders:create` — Can create new sales orders
- `sales:orders:update` — Can modify existing sales orders
- `sales:orders:delete` — Can delete sales orders
- `user:users:view` — Can view user list
- `user:users:create` — Can create new users
- `user:users:update` — Can modify users, reset 2FA
- `admin:tenants:view` — Can view tenant list (super_admin only)
- `admin:backup:download` — Can download database backup (super_admin only)

### Default Role Permissions

**tenant_admin** is granted all permissions within `sales:*`, `procurement:*`, `inventory:*`, `manufacturing:*`, `finance:*`, `hr:*`, `crm:*`, `quality:*`, `bi:*`, `bpm:*`, `pos:*`, `user:*`.

**user** starts with no permissions. The tenant admin assigns specific permissions based on job function.

### Permission Enforcement

```typescript
// Controller-level enforcement
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('sales:orders:create')
@Post('orders')
async createOrder(@Body() dto: CreateOrderDto) {
  // Only reachable if user has 'sales:orders:create' permission
}
```

The `PermissionsGuard` resolves the user's role, fetches the role's permissions from cache (Redis) or database, and checks if the required permission string is present.

---

## 8. Module Structure

Each business module follows a consistent NestJS module structure:

```
src/{module}/
├── {module}.module.ts          # NestJS module definition, imports
├── {module}.controller.ts      # Route handlers, Swagger decorators
├── {module}.service.ts         # Business logic, DB queries via Prisma
├── dto/
│   ├── create-{resource}.dto.ts   # POST request body schema
│   ├── update-{resource}.dto.ts   # PATCH request body schema
│   └── query-{resource}.dto.ts    # GET query params schema
└── entities/
    └── {resource}.entity.ts    # Response shape (for Swagger)
```

### Module Registration

```typescript
// Example: SalesModule
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SalesOrdersController, SalesCustomersController],
  providers: [SalesOrdersService, SalesCustomersService],
  exports: [SalesOrdersService],  // exported if other modules need it
})
export class SalesModule {}
```

### Service Pattern

Each service uses Prisma for database access and applies tenant schema isolation via the injected `PrismaService`. The Prisma client is configured to respect the `search_path` set by `TenantMiddleware` for tenant-scoped operations, while explicitly using `public.` prefix for platform-level queries.

```typescript
@Injectable()
export class SalesOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, query: QuerySalesOrderDto) {
    return this.prisma.salesOrder.findMany({
      where: {
        ...(query.search && {
          OR: [
            { orderNo: { contains: query.search } },
            { customer: { name: { contains: query.search } } },
          ],
        }),
        ...(query.status && { status: query.status }),
      },
      include: { customer: true, lines: { include: { product: true } } },
      orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    });
  }
}
```

---

## 9. Frontend Architecture

### Next.js App Router

The frontend uses Next.js 14 with the App Router. All pages under `app/(dashboard)/` are protected — an authentication middleware redirects unauthenticated users to `/login`.

```typescript
// middleware.ts — runs on every request matching the pattern
export function middleware(request: NextRequest) {
  const accessToken = getTokenFromMemory(); // or check cookie for session hint
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');

  if (!accessToken && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (accessToken && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}
```

### Authentication State (Zustand)

Global authentication state is managed with Zustand:

```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
  clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
```

### API Client with Token Interceptors

A single Axios instance handles all API communication. Interceptors manage token attachment and silent refresh:

```typescript
// lib/api-client.ts
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001',
});

// Request interceptor: attach current access token
apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: handle 401 with silent refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        useAuthStore.getState().setAuth(data.user, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### Server State with React Query

All server data fetching is done through TanStack Query (React Query v5), providing automatic caching, background refetching, and mutation state management:

```typescript
// Example: fetching sales orders
export function useSalesOrders(params: QuerySalesOrderDto) {
  return useQuery({
    queryKey: ['sales', 'orders', params],
    queryFn: () => apiClient.get('/api/v1/sales/orders', { params }).then(r => r.data),
    staleTime: 30_000,  // treat data as fresh for 30 seconds
  });
}

// Example: creating an order
export function useCreateSalesOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateSalesOrderDto) =>
      apiClient.post('/api/v1/sales/orders', dto).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', 'orders'] });
    },
  });
}
```

### Permission-Based UI Rendering

Frontend components use a `usePermissions` hook to conditionally render UI elements based on the current user's permissions:

```typescript
export function usePermissions() {
  const { user } = useAuthStore();
  return {
    can: (permission: string) => user?.permissions?.includes(permission) ?? false,
    isAdmin: () => user?.role === 'tenant_admin' || user?.role === 'super_admin',
    isSuperAdmin: () => user?.role === 'super_admin',
  };
}

// Usage in component
function SalesOrderActions({ order }) {
  const { can } = usePermissions();
  return (
    <div>
      {can('sales:orders:update') && <EditButton />}
      {can('sales:orders:delete') && <DeleteButton />}
    </div>
  );
}
```

The admin sidebar section (User Management, Tenant Management, System) is only rendered when `isAdmin()` returns true, and Tenant Management / System pages additionally check `isSuperAdmin()`.

---

*Document Version: 1.1.0 | Last Updated: 2026-03-28*
