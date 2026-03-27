'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import type { Warehouse, StockCount } from '@/lib/api/inventory';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  in_progress: { label: '盤點中', variant: 'warning' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'outline' },
};

const COLUMNS: Column<StockCount>[] = [
  {
    key: 'countNo',
    header: '盤點單號',
    width: 'w-40',
    render: (r) => <span className="font-mono text-xs">{r.countNo}</span>,
  },
  {
    key: 'warehouse',
    header: '倉庫',
    width: 'w-40',
    render: (r) => (r.warehouse ? r.warehouse.name : '—'),
  },
  {
    key: 'status',
    header: '狀態',
    width: 'w-28',
    render: (r) => {
      const cfg = STATUS_CONFIG[r.status] ?? { label: r.status, variant: 'outline' };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
  {
    key: 'countDate',
    header: '盤點日期',
    width: 'w-32',
    render: (r) => formatDate(r.countDate),
  },
  {
    key: 'lines',
    header: '品項數',
    width: 'w-20',
    render: (r) => (r.lines ? r.lines.length.toLocaleString() : '—'),
  },
  {
    key: 'createdAt',
    header: '建立時間',
    width: 'w-40',
    render: (r) => formatDateTime(r.createdAt),
  },
];

const schema = z.object({
  countNo: z.string().min(1, '必填').max(50),
  warehouseId: z.string().min(1, '請選擇倉庫'),
  countDate: z.string().min(1, '必填'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function generateCountNo() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 900 + 100);
  return `CNT-${ymd}-${rand}`;
}

export default function CountsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-counts', page],
    queryFn: () => inventoryApi.counts.list({ page, perPage: 20 }),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses-all'],
    queryFn: () => inventoryApi.warehouses.list({ perPage: 100 }),
  });
  const allWarehouses: Warehouse[] = warehousesData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (d: FormData) => inventoryApi.counts.create(d),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['inventory-counts'] });
      setShowCreate(false);
      reset();
      router.push(`/inventory/counts/${created.id}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      countNo: generateCountNo(),
      countDate: new Date().toISOString().slice(0, 10),
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">盤點管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 張盤點單</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ['inventory-counts'] })}
          >
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => { reset({ countNo: generateCountNo(), countDate: new Date().toISOString().slice(0, 10) }); setShowCreate(true); }}>
            <Plus size={16} /> 新增盤點單
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/inventory/counts/${(row as StockCount).id}`)}
        emptyMessage="尚無盤點單"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增盤點單</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">盤點單號 *</label>
                <Input placeholder="CNT-20260101-001" {...register('countNo')} />
                {errors.countNo && (
                  <p className="text-xs text-destructive">{errors.countNo.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">盤點日期 *</label>
                <Input type="date" {...register('countDate')} />
                {errors.countDate && (
                  <p className="text-xs text-destructive">{errors.countDate.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">倉庫 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('warehouseId')}
              >
                <option value="">請選擇倉庫</option>
                {allWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
              {errors.warehouseId && (
                <p className="text-xs text-destructive">{errors.warehouseId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="備註說明" {...register('notes')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '建立中...' : '建立盤點單'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
