import { apiClient } from './client';

export interface Account {
  id: string; code: string; name: string; type: string;
  category?: string; isActive: boolean; notes?: string;
  createdAt: string; updatedAt: string;
}

export interface JournalLine {
  id: string; journalEntryId: string; lineNo: number;
  debitAccountId?: string; creditAccountId?: string; amount: number; description?: string;
  debitAccount?: { code: string; name: string };
  creditAccount?: { code: string; name: string };
}

export interface JournalEntry {
  id: string; jeNo: string; jeDate: string; description: string;
  status: string; refDocType?: string; refDocNo?: string;
  createdBy?: string; postedBy?: string; postedAt?: string;
  createdAt: string; updatedAt: string;
  lines?: JournalLine[];
}

export interface InvoiceLine {
  id: string; invoiceId: string; lineNo: number;
  description: string; quantity: number; unitPrice: number; amount: number;
}

export interface Payment {
  id: string; paymentNo: string; invoiceId: string;
  paymentDate: string; amount: number; method: string;
  reference?: string; notes?: string; createdAt: string;
}

export interface Invoice {
  id: string; invoiceNo: string; type: string; partyId: string; partyName: string;
  invoiceDate: string; dueDate: string; subtotal: number; taxAmount: number;
  totalAmount: number; paidAmount: number; status: string;
  refDocType?: string; refDocNo?: string; notes?: string; createdAt: string; updatedAt: string;
  lines?: InvoiceLine[]; payments?: Payment[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const extract = (res: any) => res.data?.data ?? res.data;

export const financeApi = {
  accounts: {
    list: async (params?: { page?: number; perPage?: number; search?: string; type?: string }) => {
      const res = await apiClient.get('/finance/accounts', { params });
      return res.data as PaginatedResponse<Account>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/finance/accounts/${id}`);
      return extract(res) as Account;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/finance/accounts', data);
      return extract(res) as Account;
    },
    update: async (id: string, data: any) => {
      const res = await apiClient.put(`/finance/accounts/${id}`, data);
      return extract(res) as Account;
    },
  },
  journal: {
    list: async (params?: { page?: number; perPage?: number; search?: string; status?: string }) => {
      const res = await apiClient.get('/finance/journal-entries', { params });
      return res.data as PaginatedResponse<JournalEntry>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/finance/journal-entries/${id}`);
      return extract(res) as JournalEntry;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/finance/journal-entries', data);
      return extract(res) as JournalEntry;
    },
    post: async (id: string) => {
      const res = await apiClient.patch(`/finance/journal-entries/${id}/post`);
      return extract(res) as JournalEntry;
    },
    reverse: async (id: string) => {
      const res = await apiClient.patch(`/finance/journal-entries/${id}/reverse`);
      return extract(res) as JournalEntry;
    },
  },
  invoices: {
    list: async (params?: { page?: number; perPage?: number; search?: string; type?: string; status?: string }) => {
      const res = await apiClient.get('/finance/invoices', { params });
      return res.data as PaginatedResponse<Invoice>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/finance/invoices/${id}`);
      return extract(res) as Invoice;
    },
    create: async (data: any) => {
      const res = await apiClient.post('/finance/invoices', data);
      return extract(res) as Invoice;
    },
    issue: async (id: string) => {
      const res = await apiClient.patch(`/finance/invoices/${id}/issue`);
      return extract(res) as Invoice;
    },
    cancel: async (id: string) => {
      const res = await apiClient.patch(`/finance/invoices/${id}/cancel`);
      return extract(res) as Invoice;
    },
    recordPayment: async (id: string, data: any) => {
      const res = await apiClient.post(`/finance/invoices/${id}/payments`, data);
      return extract(res) as Payment;
    },
  },
};
