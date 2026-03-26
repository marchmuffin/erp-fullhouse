-- ERP 全家桶 - PostgreSQL Initialization Script
-- Creates the public schema structure for multi-tenant setup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search

-- Create enum types
CREATE TYPE tenant_plan AS ENUM ('starter', 'professional', 'enterprise', 'custom');
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'locked', 'pending_verification');
CREATE TYPE audit_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'APPROVE', 'REJECT');

-- ============================================================
-- TENANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(20) UNIQUE NOT NULL,
  name            VARCHAR(200) NOT NULL,
  name_en         VARCHAR(200),
  logo_url        TEXT,
  plan            tenant_plan NOT NULL DEFAULT 'trial',
  status          tenant_status NOT NULL DEFAULT 'trial',
  schema_name     VARCHAR(63) UNIQUE NOT NULL,  -- PostgreSQL schema name
  modules         JSONB NOT NULL DEFAULT '[]',  -- Enabled modules list
  settings        JSONB NOT NULL DEFAULT '{}',  -- Tenant-level settings
  max_users       INTEGER NOT NULL DEFAULT 5,
  trial_ends_at   TIMESTAMP WITH TIME ZONE,
  subscription_starts_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at   TIMESTAMP WITH TIME ZONE,
  contact_email   VARCHAR(254) NOT NULL,
  contact_phone   VARCHAR(50),
  country         VARCHAR(2) NOT NULL DEFAULT 'TW',
  timezone        VARCHAR(50) NOT NULL DEFAULT 'Asia/Taipei',
  locale          VARCHAR(10) NOT NULL DEFAULT 'zh-TW',
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tenants_code ON public.tenants(code);
CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_schema_name ON public.tenants(schema_name);

-- ============================================================
-- USERS TABLE (global, cross-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email             VARCHAR(254) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  display_name      VARCHAR(100) NOT NULL,
  avatar_url        TEXT,
  status            user_status NOT NULL DEFAULT 'pending_verification',
  is_super_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  locale            VARCHAR(10) NOT NULL DEFAULT 'zh-TW',
  timezone          VARCHAR(50) NOT NULL DEFAULT 'Asia/Taipei',
  two_fa_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  two_fa_secret     VARCHAR(255),
  last_login_at     TIMESTAMP WITH TIME ZONE,
  last_login_ip     INET,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until      TIMESTAMP WITH TIME ZONE,
  email_verified_at TIMESTAMP WITH TIME ZONE,
  password_changed_at TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMP WITH TIME ZONE,
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_users_status ON public.users(status);

-- ============================================================
-- ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  name_en     VARCHAR(100),
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,  -- System roles cannot be deleted
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_roles_tenant_id ON public.roles(tenant_id);

-- ============================================================
-- PERMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(100) UNIQUE NOT NULL,  -- e.g., "po:create", "supplier:view"
  module      VARCHAR(50) NOT NULL,           -- e.g., "procurement"
  resource    VARCHAR(50) NOT NULL,           -- e.g., "po"
  action      VARCHAR(50) NOT NULL,           -- e.g., "create"
  description TEXT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_module ON public.permissions(module);
CREATE INDEX idx_permissions_code ON public.permissions(code);

-- ============================================================
-- ROLE_PERMISSIONS JOIN TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- USER_ROLES JOIN TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON public.user_roles(role_id);

-- ============================================================
-- REFRESH_TOKENS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at  TIMESTAMP WITH TIME ZONE,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens(expires_at);

-- ============================================================
-- AUDIT_LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action      audit_action NOT NULL,
  module      VARCHAR(50),
  resource    VARCHAR(100),
  resource_id VARCHAR(255),
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource, resource_id);

