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
import type { Warehouse } from '@/lib/api/inventory';

const COLUMNS: Column<Warehouse>[] = [
  {
    key: 'code',
    header: '倉庫代碼',
    width: 'w-32',
    render: (r) => <span className="font-mono text-xs">{r.code}</span>,
  },
  { key: 'name', header: '名稱' },
  { key: 'location', header: '位置', render: (r) => r.location ?? '—' },
  {
    key: 'stockLevels',
    header: '品項數',
    width: 'w-24',
    render: (r: any) => (r._count?.stockLevels ?? r.stockLevels?.length ?? '—').toLocaleString(),
  },
  {
    key: 'isActive',
    header: '狀態',
    width: 'w-20',
    render: (r) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? '啟用' : '停用'}</Badge>,
  },
];

const schema = z.object({
  code: z.string().min(1, '必填').max(20),
  name: z.string().min(1, '必填').max(100),
  location: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function WarehousesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-warehouses', page, search],
    queryFn: () => inventoryApi.warehouses.list({ page, perPage: 20, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (d: FormData) => inventoryApi.warehouses.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-warehouses'] });
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
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">倉庫管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 個倉庫</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> 新增倉庫
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋代碼、名稱..."
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
          onClick={() => qc.invalidateQueries({ queryKey: ['inventory-warehouses'] })}
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
        onRowClick={(row) => router.push(`/inventory/warehouses/${(row as Warehouse).id}`)}
        emptyMessage="尚無倉庫資料"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增倉庫</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">倉庫代碼 *</label>
                <Input placeholder="WH-001" {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">倉庫名稱 *</label>
                <Input placeholder="主倉庫" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">位置</label>
              <Input placeholder="台北市中山區..." {...register('location')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '儲存中...' : '建立倉庫'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
