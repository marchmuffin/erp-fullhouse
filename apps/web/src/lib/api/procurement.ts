import { apiClient } from './client';

export interface Supplier {
  id: string; code: string; name: string; nameEn?: string;
  paymentTerms: number; grade: string; contactName?: string;
  contactPhone?: string; contactEmail?: string; currency: string;
  isActive: boolean; createdAt: string;
}

export interface PRLine {
  id: string; lineNo: number; itemCode: string; itemName: string;
  spec?: string; unit: string; quantity: number; notes?: string;
}

export interface PurchaseRequisition {
  id: string; prNo: string; status: string; requestDate: string;
  requiredDate?: string; department?: string; purpose?: string;
  notes?: string; createdAt: string; lines?: PRLine[];
}

export interface POLine {
  id: string; lineNo: number; itemCode: string; itemName: string;
  spec?: string; unit: string; quantity: number; unitPrice: number;
  amount: number; receivedQty: number; notes?: string;
}

export interface PurchaseOrder {
  id: string; poNo: string; supplierId: string;
  supplier: { id: string; code: string; name: string };
  prId?: string; status: string; orderDate: string;
  expectedDate?: string; currency: string;
  subtotal: number; taxAmount: number; total: number;
  notes?: string; createdAt: string; lines?: POLine[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const extract = (res: any) => res.data?.data ?? res.data;

export const procurementApi = {
  suppliers: {
    list: async (params?: { page?: number; perPage?: number; search?: string }) => {
      const res = await apiClient.get('/procurement/suppliers', { params });
      return extract(res) as PaginatedResponse<Supplier>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/procurement/suppliers/${id}`);
      return extract(res) as Supplier;
    },
    create: async (data: Omit<Supplier, 'id' | 'createdAt'> & { [key: string]: any }) => {
      const res = await apiClient.post('/procurement/suppliers', data);
      return extract(res) as Supplier;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.put(`/procurement/suppliers/${id}`, data);
      return extract(res) as Supplier;
    },
  },
  requisitions: {
    list: async (params?: { page?: number; perPage?: number; search?: string; status?: string }) => {
      const res = await apiClient.get('/procurement/requisitions', { params });
      return extract(res) as PaginatedResponse<PurchaseRequisition>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/procurement/requisitions/${id}`);
      return extract(res) as PurchaseRequisition;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/procurement/requisitions', data);
      return extract(res) as PurchaseRequisition;
    },
    submit: async (id: string) => { const res = await apiClient.patch(`/procurement/requisitions/${id}/submit`); return extract(res); },
    approve: async (id: string) => { const res = await apiClient.patch(`/procurement/requisitions/${id}/approve`); return extract(res); },
    reject: async (id: string) => { const res = await apiClient.patch(`/procurement/requisitions/${id}/reject`); return extract(res); },
    cancel: async (id: string) => { const res = await apiClient.patch(`/procurement/requisitions/${id}/cancel`); return extract(res); },
  },
  orders: {
    list: async (params?: { page?: number; perPage?: number; search?: string; status?: string; supplierId?: string }) => {
      const res = await apiClient.get('/procurement/orders', { params });
      return extract(res) as PaginatedResponse<PurchaseOrder>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/procurement/orders/${id}`);
      return extract(res) as PurchaseOrder;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/procurement/orders', data);
      return extract(res) as PurchaseOrder;
    },
    submit: async (id: string) => { const res = await apiClient.patch(`/procurement/orders/${id}/submit`); return extract(res); },
    approve: async (id: string) => { const res = await apiClient.patch(`/procurement/orders/${id}/approve`); return extract(res); },
    cancel: async (id: string) => { const res = await apiClient.patch(`/procurement/orders/${id}/cancel`); return extract(res); },
  },
};
