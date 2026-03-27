'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { hrApi, type PayrollItem } from '@/lib/api/hr';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  approved: { label: '已核准', variant: 'success' },
  paid: { label: '已發放', variant: 'info' },
};

const ITEM_COLUMNS: Column<PayrollItem>[] = [
  { key: 'empNo', header: '員工編號', width: 'w-28' },
  { key: 'empName', header: '姓名', width: 'w-28' },
  {
    key: 'baseSalary', header: '底薪', width: 'w-32',
    render: (r) => formatCurrency(r.baseSalary),
  },
  {
    key: 'allowances', header: '津貼', width: 'w-32',
    render: (r) => formatCurrency(r.allowances),
  },
  {
    key: 'deductions', header: '扣除', width: 'w-32',
    render: (r) => formatCurrency(r.deductions),
  },
  {
    key: 'netPay', header: '實領', width: 'w-32',
    render: (r) => formatCurrency(r.netPay),
  },
];

export default function PayrollDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: run, isLoading } = useQuery({
    queryKey: ['hr-payroll-detail', id],
    queryFn: () => hrApi.payroll.get(id),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => hrApi.payroll.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-payroll-detail', id] }),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => hrApi.payroll.markPaid(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hr-payroll-detail', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">找不到薪資單</p>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[run.status] ?? { label: run.status, variant: 'secondary' };
  const items = run.items ?? [];

  const totalBaseSalary = items.reduce((s, i) => s + i.baseSalary, 0);
  const totalAllowances = items.reduce((s, i) => s + i.allowances, 0);
  const totalDeductions = items.reduce((s, i) => s + i.deductions, 0);
  const totalNetPay = items.reduce((s, i) => s + i.netPay, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{run.runNo}</h2>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">期別：{run.period}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {run.status === 'draft' && (
            <Button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? '核准中...' : '核准薪資單'}
            </Button>
          )}
          {run.status === 'approved' && (
            <Button
              onClick={() => markPaidMutation.mutate()}
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending ? '更新中...' : '標記已付'}
            </Button>
          )}
          {run.status === 'paid' && (
            <span className="px-3 py-1.5 text-sm font-medium text-green-400 bg-green-900/20 rounded-md border border-green-800">
              已發放
            </span>
          )}
        </div>
      </div>

      {/* Summary card */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">薪資總額</p>
            <p className="text-3xl font-bold text-foreground mt-1">{formatCurrency(run.totalAmount)}</p>
          </div>
          <div className="text-right space-y-1">
            <div className="text-sm text-muted-foreground">
              狀態：<span className="text-foreground">{statusInfo.label}</span>
            </div>
            {run.paidAt && (
              <div className="text-sm text-muted-foreground">
                發放時間：<span className="text-foreground">{formatDateTime(run.paidAt)}</span>
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              建立時間：<span className="text-foreground">{formatDateTime(run.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll items table */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">薪資明細</h3>
        <DataTable
          columns={ITEM_COLUMNS}
          data={(items as any) ?? []}
          loading={false}
          emptyMessage="無薪資明細"
        />
        {items.length > 0 && (
          <div className="glass rounded-b-xl border-t border-border px-4 py-3 flex justify-end">
            <div className="grid grid-cols-4 gap-8 text-sm font-semibold text-foreground">
              <span>底薪合計: {formatCurrency(totalBaseSalary)}</span>
              <span>津貼合計: {formatCurrency(totalAllowances)}</span>
              <span>扣除合計: {formatCurrency(totalDeductions)}</span>
              <span className="text-primary">實領合計: {formatCurrency(totalNetPay)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
