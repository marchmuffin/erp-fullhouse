import { apiClient } from './client';

export interface BomLine {
  id: string; bomId: string; lineNo: number;
  componentId: string; quantity: number; unit: string; notes?: string;
  component?: { id: string; code: string; name: string; unit: string };
}

export interface Bom {
  id: string; itemId: string; version: string; isActive: boolean;
  description?: string; createdAt: string; updatedAt: string;
  item?: { id: string; code: string; name: string };
  lines?: BomLine[];
}

export interface WoOperation {
  id: string; workOrderId: string; stepNo: number; name: string;
  description?: string; plannedHours?: number; actualHours?: number;
  status: string; completedAt?: string;
}

export interface WoMaterialIssue {
  id: string; workOrderId: string; itemId: string; warehouseId: string;
  requiredQty: number; issuedQty: number; issuedAt?: string; issuedBy?: string;
  item?: { code: string; name: string; unit: string };
  warehouse?: { code: string; name: string };
}

export interface WorkOrder {
  id: string; woNo: string; bomId?: string; itemId: string;
  plannedQty: number; producedQty: number; warehouseId?: string;
  status: string; plannedStart?: string; plannedEnd?: string;
  actualStart?: string; actualEnd?: string; notes?: string;
  createdBy?: string; createdAt: string; updatedAt: string;
  item?: { code: string; name: string; unit: string };
  bom?: { version: string };
  operations?: WoOperation[];
  materialIssues?: WoMaterialIssue[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const extract = (res: any) => res.data?.data ?? res.data;

export interface MrpRequirement {
  id: string;
  mrpRunId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  requiredQty: number;
  availableQty: number;
  shortageQty: number;
  unit: string;
  workOrderId?: string;
}

export interface MrpRun {
  id: string;
  runNo: string;
  planningDate: string;
  horizon: number;
  status: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  requirements?: MrpRequirement[];
  _count?: { requirements: number };
}

export const manufacturingApi = {
  boms: {
    list: async (params?: { page?: number; perPage?: number; search?: string; isActive?: boolean }) => {
      const res = await apiClient.get('/manufacturing/boms', { params });
      return res.data as PaginatedResponse<Bom>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/manufacturing/boms/${id}`);
      return extract(res) as Bom;
    },
    create: async (data: { itemId: string; version: string; description?: string; isActive?: boolean }) => {
      const res = await apiClient.post('/manufacturing/boms', data);
      return extract(res) as Bom;
    },
    update: async (id: string, data: Partial<{ itemId: string; version: string; description: string; isActive: boolean }>) => {
      const res = await apiClient.put(`/manufacturing/boms/${id}`, data);
      return extract(res) as Bom;
    },
    addLine: async (id: string, data: { componentId: string; quantity: number; unit: string; notes?: string }) => {
      const res = await apiClient.post(`/manufacturing/boms/${id}/lines`, data);
      return extract(res) as BomLine;
    },
  },
  workOrders: {
    list: async (params?: { page?: number; perPage?: number; search?: string; status?: string }) => {
      const res = await apiClient.get('/manufacturing/work-orders', { params });
      return res.data as PaginatedResponse<WorkOrder>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/manufacturing/work-orders/${id}`);
      return extract(res) as WorkOrder;
    },
    create: async (data: {
      woNo: string; itemId: string; bomId?: string; plannedQty: number;
      plannedStart?: string; plannedEnd?: string; notes?: string;
    }) => {
      const res = await apiClient.post('/manufacturing/work-orders', data);
      return extract(res) as WorkOrder;
    },
    release: async (id: string) => {
      const res = await apiClient.patch(`/manufacturing/work-orders/${id}/release`);
      return extract(res) as WorkOrder;
    },
    start: async (id: string) => {
      const res = await apiClient.patch(`/manufacturing/work-orders/${id}/start`);
      return extract(res) as WorkOrder;
    },
    complete: async (id: string, data: { producedQty: number }) => {
      const res = await apiClient.patch(`/manufacturing/work-orders/${id}/complete`, data);
      return extract(res) as WorkOrder;
    },
    cancel: async (id: string) => {
      const res = await apiClient.patch(`/manufacturing/work-orders/${id}/cancel`);
      return extract(res) as WorkOrder;
    },
    issueMaterials: async (id: string) => {
      const res = await apiClient.post(`/manufacturing/work-orders/${id}/issue-materials`);
      return extract(res);
    },
    completeOperation: async (woId: string, opId: string, data: { actualHours: number }) => {
      const res = await apiClient.patch(`/manufacturing/work-orders/${woId}/operations/${opId}/complete`, data);
      return extract(res) as WoOperation;
    },
  },
  mrp: {
    list: async (params?: { page?: number; perPage?: number }) => {
      const res = await apiClient.get('/manufacturing/mrp', { params });
      return res.data as PaginatedResponse<MrpRun>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/manufacturing/mrp/${id}`);
      return extract(res) as MrpRun;
    },
    create: async (data: { planningDate: string; horizon?: number; notes?: string }) => {
      const res = await apiClient.post('/manufacturing/mrp', data);
      return extract(res) as MrpRun;
    },
    run: async (id: string) => {
      const res = await apiClient.patch(`/manufacturing/mrp/${id}/run`);
      return extract(res) as MrpRun;
    },
    cancel: async (id: string) => {
      const res = await apiClient.patch(`/manufacturing/mrp/${id}/cancel`);
      return extract(res) as MrpRun;
    },
  },
};
