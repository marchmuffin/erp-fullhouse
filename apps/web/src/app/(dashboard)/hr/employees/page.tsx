'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { hrApi, type Employee, type CreateEmployeePayload } from '@/lib/api/hr';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  active: { label: '在職', variant: 'success' },
  on_leave: { label: '請假中', variant: 'warning' },
  terminated: { label: '已離職', variant: 'secondary' },
};

const createEmployeeSchema = z.object({
  empNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  hireDate: z.string().min(1),
  salary: z.coerce.number().min(0).optional(),
  salaryType: z.enum(['monthly', 'hourly']).optional(),
  notes: z.string().optional(),
});

type CreateForm = z.infer<typeof createEmployeeSchema>;

const STATUS_TABS = ['全部', 'active', 'on_leave', 'terminated'] as const;
const STATUS_TAB_LABELS: Record<string, string> = {
  全部: '全部',
  active: '在職',
  on_leave: '請假中',
  terminated: '已離職',
};

const COLUMNS: Column<Employee>[] = [
  { key: 'empNo', header: '員工編號', width: 'w-28' },
  {
    key: 'firstName',
    header: '姓名',
    render: (row) => `${row.lastName}${row.firstName}`,
  },
  { key: 'department', header: '部門', width: 'w-28' },
  { key: 'position', header: '職位', width: 'w-28' },
  {
    key: 'hireDate',
    header: '入職日期',
    width: 'w-28',
    render: (row) => new Date(row.hireDate).toLocaleDateString('zh-TW'),
  },
  {
    key: 'status',
    header: '狀態',
    width: 'w-24',
    render: (row) => {
      const s = STATUS_MAP[row.status] ?? { label: row.status, variant: 'secondary' as const };
      return <Badge variant={s.variant as any}>{s.label}</Badge>;
    },
  },
];

export default function EmployeesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('全部');
  const [showCreate, setShowCreate] = useState(false);

  const activeStatus = statusFilter === '全部' ? undefined : statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search, activeStatus],
    queryFn: () => hrApi.employees.list({ page, perPage: 20, search: search || undefined, status: activeStatus }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload) => hrApi.employees.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { salaryType: 'monthly', salary: 0 },
  });

  const onSubmit = (data: CreateForm) => createMutation.mutate(data as CreateEmployeePayload);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">員工管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {data?.meta.total ?? 0} 位員工
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> 新增員工
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatusFilter(tab); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {STATUS_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋員工編號、姓名..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setSearch(searchInput); setPage(1); }
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['employees'] })}
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/hr/employees/${row.id}`)}
        emptyMessage="尚無員工資料，請點擊「新增員工」建立"
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新增員工</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">員工編號 *</label>
                <Input placeholder="EMP001" {...register('empNo')} />
                {errors.empNo && <p className="text-xs text-destructive">{errors.empNo.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">姓 *</label>
                <Input placeholder="王" {...register('lastName')} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">名 *</label>
                <Input placeholder="大明" {...register('firstName')} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input placeholder="employee@company.com" {...register('email')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">電話</label>
                <Input placeholder="0912-345-678" {...register('phone')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">部門</label>
                <Input placeholder="業務部" {...register('department')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">職位</label>
                <Input placeholder="業務專員" {...register('position')} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">入職日期 *</label>
                <Input type="date" {...register('hireDate')} />
                {errors.hireDate && <p className="text-xs text-destructive">{errors.hireDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">薪資</label>
                <Input type="number" placeholder="50000" {...register('salary')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">薪資類型</label>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('salaryType')}
                >
                  <option value="monthly">月薪</option>
                  <option value="hourly">時薪</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="備註..."
                {...register('notes')}
              />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                {createMutation.isPending ? '儲存中...' : '建立員工'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
