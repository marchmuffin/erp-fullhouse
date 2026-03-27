'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Item } from '@/lib/api/inventory';

const COLUMNS: Column<Item>[] = [
  { key: 'code', header: '料號', width: 'w-32', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: 'name', header: '品名' },
  { key: 'category', header: '類別', width: 'w-28', render: (r) => r.category ?? '—' },
  { key: 'unit', header: '單位', width: 'w-20' },
  {
    key: 'safetyStock',
    header: '安全庫存',
    width: 'w-28',
    render: (r) => Number(r.safetyStock).toLocaleString(),
  },
  {
    key: 'isActive',
    header: '狀態',
    width: 'w-20',
    render: (r) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? '啟用' : '停用'}</Badge>,
  },
];

const schema = z.object({
  code: z.string().min(1, '必填').max(50),
  name: z.string().min(1, '必填').max(200),
  category: z.string().optional(),
  unit: z.string().min(1, '必填').default('PCS'),
  unitCost: z.coerce.number().min(0).optional(),
  safetyStock: z.coerce.number().min(0).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function ItemsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-items', page, search],
    queryFn: () => inventoryApi.items.list({ page, perPage: 20, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (d: FormData) => inventoryApi.items.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      setShowCreate(false);
      reset();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { unit: 'PCS', unitCost: 0, safetyStock: 0, reorderPoint: 0 },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">品項管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta.total ?? 0} 個品項</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> 新增品項
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋料號、品名..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSearch(searchInput);
                setPage(1);
              }
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ['inventory-items'] })}
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
        onRowClick={(row) => router.push(`/inventory/items/${(row as Item).id}`)}
        emptyMessage="尚無品項資料"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增品項</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">料號 *</label>
                <Input placeholder="ITEM-001" {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">單位</label>
                <Input placeholder="PCS" {...register('unit')} />
                {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">品名 *</label>
              <Input placeholder="品項名稱" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">類別</label>
              <Input placeholder="原料 / 半成品 / 成品" {...register('category')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">單位成本</label>
                <Input type="number" step="0.01" placeholder="0" {...register('unitCost')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">安全庫存</label>
                <Input type="number" placeholder="0" {...register('safetyStock')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">再訂購點</label>
                <Input type="number" placeholder="0" {...register('reorderPoint')} />
              </div>
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
                {createMutation.isPending ? '儲存中...' : '建立品項'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
