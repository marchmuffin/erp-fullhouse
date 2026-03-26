// ============================================================
// API Constants
// ============================================================

export const API_VERSION = 'v1';
export const API_PREFIX = `/api/${API_VERSION}`;

// ============================================================
// Pagination Defaults
// ============================================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

// ============================================================
// Auth Constants
// ============================================================

export const JWT_EXPIRES_IN = '15m';
export const JWT_REFRESH_EXPIRES_IN = '7d';
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCK_DURATION_MINUTES = 30;

// ============================================================
// Available Modules
// ============================================================

export const AVAILABLE_MODULES = [
  'procurement',
  'sales',
  'inventory',
  'manufacturing',
  'finance',
  'hr',
  'crm',
  'quality',
  'bi',
  'bpm',
  'pos',
] as const;

export type AvailableModule = typeof AVAILABLE_MODULES[number];

// ============================================================
// Plan Module Access
// ============================================================

export const PLAN_MODULES: Record<string, string[]> = {
  starter: ['procurement', 'sales', 'inventory', 'finance'],
  professional: ['procurement', 'sales', 'inventory', 'manufacturing', 'finance', 'hr', 'crm', 'quality', 'bi'],
  enterprise: ['procurement', 'sales', 'inventory', 'manufacturing', 'finance', 'hr', 'crm', 'quality', 'bi', 'bpm', 'pos'],
  custom: [],
};

// ============================================================
// Locales
// ============================================================

export const SUPPORTED_LOCALES = ['zh-TW', 'en'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

export const DEFAULT_LOCALE: SupportedLocale = 'zh-TW';
export const DEFAULT_TIMEZONE = 'Asia/Taipei';
