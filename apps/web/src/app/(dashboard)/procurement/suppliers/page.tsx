'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { procurementApi } from '@/lib/api/procurement';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Supplier } from '@/lib/api/procurement';

const GRADE_VARIANT: Record<string, any> = { A: 'success', B: 'info', C: 'warning', D: 'destructive' };

const COLUMNS: Column<Supplier>[] = [
  { key: 'code', header: '供應商代碼', width: 'w-32' },
  { key: 'name', header: '供應商名稱' },
  {
    key: 'grade', header: '等級', width: 'w-20',
    render: (r) => <Badge variant={GRADE_VARIANT[r.grade] ?? 'outline'}>{r.grade} 級</Badge>,
  },
  { key: 'paymentTerms', header: '付款條件', width: 'w-28', render: (r) => `Net ${r.paymentTerms}` },
  { key: 'contactPhone', header: '聯絡電話', width: 'w-36' },
  {
    key: 'isActive', header: '狀態', width: 'w-20',
    render: (r) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? '啟用' : '停用'}</Badge>,
  },
];

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  paymentTerms: z.coerce.number().min(0).optional(),
  grade: z.enum(['A', 'B', 'C', 'D']).optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

export default function SuppliersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => procurementApi.suppliers.list({ page, perPage: 20, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => procurementApi.suppliers.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setShowCreate(false); reset(); },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { grade: 'C' as const, paymentTerms: 30, currency: 'TWD' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">供應商管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta.total ?? 0} 家供應商</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> 新增供應商</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜尋代碼、名稱..." className="pl-9" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['suppliers'] })}><RefreshCw size={14} /></Button>
      </div>

      <DataTable columns={COLUMNS} data={(data?.data as any) ?? []} meta={data?.meta} loading={isLoading} onPageChange={setPage} emptyMessage="尚無供應商資料" />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增供應商</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">供應商代碼 *</label>
                <Input placeholder="SUP001" {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">等級</label>
                <select className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...register('grade')}>
                  {['A', 'B', 'C', 'D'].map((g) => <option key={g} value={g}>{g} 級</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">供應商名稱 *</label>
              <Input placeholder="ABC Materials Co." {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">聯絡人</label>
                <Input placeholder="王大明" {...register('contactName')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">聯絡電話</label>
                <Input placeholder="+886-2-12345678" {...register('contactPhone')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">付款條件 (天)</label>
              <Input type="number" placeholder="30" {...register('paymentTerms')} />
            </div>
            {createMutation.error && <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? '儲存中...' : '建立供應商'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
