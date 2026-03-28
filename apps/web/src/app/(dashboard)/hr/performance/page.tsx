'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { hrApi, type PerformanceReview, type CreatePerformancePayload } from '@/lib/api/hr';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDate } from '@/lib/utils';

const REVIEW_TYPE_MAP: Record<string, { label: string; variant: any }> = {
  annual:    { label: '年度考核', variant: 'info' },
  mid_year:  { label: '期中考核', variant: 'secondary' },
  probation: { label: '試用考核', variant: 'warning' },
  project:   { label: '專案考核', variant: 'outline' },
};

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  draft:      { label: '草稿',   variant: 'secondary' },
  in_review:  { label: '考核中', variant: 'warning' },
  completed:  { label: '已完成', variant: 'success' },
  cancelled:  { label: '已取消', variant: 'destructive' },
};

const STATUS_TABS = [
  { value: '',           label: '全部' },
  { value: 'draft',      label: '草稿' },
  { value: 'in_review',  label: '考核中' },
  { value: 'completed',  label: '已完成' },
  { value: 'cancelled',  label: '已取消' },
];

const SCORE_LABELS: Record<number, string> = {
  1: '1 - 不符預期',
  2: '2 - 待改善',
  3: '3 - 符合預期',
  4: '4 - 超出預期',
  5: '5 - 卓越表現',
};

const createReviewSchema = z.object({
  employeeId: z.string().min(1, '必填'),
  period:     z.string().min(1, '必填'),
  reviewType: z.enum(['annual', 'mid_year', 'probation', 'project']),
  reviewerId: z.string().optional(),
  comments:   z.string().optional(),
});

type CreateForm = z.infer<typeof createReviewSchema>;

export default function PerformancePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hr-performance', page, statusFilter],
    queryFn: () => hrApi.performance.list({ page, perPage: 20, status: statusFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePerformancePayload) => hrApi.performance.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-performance'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createReviewSchema),
    defaultValues: { reviewType: 'annual' },
  });

  const COLUMNS: Column<PerformanceReview>[] = [
    { key: 'reviewNo', header: '考核編號', width: 'w-36' },
    {
      key: 'employeeId', header: '員工', width: 'w-36',
      render: (r: any) => r.employee
        ? <span>{r.employee.empNo} {r.employee.lastName}{r.employee.firstName}</span>
        : r.employeeId,
    },
    { key: 'period', header: '考核期間', width: 'w-28' },
    {
      key: 'reviewType', header: '類型', width: 'w-28',
      render: (r) => {
        const m = REVIEW_TYPE_MAP[r.reviewType] ?? { label: r.reviewType, variant: 'secondary' };
        return <Badge variant={m.variant}>{m.label}</Badge>;
      },
    },
    {
      key: 'overallScore', header: '總評分', width: 'w-28',
      render: (r) => r.overallScore != null
        ? <Badge variant={r.overallScore >= 4 ? 'success' : r.overallScore <= 2 ? 'destructive' : 'info'}>
            {r.overallScore} 分
          </Badge>
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'status', header: '狀態', width: 'w-24',
      render: (r) => {
        const m = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' };
        return <Badge variant={m.variant}>{m.label}</Badge>;
      },
    },
    {
      key: 'createdAt', header: '建立日期', width: 'w-28',
      render: (r) => formatDate(r.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">績效考核</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆考核記錄</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['hr-performance'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 新建考核
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
        emptyMessage="尚無績效考核資料"
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新建績效考核</DialogTitle></DialogHeader>
          <form
            onSubmit={handleSubmit((d) => createMutation.mutate(d as CreatePerformancePayload))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">員工ID *</label>
              <Input placeholder="emp-uuid" {...register('employeeId')} />
              {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">考核期間 *</label>
              <Input placeholder="例：2026-Q1、2026-H1、2026-FY" {...register('period')} />
              {errors.period && <p className="text-xs text-destructive">{errors.period.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">考核類型 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('reviewType')}
              >
                <option value="annual">年度考核</option>
                <option value="mid_year">期中考核</option>
                <option value="probation">試用考核</option>
                <option value="project">專案考核</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">考核人ID</label>
              <Input placeholder="reviewer-uuid（選填）" {...register('reviewerId')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="備註說明..." {...register('comments')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '建立中...' : '建立考核'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
