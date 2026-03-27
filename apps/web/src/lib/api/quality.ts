import { apiClient } from './client';

export interface IoChecklistItem {
  id: string;
  inspectionOrderId: string;
  itemNo: number;
  checkPoint: string;
  criteria?: string;
  result?: string; // pass | fail | na
  actualValue?: string;
  notes?: string;
}

export interface InspectionOrder {
  id: string;
  ioNo: string;
  type: string; // incoming | in_process | outgoing
  refDocType?: string;
  refDocId?: string;
  refDocNo?: string;
  itemId?: string;
  itemName?: string;
  quantity: number;
  status: string; // pending | in_progress | passed | failed | on_hold
  result?: string; // pass | fail | conditional
  inspector?: string;
  inspectedAt?: string;
  notes?: string;
  createdAt: string;
  checklistItems?: IoChecklistItem[];
  ncrs?: NonConformance[];
  _count?: { checklistItems: number; ncrs: number };
}

export interface NonConformance {
  id: string;
  ncrNo: string;
  inspectionOrderId?: string;
  inspectionOrder?: { id: string; ioNo: string; type: string; itemName?: string };
  severity: string; // minor | major | critical
  description: string;
  rootCause?: string;
  correctiveAction?: string;
  status: string; // open | in_review | resolved | closed
  resolvedAt?: string;
  resolvedBy?: string;
  createdBy?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const extract = (res: any) => res.data?.data ?? res.data;

export const qualityApi = {
  inspections: {
    list: async (params?: {
      page?: number; perPage?: number; type?: string; status?: string; search?: string;
    }) => {
      const res = await apiClient.get('/quality/inspections', { params });
      return extract(res) as PaginatedResponse<InspectionOrder>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/quality/inspections/${id}`);
      return extract(res) as InspectionOrder;
    },
    create: async (data: {
      type: string; refDocType?: string; refDocId?: string; refDocNo?: string;
      itemId?: string; itemName?: string; quantity: number; inspector?: string; notes?: string;
      checklistItems?: { itemNo: number; checkPoint: string; criteria?: string }[];
    }) => {
      const res = await apiClient.post('/quality/inspections', data);
      return extract(res) as InspectionOrder;
    },
    start: async (id: string) => {
      const res = await apiClient.patch(`/quality/inspections/${id}/start`);
      return extract(res) as InspectionOrder;
    },
    recordResult: async (id: string, data: { result: string; notes?: string }) => {
      const res = await apiClient.patch(`/quality/inspections/${id}/result`, data);
      return extract(res) as InspectionOrder;
    },
    updateChecklistItem: async (
      ioId: string,
      itemId: string,
      data: { result: string; actualValue?: string; notes?: string },
    ) => {
      const res = await apiClient.patch(`/quality/inspections/${ioId}/checklist/${itemId}`, data);
      return extract(res) as IoChecklistItem;
    },
  },

  ncrs: {
    list: async (params?: {
      page?: number; perPage?: number; status?: string; severity?: string; search?: string;
    }) => {
      const res = await apiClient.get('/quality/ncrs', { params });
      return extract(res) as PaginatedResponse<NonConformance>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/quality/ncrs/${id}`);
      return extract(res) as NonConformance;
    },
    create: async (data: { inspectionOrderId?: string; severity: string; description: string }) => {
      const res = await apiClient.post('/quality/ncrs', data);
      return extract(res) as NonConformance;
    },
    markInReview: async (id: string) => {
      const res = await apiClient.patch(`/quality/ncrs/${id}/in-review`);
      return extract(res) as NonConformance;
    },
    resolve: async (id: string, data: { rootCause: string; correctiveAction: string }) => {
      const res = await apiClient.patch(`/quality/ncrs/${id}/resolve`, data);
      return extract(res) as NonConformance;
    },
    close: async (id: string) => {
      const res = await apiClient.patch(`/quality/ncrs/${id}/close`);
      return extract(res) as NonConformance;
    },
  },
};
