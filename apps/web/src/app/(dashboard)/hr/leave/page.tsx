'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { hrApi, type LeaveRequest, type CreateLeavePayload } from '@/lib/api/hr';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDate } from '@/lib/utils';

const LEAVE_TYPE_MAP: Record<string, { label: string; variant: any }> = {
  annual: { label: '年假', variant: 'info' },
  sick: { label: '病假', variant: 'warning' },
  personal: { label: '事假', variant: 'secondary' },
  unpaid: { label: '無薪假', variant: 'outline' },
};

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  pending: { label: '待審', variant: 'warning' },
  approved: { label: '已核准', variant: 'success' },
  rejected: { label: '已駁回', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'secondary' },
};

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待審' },
  { value: 'approved', label: '已核准' },
  { value: 'rejected', label: '已駁回' },
];

const createLeaveSchema = z.object({
  employeeId: z.string().min(1, '必填'),
  leaveType: z.enum(['annual', 'sick', 'personal', 'unpaid']),
  startDate: z.string().min(1, '必填'),
  endDate: z.string().min(1, '必填'),
  days: z.coerce.number().min(0.5, '最少0.5天'),
  reason: z.string().optional(),
});

type CreateForm = z.infer<typeof createLeaveSchema>;

export default function LeavePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hr-leave', page, statusFilter],
    queryFn: () => hrApi.leave.list({ page, perPage: 20, status: statusFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateLeavePayload) => hrApi.leave.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-leave'] });
      setShowCreate(false);
      reset();
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => hrApi.leave.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-leave'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => hrApi.leave.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-leave'] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createLeaveSchema),
    defaultValues: { leaveType: 'annual', days: 1 },
  });

  const COLUMNS: Column<LeaveRequest>[] = [
    { key: 'employeeId', header: '員工ID', width: 'w-36' },
    {
      key: 'leaveType', header: '假別', width: 'w-24',
      render: (r) => {
        const m = LEAVE_TYPE_MAP[r.leaveType] ?? { label: r.leaveType, variant: 'secondary' };
        return <Badge variant={m.variant}>{m.label}</Badge>;
      },
    },
    {
      key: 'startDate', header: '開始日期', width: 'w-28',
      render: (r) => formatDate(r.startDate),
    },
    {
      key: 'endDate', header: '結束日期', width: 'w-28',
      render: (r) => formatDate(r.endDate),
    },
    { key: 'days', header: '天數', width: 'w-16', render: (r) => String(r.days) },
    {
      key: 'status', header: '狀態', width: 'w-24',
      render: (r) => {
        const m = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' };
        return <Badge variant={m.variant}>{m.label}</Badge>;
      },
    },
    {
      key: 'id', header: '操作', width: 'w-32',
      render: (r) => r.status === 'pending' ? (
        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs text-green-400 border-green-800 hover:bg-green-900/30"
            onClick={() => approveMutation.mutate(r.id)}
            disabled={approveMutation.isPending}
          >
            核准
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs text-red-400 border-red-800 hover:bg-red-900/30"
            onClick={() => rejectMutation.mutate(r.id)}
            disabled={rejectMutation.isPending}
          >
            駁回
          </Button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">假勤管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆假單</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['hr-leave'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 申請假單
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        emptyMessage="尚無假單資料"
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>申請假單</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d as CreateLeavePayload))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">員工ID *</label>
              <Input placeholder="emp-uuid" {...register('employeeId')} />
              {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">假別 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('leaveType')}
              >
                <option value="annual">年假</option>
                <option value="sick">病假</option>
                <option value="personal">事假</option>
                <option value="unpaid">無薪假</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">開始日期 *</label>
                <Input type="date" {...register('startDate')} />
                {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">結束日期 *</label>
                <Input type="date" {...register('endDate')} />
                {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">天數 *</label>
              <Input type="number" step="0.5" min="0.5" {...register('days')} />
              {errors.days && <p className="text-xs text-destructive">{errors.days.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">原因</label>
              <Input placeholder="請假原因..." {...register('reason')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '送出中...' : '送出申請'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
