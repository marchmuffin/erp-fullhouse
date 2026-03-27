import { apiClient } from './client';

export interface WorkflowDefinition {
  id: string;
  code: string;
  name: string;
  module: string;
  docType: string;
  steps: number;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStep {
  id: string;
  instanceId: string;
  stepNo: number;
  action?: string; // approved | rejected | null (pending)
  actorId?: string;
  actorName?: string;
  comment?: string;
  actedAt?: string;
}

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  docType: string;
  docId: string;
  docNo: string;
  submittedBy: string;
  submittedAt: string;
  currentStep: number;
  status: string; // pending | approved | rejected | cancelled
  completedAt?: string;
  definition?: WorkflowDefinition;
  steps?: WorkflowStep[];
}

export interface BpmStats {
  pendingCount: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  totalDefinitions: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const extract = (res: any) => res.data?.data ?? res.data;

export const bpmApi = {
  stats: {
    get: async (): Promise<BpmStats> => {
      const res = await apiClient.get('/bpm/stats');
      return extract(res) as BpmStats;
    },
  },

  definitions: {
    list: async (params?: {
      module?: string;
      isActive?: boolean;
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<WorkflowDefinition>> => {
      const res = await apiClient.get('/bpm/definitions', { params });
      return extract(res) as PaginatedResponse<WorkflowDefinition>;
    },
    create: async (data: {
      code: string;
      name: string;
      module: string;
      docType: string;
      steps?: number;
      description?: string;
      isActive?: boolean;
    }): Promise<WorkflowDefinition> => {
      const res = await apiClient.post('/bpm/definitions', data);
      return extract(res) as WorkflowDefinition;
    },
  },

  instances: {
    list: async (params?: {
      status?: string;
      docType?: string;
      submittedBy?: string;
      page?: number;
      perPage?: number;
    }): Promise<PaginatedResponse<WorkflowInstance>> => {
      const res = await apiClient.get('/bpm/instances', { params });
      return extract(res) as PaginatedResponse<WorkflowInstance>;
    },
    get: async (id: string): Promise<WorkflowInstance> => {
      const res = await apiClient.get(`/bpm/instances/${id}`);
      return extract(res) as WorkflowInstance;
    },
    submit: async (data: {
      definitionId?: string;
      docType: string;
      docId: string;
      docNo: string;
    }): Promise<WorkflowInstance> => {
      const res = await apiClient.post('/bpm/instances/submit', data);
      return extract(res) as WorkflowInstance;
    },
    approve: async (id: string, comment?: string): Promise<WorkflowInstance> => {
      const res = await apiClient.patch(`/bpm/instances/${id}/approve`, { comment });
      return extract(res) as WorkflowInstance;
    },
    reject: async (id: string, comment?: string): Promise<WorkflowInstance> => {
      const res = await apiClient.patch(`/bpm/instances/${id}/reject`, { comment });
      return extract(res) as WorkflowInstance;
    },
    cancel: async (id: string): Promise<WorkflowInstance> => {
      const res = await apiClient.patch(`/bpm/instances/${id}/cancel`);
      return extract(res) as WorkflowInstance;
    },
    pending: async (): Promise<{ data: WorkflowInstance[]; meta: { total: number } }> => {
      const res = await apiClient.get('/bpm/instances/pending');
      return extract(res) as { data: WorkflowInstance[]; meta: { total: number } };
    },
    mine: async (): Promise<{ data: WorkflowInstance[]; meta: { total: number } }> => {
      const res = await apiClient.get('/bpm/instances/mine');
      return extract(res) as { data: WorkflowInstance[]; meta: { total: number } };
    },
  },
};
