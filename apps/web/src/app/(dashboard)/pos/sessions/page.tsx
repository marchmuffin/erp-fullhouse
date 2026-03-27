'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import { posApi } from '@/lib/api/pos';
import type { PosSession } from '@/lib/api/pos';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const openSchema = z.object({
  cashierName: z.string().min(1, '請輸入收銀員姓名').max(100),
  openingCash: z.coerce.number().min(0).optional(),
});

function formatCurrency(n: number | string) {
  return `NT$ ${Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0 })}`;
}

function formatDateTime(s: string) {
  if (!s) return '--';
  return new Date(s).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}

const COLUMNS: Column<PosSession>[] = [
  { key: 'sessionNo', header: '班次號', width: 'w-44' },
  { key: 'cashierName', header: '收銀員', width: 'w-28' },
  {
    key: 'openedAt', header: '開班時間', width: 'w-40',
    render: (r) => formatDateTime(r.openedAt),
  },
  {
    key: 'closedAt', header: '結班時間', width: 'w-40',
    render: (r) => r.closedAt ? formatDateTime(r.closedAt) : '--',
  },
  {
    key: 'totalOrders', header: '訂單數', width: 'w-20',
    render: (r) => String(r.totalOrders),
  },
  {
    key: 'totalSales', header: '銷售額', width: 'w-32',
    render: (r) => formatCurrency(r.totalSales),
  },
  {
    key: 'status', header: '狀態', width: 'w-20',
    render: (r) => (
      <Badge variant={r.status === 'open' ? 'success' : 'secondary'}>
        {r.status === 'open' ? '開班中' : '已結班'}
      </Badge>
    ),
  },
];

export default function SessionsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pos-sessions', page],
    queryFn: () => posApi.sessions.list({ page, perPage: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: z.infer<typeof openSchema>) => posApi.sessions.open(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
      qc.invalidateQueries({ queryKey: ['pos-active-session'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof openSchema>>({
    resolver: zodResolver(openSchema),
    defaultValues: { openingCash: 0 },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">班次管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 個班次</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['pos-sessions'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 開新班次
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/pos/sessions/${row.id}`)}
        emptyMessage="尚無班次紀錄"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>開新班次</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">收銀員姓名 *</label>
              <Input placeholder="王小明" {...register('cashierName')} />
              {errors.cashierName && <p className="text-xs text-destructive">{errors.cashierName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">開班備用金 (NT$)</label>
              <Input type="number" min={0} placeholder="5000" {...register('openingCash')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '開班中...' : '開始班次'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
