'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { qualityApi } from '@/lib/api/quality';
import type { NonConformance } from '@/lib/api/quality';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDateTime } from '@/lib/utils';

const SEVERITY_LABEL: Record<string, string> = {
  minor: '輕微',
  major: '重大',
  critical: '嚴重',
};

const SEVERITY_VARIANT: Record<string, any> = {
  minor: 'warning',
  major: 'destructive',
  critical: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  open: '待處理',
  in_review: '處理中',
  resolved: '已解決',
  closed: '已關閉',
};

const STATUS_VARIANT: Record<string, any> = {
  open: 'destructive',
  in_review: 'warning',
  resolved: 'info',
  closed: 'secondary',
};

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'open', label: '待處理' },
  { value: 'in_review', label: '處理中' },
  { value: 'resolved', label: '已解決' },
  { value: 'closed', label: '已關閉' },
];

const schema = z.object({
  severity: z.enum(['minor', 'major', 'critical']),
  description: z.string().min(1, '請輸入異常說明'),
  inspectionOrderId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const COLUMNS: Column<NonConformance>[] = [
  { key: 'ncrNo', header: 'NCR 號', width: 'w-36' },
  {
    key: 'severity', header: '嚴重度', width: 'w-24',
    render: (r) => (
      <Badge
        variant={SEVERITY_VARIANT[r.severity] ?? 'outline'}
        className={r.severity === 'critical' ? 'ring-1 ring-red-500' : undefined}
      >
        {SEVERITY_LABEL[r.severity] ?? r.severity}
      </Badge>
    ),
  },
  {
    key: 'description', header: '說明',
    render: (r) => (
      <span className="block max-w-xs truncate">{r.description}</span>
    ),
  },
  {
    key: 'status', header: '狀態', width: 'w-24',
    render: (r) => (
      <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
    ),
  },
  {
    key: 'createdAt', header: '建立時間', width: 'w-36',
    render: (r) => formatDateTime(r.createdAt),
  },
];

export default function NcrsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['ncrs', page, statusFilter, severityFilter, search],
    queryFn: () =>
      qualityApi.ncrs.list({
        page,
        perPage: 20,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        search: search || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (d: FormValues) => qualityApi.ncrs.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ncrs'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { severity: 'minor' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">品質異常管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta.total ?? 0} 筆異常記錄</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> 新增 NCR
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋 NCR 號、說明..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setSearch(searchInput); setPage(1); }
            }}
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-border bg-input px-3 text-sm text-foreground focus-visible:outline-none"
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
        >
          <option value="">所有嚴重度</option>
          <option value="minor">輕微</option>
          <option value="major">重大</option>
          <option value="critical">嚴重</option>
        </select>
        <Button
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ['ncrs'] })}
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
        onRowClick={(row) => router.push(`/quality/ncrs/${row.id}`)}
        emptyMessage="尚無品質異常記錄"
      />

      {/* Create NCR Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增品質異常 (NCR)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">嚴重度 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('severity')}
              >
                <option value="minor">輕微 (Minor)</option>
                <option value="major">重大 (Major)</option>
                <option value="critical">嚴重 (Critical)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">相關檢驗單 ID (選填)</label>
              <Input
                placeholder="貼入檢驗單 ID"
                {...register('inspectionOrderId')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">異常說明 *</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="詳細描述品質異常情形..."
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '建立中...' : '建立 NCR'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
