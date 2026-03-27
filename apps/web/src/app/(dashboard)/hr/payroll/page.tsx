'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { hrApi, type PayrollRun, type CreatePayrollPayload } from '@/lib/api/hr';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  approved: { label: '已核准', variant: 'success' },
  paid: { label: '已發放', variant: 'info' },
};

const createPayrollSchema = z.object({
  period: z.string().min(1, '必填'),
});

type CreateForm = z.infer<typeof createPayrollSchema>;

const COLUMNS: Column<PayrollRun>[] = [
  { key: 'runNo', header: '薪資單號', width: 'w-36' },
  { key: 'period', header: '期別', width: 'w-28' },
  {
    key: 'status', header: '狀態', width: 'w-24',
    render: (r) => {
      const m = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' };
      return <Badge variant={m.variant}>{m.label}</Badge>;
    },
  },
  {
    key: 'totalAmount', header: '總金額', width: 'w-36',
    render: (r) => formatCurrency(r.totalAmount),
  },
  {
    key: 'createdAt', header: '建立時間', width: 'w-40',
    render: (r) => formatDateTime(r.createdAt),
  },
];

export default function PayrollPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hr-payroll', page],
    queryFn: () => hrApi.payroll.list({ page, perPage: 20 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreatePayrollPayload) => hrApi.payroll.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-payroll'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createPayrollSchema),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">薪資管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta.total ?? 0} 筆薪資單</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['hr-payroll'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 建立薪資單
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/hr/payroll/${row.id}`)}
        emptyMessage="尚無薪資單資料"
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>建立薪資單</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate({ period: d.period }))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">薪資期別 *</label>
              <Input placeholder="2024-01" {...register('period')} />
              {errors.period && <p className="text-xs text-destructive">{errors.period.message}</p>}
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '建立中...' : '建立薪資單'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
