import { apiClient } from './client';

export interface Item {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  unitCost: number;
  safetyStock: number;
  reorderPoint: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  stockLevels?: {
    id: string;
    quantity: number;
    reservedQty: number;
    warehouse: { id: string; code: string; name: string };
  }[];
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stockLevels?: {
    id: string;
    quantity: number;
    item: { id: string; code: string; name: string; unit: string };
  }[];
}

export interface StockTransaction {
  id: string;
  txnNo: string;
  itemId: string;
  warehouseId: string;
  txnType: string;
  quantity: number;
  unitCost: number;
  refDocType?: string;
  refDocId?: string;
  refDocNo?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  item?: { code: string; name: string };
  warehouse?: { code: string; name: string };
}

export interface StockCount {
  id: string;
  countNo: string;
  warehouseId: string;
  status: string;
  countDate: string;
  notes?: string;
  createdBy?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  warehouse?: { code: string; name: string };
  lines?: StockCountLine[];
}

export interface StockCountLine {
  id: string;
  stockCountId: string;
  itemId: string;
  systemQty: number;
  countedQty?: number;
  variance?: number;
  notes?: string;
  item?: { code: string; name: string; unit: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const extract = (res: any) => res.data?.data ?? res.data;

export const inventoryApi = {
  items: {
    list: async (params?: {
      page?: number;
      perPage?: number;
      search?: string;
      category?: string;
      isActive?: boolean;
    }) => {
      const res = await apiClient.get('/inventory/items', { params });
      return res.data as PaginatedResponse<Item>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/inventory/items/${id}`);
      return extract(res) as Item;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/inventory/items', data);
      return extract(res) as Item;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.put(`/inventory/items/${id}`, data);
      return extract(res) as Item;
    },
    lowStock: async () => {
      const res = await apiClient.get('/inventory/items/low-stock');
      return extract(res) as Item[];
    },
  },

  warehouses: {
    list: async (params?: { page?: number; perPage?: number; search?: string }) => {
      const res = await apiClient.get('/inventory/warehouses', { params });
      return res.data as PaginatedResponse<Warehouse>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/inventory/warehouses/${id}`);
      return extract(res) as Warehouse;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/inventory/warehouses', data);
      return extract(res) as Warehouse;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.put(`/inventory/warehouses/${id}`, data);
      return extract(res) as Warehouse;
    },
  },

  transactions: {
    list: async (params?: {
      page?: number;
      perPage?: number;
      search?: string;
      txnType?: string;
      itemId?: string;
      warehouseId?: string;
    }) => {
      const res = await apiClient.get('/inventory/transactions', { params });
      return res.data as PaginatedResponse<StockTransaction>;
    },
    receive: async (data: any) => {
      const res = await apiClient.post('/inventory/transactions/receive', data);
      return extract(res) as StockTransaction;
    },
    issue: async (data: any) => {
      const res = await apiClient.post('/inventory/transactions/issue', data);
      return extract(res) as StockTransaction;
    },
    adjust: async (data: any) => {
      const res = await apiClient.post('/inventory/transactions/adjust', data);
      return extract(res) as StockTransaction;
    },
  },

  counts: {
    list: async (params?: {
      page?: number;
      perPage?: number;
      search?: string;
      status?: string;
      warehouseId?: string;
    }) => {
      const res = await apiClient.get('/inventory/counts', { params });
      return res.data as PaginatedResponse<StockCount>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/inventory/counts/${id}`);
      return extract(res) as StockCount;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/inventory/counts', data);
      return extract(res) as StockCount;
    },
    updateLine: async (countId: string, lineId: string, data: any) => {
      const res = await apiClient.patch(`/inventory/counts/${countId}/lines/${lineId}`, data);
      return extract(res) as StockCountLine;
    },
    complete: async (countId: string) => {
      const res = await apiClient.patch(`/inventory/counts/${countId}/complete`);
      return extract(res) as StockCount;
    },
  },
};
