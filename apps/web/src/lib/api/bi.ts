import { apiClient } from './client';

// --- Summary response types ---

export interface SalesSummary {
  totalOrdersThisMonth: number;
  revenueThisMonth: number;
  totalCustomers: number;
  pendingOrders: number;
}

export interface ProcurementSummary {
  totalPOsThisMonth: number;
  spendThisMonth: number;
  totalSuppliers: number;
  pendingPRs: number;
}

export interface InventorySummary {
  totalItems: number;
  totalWarehouses: number;
  lowStockCount: number;
  totalStockValue: number;
}

export interface FinanceSummary {
  totalAR: number;
  totalAP: number;
  draftJournalEntries: number;
  totalAccounts: number;
}

export interface HrSummary {
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaves: number;
  onLeaveToday: number;
}

// --- Chart response types ---

export interface MonthlySalesPoint {
  month: string;   // 'YYYY-MM'
  revenue: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  orderCount: number;
  totalAmount: number;
}

export interface OrdersByStatus {
  status: string;
  count: number;
}

// --- API client ---

const extract = (res: any) => res.data?.data ?? res.data;

export const biApi = {
  summary: {
    sales: async (): Promise<SalesSummary> => {
      const res = await apiClient.get('/bi/summary/sales');
      return extract(res);
    },
    procurement: async (): Promise<ProcurementSummary> => {
      const res = await apiClient.get('/bi/summary/procurement');
      return extract(res);
    },
    inventory: async (): Promise<InventorySummary> => {
      const res = await apiClient.get('/bi/summary/inventory');
      return extract(res);
    },
    finance: async (): Promise<FinanceSummary> => {
      const res = await apiClient.get('/bi/summary/finance');
      return extract(res);
    },
    hr: async (): Promise<HrSummary> => {
      const res = await apiClient.get('/bi/summary/hr');
      return extract(res);
    },
  },

  charts: {
    monthlySales: async (): Promise<MonthlySalesPoint[]> => {
      const res = await apiClient.get('/bi/charts/monthly-sales');
      return extract(res);
    },
    topCustomers: async (): Promise<TopCustomer[]> => {
      const res = await apiClient.get('/bi/charts/top-customers');
      return extract(res);
    },
    ordersByStatus: async (): Promise<OrdersByStatus[]> => {
      const res = await apiClient.get('/bi/charts/orders-by-status');
      return extract(res);
    },
  },
};
