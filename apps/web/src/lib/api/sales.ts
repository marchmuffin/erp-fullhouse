import { apiClient } from './client';

export interface Customer {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  taxId?: string;
  creditLimit: number;
  creditBalance: number;
  paymentTerms: number;
  grade: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  city?: string;
  country: string;
  currency: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
}

export interface SalesOrderLine {
  id: string;
  lineNo: number;
  itemCode: string;
  itemName: string;
  spec?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
  shippedQty: number;
  notes?: string;
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  customerId: string;
  customer: { id: string; code: string; name: string };
  status: string;
  orderDate: string;
  requestedDate?: string;
  currency: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  creditChecked: boolean;
  notes?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  lines?: SalesOrderLine[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateCustomerPayload {
  code: string;
  name: string;
  nameEn?: string;
  taxId?: string;
  creditLimit?: number;
  paymentTerms?: number;
  grade?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  notes?: string;
}

export interface CreateSalesOrderPayload {
  orderNo: string;
  customerId: string;
  orderDate: string;
  requestedDate?: string;
  shippingAddress?: string;
  currency?: string;
  notes?: string;
  lines: {
    lineNo: number;
    itemCode: string;
    itemName: string;
    spec?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    notes?: string;
  }[];
}

const extract = (res: any) => res.data?.data ?? res.data;

export const salesApi = {
  // Customers
  customers: {
    list: async (params?: { page?: number; perPage?: number; search?: string; isActive?: boolean }) => {
      const res = await apiClient.get('/sales/customers', { params });
      return extract(res) as PaginatedResponse<Customer>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/sales/customers/${id}`);
      return extract(res) as Customer;
    },
    create: async (data: CreateCustomerPayload) => {
      const res = await apiClient.post('/sales/customers', data);
      return extract(res) as Customer;
    },
    update: async (id: string, data: Partial<CreateCustomerPayload> & { isActive?: boolean }) => {
      const res = await apiClient.put(`/sales/customers/${id}`, data);
      return extract(res) as Customer;
    },
    remove: async (id: string) => {
      await apiClient.delete(`/sales/customers/${id}`);
    },
  },

  // Sales Orders
  orders: {
    list: async (params?: {
      page?: number; perPage?: number; search?: string;
      status?: string; customerId?: string; fromDate?: string; toDate?: string;
    }) => {
      const res = await apiClient.get('/sales/orders', { params });
      return extract(res) as PaginatedResponse<SalesOrder>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/sales/orders/${id}`);
      return extract(res) as SalesOrder;
    },
    create: async (data: CreateSalesOrderPayload) => {
      const res = await apiClient.post('/sales/orders', data);
      return extract(res) as SalesOrder;
    },
    submit: async (id: string) => {
      const res = await apiClient.patch(`/sales/orders/${id}/submit`);
      return extract(res) as SalesOrder;
    },
    approve: async (id: string) => {
      const res = await apiClient.patch(`/sales/orders/${id}/approve`);
      return extract(res) as SalesOrder;
    },
    cancel: async (id: string) => {
      const res = await apiClient.patch(`/sales/orders/${id}/cancel`);
      return extract(res);
    },
  },
};
