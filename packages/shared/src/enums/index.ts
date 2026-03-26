export enum TenantPlan {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom',
}

export enum TenantStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  LOCKED = 'locked',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum Module {
  PROCUREMENT = 'procurement',
  SALES = 'sales',
  INVENTORY = 'inventory',
  MANUFACTURING = 'manufacturing',
  FINANCE = 'finance',
  HR = 'hr',
  CRM = 'crm',
  QUALITY = 'quality',
  BI = 'bi',
  BPM = 'bpm',
  POS = 'pos',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}
