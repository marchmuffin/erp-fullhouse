import { apiClient } from './client';

export interface Employee {
  id: string;
  empNo: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  hireDate: string;
  terminateDate?: string;
  salary: number;
  salaryType: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  leaveRequests?: LeaveRequest[];
  attendances?: Attendance[];
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    empNo: string;
    firstName: string;
    lastName: string;
    department?: string;
  };
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status: string;
  notes?: string;
  createdAt: string;
  employee?: {
    id: string;
    empNo: string;
    firstName: string;
    lastName: string;
    department?: string;
  };
}

export interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  empNo: string;
  empName: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
}

export interface PayrollRun {
  id: string;
  runNo: string;
  period: string;
  status: string;
  totalAmount: number;
  paidAt?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  items?: PayrollItem[];
  _count?: { items: number };
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

export interface CreateEmployeePayload {
  empNo: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  hireDate: string;
  salary?: number;
  salaryType?: string;
  notes?: string;
}

export interface CreateLeavePayload {
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
}

export interface CreatePayrollPayload {
  period: string;
  items?: {
    employeeId: string;
    allowances?: number;
    deductions?: number;
  }[];
}

const extract = (res: any) => res.data?.data ?? res.data;

export const hrApi = {
  employees: {
    list: async (params?: {
      page?: number;
      perPage?: number;
      search?: string;
      status?: string;
      department?: string;
    }) => {
      const res = await apiClient.get('/hr/employees', { params });
      return extract(res) as PaginatedResponse<Employee>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/hr/employees/${id}`);
      return extract(res) as Employee;
    },
    create: async (data: CreateEmployeePayload) => {
      const res = await apiClient.post('/hr/employees', data);
      return extract(res) as Employee;
    },
    update: async (id: string, data: Partial<CreateEmployeePayload> & { status?: string; terminateDate?: string }) => {
      const res = await apiClient.put(`/hr/employees/${id}`, data);
      return extract(res) as Employee;
    },
    remove: async (id: string) => {
      await apiClient.delete(`/hr/employees/${id}`);
    },
  },

  leave: {
    list: async (params?: {
      page?: number;
      perPage?: number;
      employeeId?: string;
      status?: string;
    }) => {
      const res = await apiClient.get('/hr/leave-requests', { params });
      return extract(res) as PaginatedResponse<LeaveRequest>;
    },
    create: async (data: CreateLeavePayload) => {
      const res = await apiClient.post('/hr/leave-requests', data);
      return extract(res) as LeaveRequest;
    },
    approve: async (id: string) => {
      const res = await apiClient.patch(`/hr/leave-requests/${id}/approve`);
      return extract(res) as LeaveRequest;
    },
    reject: async (id: string) => {
      const res = await apiClient.patch(`/hr/leave-requests/${id}/reject`);
      return extract(res) as LeaveRequest;
    },
    cancel: async (id: string) => {
      const res = await apiClient.patch(`/hr/leave-requests/${id}/cancel`);
      return extract(res) as LeaveRequest;
    },
  },

  attendance: {
    list: async (params?: {
      page?: number;
      perPage?: number;
      employeeId?: string;
      fromDate?: string;
      toDate?: string;
      status?: string;
    }) => {
      const res = await apiClient.get('/hr/attendance', { params });
      return extract(res) as PaginatedResponse<Attendance>;
    },
    checkIn: async (employeeId: string) => {
      const res = await apiClient.post('/hr/attendance/check-in', { employeeId });
      return extract(res) as Attendance;
    },
    checkOut: async (employeeId: string) => {
      const res = await apiClient.post('/hr/attendance/check-out', { employeeId });
      return extract(res) as Attendance;
    },
    bulkImport: async (records: { employeeId: string; date: string; status?: string; hoursWorked?: number; notes?: string }[]) => {
      const res = await apiClient.post('/hr/attendance/bulk', { records });
      return extract(res);
    },
  },

  payroll: {
    list: async (params?: { page?: number; perPage?: number; status?: string }) => {
      const res = await apiClient.get('/hr/payroll-runs', { params });
      return extract(res) as PaginatedResponse<PayrollRun>;
    },
    get: async (id: string) => {
      const res = await apiClient.get(`/hr/payroll-runs/${id}`);
      return extract(res) as PayrollRun;
    },
    create: async (data: CreatePayrollPayload) => {
      const res = await apiClient.post('/hr/payroll-runs', data);
      return extract(res) as PayrollRun;
    },
    approve: async (id: string) => {
      const res = await apiClient.patch(`/hr/payroll-runs/${id}/approve`);
      return extract(res) as PayrollRun;
    },
    markPaid: async (id: string) => {
      const res = await apiClient.patch(`/hr/payroll-runs/${id}/mark-paid`);
      return extract(res) as PayrollRun;
    },
  },
};
