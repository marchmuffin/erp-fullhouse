'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { qualityApi } from '@/lib/api/quality';
import type { InspectionOrder } from '@/lib/api/quality';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDateTime } from '@/lib/utils';

const TYPE_LABEL: Record<string, string> = {
  incoming: '進料檢驗',
  in_process: '製程檢驗',
  outgoing: '出貨檢驗',
};

const TYPE_VARIANT: Record<string, any> = {
  incoming: 'info',
  in_process: 'warning',
  outgoing: 'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待檢驗',
  in_progress: '檢驗中',
  passed: '合格',
  failed: '不合格',
  on_hold: '待確認',
};

const STATUS_VARIANT: Record<string, any> = {
  pending: 'secondary',
  in_progress: 'warning',
  passed: 'success',
  failed: 'destructive',
  on_hold: 'outline',
};

const TYPE_TABS = [
  { value: '', label: '全部' },
  { value: 'incoming', label: '進料' },
  { value: 'in_process', label: '製程' },
  { value: 'outgoing', label: '出貨' },
];

const schema = z.object({
  type: z.enum(['incoming', 'in_process', 'outgoing']),
  refDocType: z.string().optional(),
  refDocNo: z.string().optional(),
  itemName: z.string().min(1, '請輸入品名'),
  quantity: z.coerce.number().min(0.0001, '數量須大於 0'),
  inspector: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const COLUMNS: Column<InspectionOrder>[] = [
  { key: 'ioNo', header: '檢驗單號', width: 'w-36' },
  {
    key: 'type', header: '類型', width: 'w-28',
    render: (r) => (
      <Badge variant={TYPE_VARIANT[r.type] ?? 'outline'}>{TYPE_LABEL[r.type] ?? r.type}</Badge>
    ),
  },
  { key: 'itemName', header: '品名' },
  {
    key: 'quantity', header: '數量', width: 'w-24',
    render: (r) => Number(r.quantity).toLocaleString(),
  },
  {
    key: 'status', header: '狀態', width: 'w-28',
    render: (r) => (
      <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
    ),
  },
  {
    key: 'createdAt', header: '建立時間', width: 'w-36',
    render: (r) => formatDateTime(r.createdAt),
  },
];

export default function InspectionsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inspections', page, typeFilter, search],
    queryFn: () =>
      qualityApi.inspections.list({
        page,
        perPage: 20,
        type: typeFilter || undefined,
        search: search || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (d: FormValues) => qualityApi.inspections.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspections'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'incoming', quantity: 1 },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">檢驗單管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta.total ?? 0} 筆檢驗單</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> 新增檢驗單
        </Button>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-1 border-b border-border">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setTypeFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              typeFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋檢驗單號、品名..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setSearch(searchInput); setPage(1); }
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ['inspections'] })}
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
        onRowClick={(row) => router.push(`/quality/inspections/${row.id}`)}
        emptyMessage="尚無檢驗單資料"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增檢驗單</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">檢驗類型 *</label>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('type')}
                >
                  <option value="incoming">進料檢驗</option>
                  <option value="in_process">製程檢驗</option>
                  <option value="outgoing">出貨檢驗</option>
                </select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">參考單據類型</label>
                <Input placeholder="PO / WO / SO" {...register('refDocType')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">參考單號</label>
              <Input placeholder="PO-202401-0001" {...register('refDocNo')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">品名 *</label>
                <Input placeholder="輸入品名" {...register('itemName')} />
                {errors.itemName && (
                  <p className="text-xs text-destructive">{errors.itemName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">數量 *</label>
                <Input type="number" step="any" placeholder="100" {...register('quantity')} />
                {errors.quantity && (
                  <p className="text-xs text-destructive">{errors.quantity.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">檢驗員</label>
              <Input placeholder="指定檢驗人員" {...register('inspector')} />
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
                {createMutation.isPending ? '建立中...' : '建立檢驗單'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
