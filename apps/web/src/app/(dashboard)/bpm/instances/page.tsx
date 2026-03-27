'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { bpmApi } from '@/lib/api/bpm';
import type { WorkflowInstance } from '@/lib/api/bpm';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function formatDate(s: string | undefined | null) {
  if (!s) return '--';
  return new Date(s).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}

const DOC_TYPE_LABEL: Record<string, string> = {
  so: '銷售訂單',
  po: '採購訂單',
  pr: '請購單',
  leave: '請假單',
  payroll: '薪資單',
  wo: '工單',
  inspection: '檢驗單',
};

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待審',
  approved: '已核准',
  rejected: '已駁回',
  cancelled: '已取消',
};

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待審' },
  { value: 'approved', label: '已核准' },
  { value: 'rejected', label: '已駁回' },
];

const COLUMNS: Column<WorkflowInstance>[] = [
  {
    key: 'id',
    header: '流程號',
    width: 'w-28',
    render: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}…</span>
    ),
  },
  {
    key: 'docType',
    header: '文件類型',
    width: 'w-28',
    render: (r) => (
      <Badge variant="outline" className="text-xs">
        {DOC_TYPE_LABEL[r.docType] ?? r.docType}
      </Badge>
    ),
  },
  {
    key: 'docNo',
    header: '文件號',
    width: 'w-44',
    render: (r) => <span className="font-medium text-sm">{r.docNo}</span>,
  },
  {
    key: 'submittedBy',
    header: '申請人',
    width: 'w-28',
    render: (r) => <span className="text-sm">{r.submittedBy}</span>,
  },
  {
    key: 'currentStep',
    header: '步驟',
    width: 'w-20',
    render: (r) => (
      <span className="text-sm font-mono">
        {r.currentStep}/{(r as any).definition?.steps ?? '?'}
      </span>
    ),
  },
  {
    key: 'status',
    header: '狀態',
    width: 'w-24',
    render: (r) => (
      <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>
        {STATUS_LABEL[r.status] ?? r.status}
      </Badge>
    ),
  },
  {
    key: 'submittedAt',
    header: '申請時間',
    width: 'w-40',
    render: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.submittedAt)}</span>,
  },
];

export default function InstancesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bpm-instances', page, statusFilter],
    queryFn: () =>
      bpmApi.instances.list({
        page,
        perPage: 20,
        status: statusFilter || undefined,
      }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">稽核軌跡</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {data?.meta?.total ?? 0} 筆流程記錄
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ['bpm-instances'] })}
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatusFilter(tab.value);
              setPage(1);
            }}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              statusFilter === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
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
        onRowClick={(row) => router.push(`/bpm/instances/${row.id}`)}
        emptyMessage="尚無流程記錄"
      />
    </div>
  );
}
