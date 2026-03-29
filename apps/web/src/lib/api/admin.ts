import { apiClient } from './client';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  status: string;
  twoFaEnabled: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  tenant: { id: string; name: string } | null;
  userRoles: { role: { id: string; name: string } }[];
}

export interface AdminTenant {
  id: string;
  code: string;
  name: string;
  plan: string;
  status: string;
  contactEmail: string;
  country: string;
  maxUsers: number;
  modules: string[];
  createdAt: string;
  _count?: { users: number };
}

export interface PlanDefinition {
  key: string;
  label: string;
  labelEn: string;
  maxUsers: number;
  modules: string[];
  description: string;
}

export interface ModuleOption {
  key: string;
  label: string;
}

export const adminApi = {
  // Users (tenant-scoped, requires user:view permission)
  users: {
    list: (params?: { page?: number; perPage?: number; search?: string }) =>
      apiClient.get('/users', { params }).then(r => r.data.data ?? r.data),
    listSystem: (params?: { page?: number; perPage?: number; search?: string; tenantId?: string }) =>
      apiClient.get('/users/system', { params }).then(r => r.data.data ?? r.data),
    get: (id: string) => apiClient.get(`/users/${id}`).then(r => r.data.data ?? r.data),
    roles: () => apiClient.get('/users/roles').then(r => r.data.data ?? r.data),
    create: (data: { email: string; password: string; displayName: string; roleIds?: string[] }) =>
      apiClient.post('/users', data).then(r => r.data.data ?? r.data),
    update: (id: string, data: { displayName?: string; status?: string }) =>
      apiClient.patch(`/users/${id}`, data).then(r => r.data.data ?? r.data),
    activate: (id: string) => apiClient.patch(`/users/${id}/activate`).then(r => r.data),
    deactivate: (id: string) => apiClient.patch(`/users/${id}/deactivate`).then(r => r.data),
    resetTwoFa: (id: string) => apiClient.patch(`/users/${id}/reset-2fa`).then(r => r.data),
    delete: (id: string) => apiClient.delete(`/users/${id}`).then(r => r.data),
  },
  // Tenants (super admin only)
  tenants: {
    list: (params?: { page?: number; perPage?: number }) =>
      apiClient.get('/tenants', { params }).then(r => r.data),
    get: (id: string) => apiClient.get(`/tenants/${id}`).then(r => r.data.data ?? r.data) as Promise<AdminTenant>,
    create: (data: any) => apiClient.post('/tenants', data).then(r => r.data.data ?? r.data),
    update: (id: string, data: any) => apiClient.patch(`/tenants/${id}`, data).then(r => r.data.data ?? r.data),
    updateModules: (id: string, modules: string[], maxUsers?: number, plan?: string) =>
      apiClient.patch(`/tenants/${id}/modules`, { modules, maxUsers, plan }).then(r => r.data.data ?? r.data),
    suspend: (id: string) => apiClient.patch(`/tenants/${id}/suspend`).then(r => r.data),
    activate: (id: string) => apiClient.patch(`/tenants/${id}/activate`).then(r => r.data),
    exportCsv: () => apiClient.get('/tenants/export', { responseType: 'blob' }).then(r => r.data),
  },
  // Plans (super admin only)
  plans: {
    list: () => apiClient.get('/tenants/plans').then(r => r.data as { plans: PlanDefinition[]; allModules: ModuleOption[] }),
  },
  // 2FA
  twoFa: {
    setup: () => apiClient.post('/auth/2fa/setup').then(r => r.data.data ?? r.data),
    enable: (totpCode: string) => apiClient.post('/auth/2fa/enable', { totpCode }),
    disable: (password: string) => apiClient.post('/auth/2fa/disable', { password }),
  },
  // System backup
  backup: {
    download: () => apiClient.get('/admin/backup', { responseType: 'blob' }).then(r => ({
      data: r.data,
      filename: r.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] ?? 'backup.sql',
    })),
  },
};