-- ============================================================
-- SEED: System Permissions
-- ============================================================
INSERT INTO public.permissions (code, module, resource, action, description) VALUES
  -- Auth
  ('auth:login', 'auth', 'session', 'login', 'Login to the system'),
  -- Tenant Management (Super Admin)
  ('tenant:view', 'platform', 'tenant', 'view', 'View tenants'),
  ('tenant:create', 'platform', 'tenant', 'create', 'Create tenants'),
  ('tenant:update', 'platform', 'tenant', 'update', 'Update tenants'),
  ('tenant:delete', 'platform', 'tenant', 'delete', 'Delete tenants'),
  -- User Management
  ('user:view', 'platform', 'user', 'view', 'View users'),
  ('user:create', 'platform', 'user', 'create', 'Create users'),
  ('user:update', 'platform', 'user', 'update', 'Update users'),
  ('user:delete', 'platform', 'user', 'delete', 'Delete users'),
  -- Procurement
  ('supplier:view', 'procurement', 'supplier', 'view', 'View suppliers'),
  ('supplier:create', 'procurement', 'supplier', 'create', 'Create suppliers'),
  ('supplier:update', 'procurement', 'supplier', 'update', 'Update suppliers'),
  ('supplier:delete', 'procurement', 'supplier', 'delete', 'Delete suppliers'),
  ('pr:view', 'procurement', 'pr', 'view', 'View purchase requisitions'),
  ('pr:create', 'procurement', 'pr', 'create', 'Create purchase requisitions'),
  ('pr:approve', 'procurement', 'pr', 'approve', 'Approve purchase requisitions'),
  ('po:view', 'procurement', 'po', 'view', 'View purchase orders'),
  ('po:create', 'procurement', 'po', 'create', 'Create purchase orders'),
  ('po:approve', 'procurement', 'po', 'approve', 'Approve purchase orders'),
  ('po:update', 'procurement', 'po', 'update', 'Update purchase orders'),
  -- Sales
  ('customer:view', 'sales', 'customer', 'view', 'View customers'),
  ('customer:create', 'sales', 'customer', 'create', 'Create customers'),
  ('customer:update', 'sales', 'customer', 'update', 'Update customers'),
  ('so:view', 'sales', 'so', 'view', 'View sales orders'),
  ('so:create', 'sales', 'so', 'create', 'Create sales orders'),
  ('so:approve', 'sales', 'so', 'approve', 'Approve sales orders'),
  -- Inventory
  ('item:view', 'inventory', 'item', 'view', 'View items'),
  ('item:create', 'inventory', 'item', 'create', 'Create items'),
  ('item:update', 'inventory', 'item', 'update', 'Update items'),
  ('stock:view', 'inventory', 'stock', 'view', 'View stock levels'),
  ('stock:adjust', 'inventory', 'stock', 'adjust', 'Adjust stock'),
  ('warehouse:view', 'inventory', 'warehouse', 'view', 'View warehouses'),
  ('warehouse:manage', 'inventory', 'warehouse', 'manage', 'Manage warehouses'),
  -- Manufacturing
  ('bom:view', 'manufacturing', 'bom', 'view', 'View BOM'),
  ('bom:create', 'manufacturing', 'bom', 'create', 'Create BOM'),
  ('bom:update', 'manufacturing', 'bom', 'update', 'Update BOM'),
  ('wo:view', 'manufacturing', 'wo', 'view', 'View work orders'),
  ('wo:create', 'manufacturing', 'wo', 'create', 'Create work orders'),
  ('wo:update', 'manufacturing', 'wo', 'update', 'Update work orders'),
  -- Finance
  ('account:view', 'finance', 'account', 'view', 'View accounts'),
  ('journal:view', 'finance', 'journal', 'view', 'View journal entries'),
  ('journal:create', 'finance', 'journal', 'create', 'Create journal entries'),
  ('journal:approve', 'finance', 'journal', 'approve', 'Approve journal entries'),
  ('report:view', 'finance', 'report', 'view', 'View financial reports'),
  -- HR
  ('employee:view', 'hr', 'employee', 'view', 'View employees'),
  ('employee:create', 'hr', 'employee', 'create', 'Create employees'),
  ('employee:update', 'hr', 'employee', 'update', 'Update employees'),
  ('payroll:view', 'hr', 'payroll', 'view', 'View payroll'),
  ('payroll:process', 'hr', 'payroll', 'process', 'Process payroll'),
  -- CRM
  ('lead:view', 'crm', 'lead', 'view', 'View leads'),
  ('lead:create', 'crm', 'lead', 'create', 'Create leads'),
  ('opportunity:view', 'crm', 'opportunity', 'view', 'View opportunities'),
  ('opportunity:create', 'crm', 'opportunity', 'create', 'Create opportunities'),
  ('ticket:view', 'crm', 'ticket', 'view', 'View service tickets'),
  ('ticket:create', 'crm', 'ticket', 'create', 'Create service tickets'),
  -- Quality
  ('inspection:view', 'quality', 'inspection', 'view', 'View inspections'),
  ('inspection:create', 'quality', 'inspection', 'create', 'Create inspections'),
  ('ncr:view', 'quality', 'ncr', 'view', 'View NCR reports'),
  ('ncr:create', 'quality', 'ncr', 'create', 'Create NCR reports'),
  -- BI
  ('dashboard:view', 'bi', 'dashboard', 'view', 'View dashboards'),
  ('report:create', 'bi', 'report', 'create', 'Create custom reports'),
  -- BPM
  ('workflow:view', 'bpm', 'workflow', 'view', 'View workflows'),
  ('workflow:manage', 'bpm', 'workflow', 'manage', 'Manage workflows'),
  ('approval:process', 'bpm', 'approval', 'process', 'Process approvals')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- FUNCTION: Update updated_at timestamp automatically
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
