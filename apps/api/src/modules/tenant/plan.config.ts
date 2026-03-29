export const ALL_MODULES = [
  'sales',
  'procurement',
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

export type ModuleKey = (typeof ALL_MODULES)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  sales:         '銷售管理',
  procurement:   '採購管理',
  inventory:     '庫存管理',
  manufacturing: '生產管理',
  finance:       '財務管理',
  hr:            '人力資源',
  crm:           '客戶關係',
  quality:       '品質管理',
  bi:            '商業智能',
  bpm:           '流程管理',
  pos:           'POS 銷售',
};

export interface PlanDefinition {
  key: string;
  label: string;
  labelEn: string;
  maxUsers: number;
  modules: ModuleKey[];
  description: string;
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  starter: {
    key: 'starter',
    label: '入門版',
    labelEn: 'Starter',
    maxUsers: 10,
    modules: ['sales', 'procurement', 'inventory'],
    description: '適合小型企業，提供核心採購、銷售與庫存管理功能。',
  },
  professional: {
    key: 'professional',
    label: '專業版',
    labelEn: 'Professional',
    maxUsers: 50,
    modules: ['sales', 'procurement', 'inventory', 'finance', 'hr', 'crm', 'quality'],
    description: '適合中型企業，涵蓋財務、人資、CRM 與品質管理完整功能。',
  },
  enterprise: {
    key: 'enterprise',
    label: '企業版',
    labelEn: 'Enterprise',
    maxUsers: 999,
    modules: ['sales', 'procurement', 'inventory', 'manufacturing', 'finance', 'hr', 'crm', 'quality', 'bi', 'bpm', 'pos'],
    description: '全功能方案，包含生產製造、商業智能、流程自動化與 POS 銷售，不限用戶數。',
  },
  custom: {
    key: 'custom',
    label: '自訂版',
    labelEn: 'Custom',
    maxUsers: 10,
    modules: [],
    description: '依企業需求自訂模組清單與用戶上限，需聯繫業務洽談。',
  },
};
