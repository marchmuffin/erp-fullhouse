// ============================================================
// Common API Types
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  perPage?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

// ============================================================
// Auth Types
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
  requiresTwoFa?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  isSuperAdmin: boolean;
  tenantId?: string;
  tenantName?: string;
  locale: string;
  timezone: string;
  permissions: string[];
}

// ============================================================
// Tenant Types
// ============================================================

export interface TenantDto {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  logoUrl?: string;
  plan: string;
  status: string;
  modules: string[];
  maxUsers: number;
  contactEmail: string;
  country: string;
  timezone: string;
  locale: string;
  createdAt: string;
}
