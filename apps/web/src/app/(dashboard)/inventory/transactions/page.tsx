'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, PackagePlus, PackageMinus } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import type { Item, Warehouse } from '@/lib/api/inventory';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { StockTransaction } from '@/lib/api/inventory';

const TXN_TYPE_CONFIG: Record<string, { label: string; variant: any }> = {
  receipt: { label: '入庫', variant: 'success' },
  issue: { label: '出庫', variant: 'warning' },
  adjustment: { label: '調整', variant: 'info' },
  count_adjust: { label: '盤點調整', variant: 'secondary' },
  transfer_in: { label: '調撥入', variant: 'success' },
  transfer_out: { label: '調撥出', variant: 'warning' },
};

const TXN_TYPE_TABS = [
  { value: '', label: '全部' },
  { value: 'receipt', label: '入庫' },
  { value: 'issue', label: '出庫' },
  { value: 'adjustment', label: '調整' },
];

const COLUMNS: Column<StockTransaction>[] = [
  {
    key: 'txnNo',
    header: '異動單號',
    width: 'w-40',
    render: (r) => <span className="font-mono text-xs">{r.txnNo}</span>,
  },
  {
    key: 'item',
    header: '料號/品名',
    render: (r) =>
      r.item ? (
        <div>
          <span className="font-mono text-xs text-muted-foreground mr-1.5">{r.item.code}</span>
          <span>{r.item.name}</span>
        </div>
      ) : (
        '—'
      ),
  },
  {
    key: 'warehouse',
    header: '倉庫',
    width: 'w-32',
    render: (r) => (r.warehouse ? r.warehouse.name : '—'),
  },
  {
    key: 'txnType',
    header: '異動類型',
    width: 'w-28',
    render: (r) => {
      const cfg = TXN_TYPE_CONFIG[r.txnType] ?? { label: r.txnType, variant: 'outline' };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
  {
    key: 'quantity',
    header: '數量',
    width: 'w-24',
    render: (r) => {
      const isOut = r.txnType === 'issue' || r.txnType === 'transfer_out';
      return (
        <span className={cn('font-medium', isOut ? 'text-amber-400' : 'text-emerald-400')}>
          {isOut ? '-' : '+'}{Number(r.quantity).toLocaleString()}
        </span>
      );
    },
  },
  {
    key: 'refDocNo',
    header: '參考單號',
    width: 'w-36',
    render: (r) => r.refDocNo ?? '—',
  },
  {
    key: 'createdAt',
    header: '時間',
    width: 'w-40',
    render: (r) => formatDateTime(r.createdAt),
  },
];

const receiveSchema = z.object({
  itemId: z.string().min(1, '請選擇品項'),
  warehouseId: z.string().min(1, '請選擇倉庫'),
  quantity: z.coerce.number().positive('數量必須大於 0'),
  unitCost: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

const issueSchema = z.object({
  itemId: z.string().min(1, '請選擇品項'),
  warehouseId: z.string().min(1, '請選擇倉庫'),
  quantity: z.coerce.number().positive('數量必須大於 0'),
  notes: z.string().optional(),
});

type ReceiveFormData = z.infer<typeof receiveSchema>;
type IssueFormData = z.infer<typeof issueSchema>;

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeType, setActiveType] = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [showIssue, setShowIssue] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-transactions', page, search, activeType],
    queryFn: () =>
      inventoryApi.transactions.list({
        page,
        perPage: 20,
        search: search || undefined,
        txnType: activeType || undefined,
      }),
  });

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items-all'],
    queryFn: () => inventoryApi.items.list({ perPage: 200 }),
  });
  const allItems: Item[] = itemsData?.data ?? [];

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses-all'],
    queryFn: () => inventoryApi.warehouses.list({ perPage: 100 }),
  });
  const allWarehouses: Warehouse[] = warehousesData?.data ?? [];

  const receiveMutation = useMutation({
    mutationFn: (d: ReceiveFormData) => inventoryApi.transactions.receive(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      setShowReceive(false);
      receiveForm.reset();
    },
  });

  const issueMutation = useMutation({
    mutationFn: (d: IssueFormData) => inventoryApi.transactions.issue(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      setShowIssue(false);
      issueForm.reset();
    },
  });

  const receiveForm = useForm<ReceiveFormData>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { unitCost: 0 },
  });

  const issueForm = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">庫存異動</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆異動記錄</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowIssue(true)}>
            <PackageMinus size={14} /> 手動出庫
          </Button>
          <Button size="sm" onClick={() => setShowReceive(true)}>
            <PackagePlus size={14} /> 手動入庫
          </Button>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          {TXN_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setActiveType(tab.value);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                activeType === tab.value
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋單號、品名..."
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
          onClick={() => qc.invalidateQueries({ queryKey: ['inventory-transactions'] })}
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
        emptyMessage="尚無異動記錄"
      />

      {/* Receive Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>手動入庫</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={receiveForm.handleSubmit((d) => receiveMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">品項 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...receiveForm.register('itemId')}
              >
                <option value="">請選擇品項</option>
                {allItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
              {receiveForm.formState.errors.itemId && (
                <p className="text-xs text-destructive">
                  {receiveForm.formState.errors.itemId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">倉庫 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...receiveForm.register('warehouseId')}
              >
                <option value="">請選擇倉庫</option>
                {allWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
              {receiveForm.formState.errors.warehouseId && (
                <p className="text-xs text-destructive">
                  {receiveForm.formState.errors.warehouseId.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">數量 *</label>
                <Input type="number" step="0.001" placeholder="0" {...receiveForm.register('quantity')} />
                {receiveForm.formState.errors.quantity && (
                  <p className="text-xs text-destructive">
                    {receiveForm.formState.errors.quantity.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">單位成本</label>
                <Input type="number" step="0.01" placeholder="0" {...receiveForm.register('unitCost')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="備註說明" {...receiveForm.register('notes')} />
            </div>
            {receiveMutation.error && (
              <p className="text-sm text-destructive">{(receiveMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowReceive(false)}>
                取消
              </Button>
              <Button type="submit" disabled={receiveMutation.isPending}>
                {receiveMutation.isPending ? '處理中...' : '確認入庫'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Issue Dialog */}
      <Dialog open={showIssue} onOpenChange={setShowIssue}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>手動出庫</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={issueForm.handleSubmit((d) => issueMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">品項 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...issueForm.register('itemId')}
              >
                <option value="">請選擇品項</option>
                {allItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
              {issueForm.formState.errors.itemId && (
                <p className="text-xs text-destructive">
                  {issueForm.formState.errors.itemId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">倉庫 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...issueForm.register('warehouseId')}
              >
                <option value="">請選擇倉庫</option>
                {allWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
              {issueForm.formState.errors.warehouseId && (
                <p className="text-xs text-destructive">
                  {issueForm.formState.errors.warehouseId.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">數量 *</label>
              <Input type="number" step="0.001" placeholder="0" {...issueForm.register('quantity')} />
              {issueForm.formState.errors.quantity && (
                <p className="text-xs text-destructive">
                  {issueForm.formState.errors.quantity.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="備註說明" {...issueForm.register('notes')} />
            </div>
            {issueMutation.error && (
              <p className="text-sm text-destructive">{(issueMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowIssue(false)}>
                取消
              </Button>
              <Button type="submit" disabled={issueMutation.isPending}>
                {issueMutation.isPending ? '處理中...' : '確認出庫'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
