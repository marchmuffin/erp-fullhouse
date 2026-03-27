import { apiClient } from './client';

export interface PosOrderLine {
  id: string;
  posOrderId: string;
  itemId?: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
}

export interface PosOrder {
  id: string;
  orderNo: string;
  sessionId: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  customerId?: string;
  status: string; // completed | voided
  voidReason?: string;
  createdAt: string;
  session?: { id: string; sessionNo: string; cashierName: string };
  lines?: PosOrderLine[];
}

export interface PosSession {
  id: string;
  sessionNo: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  totalSales: number;
  totalOrders: number;
  status: string; // open | closed
  notes?: string;
  createdAt: string;
  updatedAt: string;
  orders?: PosOrder[];
  _count?: { orders: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const extract = (res: any) => res.data?.data ?? res.data;

export const posApi = {
  sessions: {
    list: async (params?: { page?: number; perPage?: number; status?: string }) => {
      const res = await apiClient.get('/pos/sessions', { params });
      return extract(res) as PaginatedResponse<PosSession>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/pos/sessions/${id}`);
      return extract(res) as PosSession;
    },
    active: async () => {
      const res = await apiClient.get('/pos/sessions/active');
      return extract(res) as PosSession | null;
    },
    open: async (data: { cashierName: string; openingCash?: number }) => {
      const res = await apiClient.post('/pos/sessions/open', data);
      return extract(res) as PosSession;
    },
    close: async (id: string, data: { closingCash?: number; notes?: string }) => {
      const res = await apiClient.patch(`/pos/sessions/${id}/close`, data);
      return extract(res) as PosSession;
    },
  },
  orders: {
    list: async (params?: { page?: number; perPage?: number; sessionId?: string; status?: string }) => {
      const res = await apiClient.get('/pos/orders', { params });
      return extract(res) as PaginatedResponse<PosOrder>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/pos/orders/${id}`);
      return extract(res) as PosOrder;
    },
    create: async (data: {
      sessionId: string;
      paymentMethod?: string;
      paidAmount: number;
      customerId?: string;
      lines: Array<{
        itemId?: string;
        itemCode: string;
        itemName: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
      }>;
    }) => {
      const res = await apiClient.post('/pos/orders', data);
      return extract(res) as PosOrder;
    },
    void: async (id: string, reason?: string) => {
      const res = await apiClient.patch(`/pos/orders/${id}/void`, { reason });
      return extract(res) as PosOrder;
    },
  },
};
