import { apiClient } from './client';

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status: string; // new | contacted | qualified | disqualified
  estimatedValue?: number;
  assignedTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  activities?: CrmActivity[];
  opportunities?: Opportunity[];
}

export interface Opportunity {
  id: string;
  title: string;
  leadId?: string;
  customerId?: string;
  stage: string; // prospecting | qualification | proposal | negotiation | closed_won | closed_lost
  probability: number;
  value: number;
  expectedClose?: string;
  assignedTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lead?: Pick<Lead, 'id' | 'name' | 'company'>;
  activities?: CrmActivity[];
}

export interface CrmActivity {
  id: string;
  type: string; // call | email | meeting | note | task
  subject: string;
  description?: string;
  leadId?: string;
  opportunityId?: string;
  scheduledAt?: string;
  completedAt?: string;
  status: string; // planned | completed | cancelled
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lead?: Pick<Lead, 'id' | 'name' | 'company'>;
  opportunity?: Pick<Opportunity, 'id' | 'title'>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const extract = (res: any) => res.data?.data ?? res.data;

export const crmApi = {
  leads: {
    list: async (params?: {
      page?: number; perPage?: number; search?: string;
      status?: string; source?: string;
    }) => {
      const res = await apiClient.get('/crm/leads', { params });
      return extract(res) as PaginatedResponse<Lead>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/crm/leads/${id}`);
      return extract(res) as Lead;
    },
    create: async (data: Partial<Lead>) => {
      const res = await apiClient.post('/crm/leads', data);
      return extract(res) as Lead;
    },
    update: async (id: string, data: Partial<Lead> & { status?: string }) => {
      const res = await apiClient.put(`/crm/leads/${id}`, data);
      return extract(res) as Lead;
    },
    qualify: async (id: string) => {
      const res = await apiClient.patch(`/crm/leads/${id}/qualify`);
      return extract(res);
    },
    disqualify: async (id: string, reason?: string) => {
      const res = await apiClient.patch(`/crm/leads/${id}/disqualify`, { reason });
      return extract(res) as Lead;
    },
  },

  opportunities: {
    list: async (params?: {
      page?: number; perPage?: number; search?: string; stage?: string;
    }) => {
      const res = await apiClient.get('/crm/opportunities', { params });
      return extract(res) as PaginatedResponse<Opportunity>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/crm/opportunities/${id}`);
      return extract(res) as Opportunity;
    },
    create: async (data: Partial<Opportunity>) => {
      const res = await apiClient.post('/crm/opportunities', data);
      return extract(res) as Opportunity;
    },
    update: async (id: string, data: Partial<Opportunity>) => {
      const res = await apiClient.put(`/crm/opportunities/${id}`, data);
      return extract(res) as Opportunity;
    },
    closeWon: async (id: string) => {
      const res = await apiClient.patch(`/crm/opportunities/${id}/close-won`);
      return extract(res) as Opportunity;
    },
    closeLost: async (id: string, reason?: string) => {
      const res = await apiClient.patch(`/crm/opportunities/${id}/close-lost`, { reason });
      return extract(res) as Opportunity;
    },
  },

  activities: {
    list: async (params?: {
      page?: number; perPage?: number; leadId?: string;
      opportunityId?: string; type?: string; status?: string;
    }) => {
      const res = await apiClient.get('/crm/activities', { params });
      return extract(res) as PaginatedResponse<CrmActivity>;
    },
    create: async (data: Partial<CrmActivity>) => {
      const res = await apiClient.post('/crm/activities', data);
      return extract(res) as CrmActivity;
    },
    complete: async (id: string) => {
      const res = await apiClient.patch(`/crm/activities/${id}/complete`);
      return extract(res) as CrmActivity;
    },
    cancel: async (id: string) => {
      const res = await apiClient.patch(`/crm/activities/${id}/cancel`);
      return extract(res) as CrmActivity;
    },
  },
};
