'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PackagePlus, PackageMinus } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import type { Item } from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const txnSchema = z.object({
  itemId: z.string().min(1, '請選擇品項'),
  quantity: z.coerce.number().positive('數量必須大於 0'),
  unitCost: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type TxnFormData = z.infer<typeof txnSchema>;

export default function WarehouseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory-warehouse', id] });

  const [showReceive, setShowReceive] = useState(false);
  const [showIssue, setShowIssue] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const { data: warehouse, isLoading } = useQuery({
    queryKey: ['inventory-warehouse', id],
    queryFn: () => inventoryApi.warehouses.get(id),
  });

  const { data: itemsData } = useQuery({
    queryKey: ['inventory-items-all'],
    queryFn: () => inventoryApi.items.list({ perPage: 200 }),
  });
  const allItems: Item[] = itemsData?.data ?? [];

  const receiveMutation = useMutation({
    mutationFn: (d: TxnFormData) =>
      inventoryApi.transactions.receive({ warehouseId: id, ...d }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      setShowReceive(false);
      receiveForm.reset();
    },
  });

  const issueMutation = useMutation({
    mutationFn: (d: TxnFormData) =>
      inventoryApi.transactions.issue({ warehouseId: id, ...d }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      setShowIssue(false);
      issueForm.reset();
    },
  });

  const receiveForm = useForm<TxnFormData>({
    resolver: zodResolver(txnSchema),
    defaultValues: { unitCost: 0 },
  });

  const issueForm = useForm<TxnFormData>({
    resolver: zodResolver(txnSchema),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!warehouse) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground">{warehouse.code}</span>
              <h2 className="text-xl font-bold text-foreground">{warehouse.name}</h2>
              <Badge variant={warehouse.isActive ? 'success' : 'secondary'}>
                {warehouse.isActive ? '啟用' : '停用'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              最後更新：{formatDateTime(warehouse.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowIssue(true)}>
            <PackageMinus size={14} /> 出庫
          </Button>
          <Button size="sm" onClick={() => setShowReceive(true)}>
            <PackagePlus size={14} /> 入庫
          </Button>
        </div>
      </div>

      {/* Location Info */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">倉庫資訊</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">倉庫代碼</dt>
            <dd className="font-mono">{warehouse.code}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">位置</dt>
            <dd>{warehouse.location ?? '—'}</dd>
          </div>
        </dl>
      </div>

      {/* Stock Levels Table */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">庫存品項</h3>
          <span className="text-xs text-muted-foreground">
            共 {warehouse.stockLevels?.length ?? 0} 個品項
          </span>
        </div>
        {!warehouse.stockLevels || warehouse.stockLevels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">尚無庫存資料</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['料號', '品名', '單位', '現有庫存', '保留庫存', '可用庫存', ''].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {warehouse.stockLevels.map((sl) => {
                const available = Number(sl.quantity) - 0; // reservedQty not in this view
                return (
                  <tr key={sl.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {sl.item.code}
                    </td>
                    <td className="px-3 py-2.5">{sl.item.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{sl.item.unit}</td>
                    <td className="px-3 py-2.5 font-medium">
                      {Number(sl.quantity).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">—</td>
                    <td className="px-3 py-2.5">
                      {Number(sl.quantity).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          setSelectedItemId(sl.item.id);
                          setShowReceive(true);
                          receiveForm.setValue('itemId', sl.item.id);
                        }}
                      >
                        調整
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Receive Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>入庫 — {warehouse.name}</DialogTitle>
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
            <DialogTitle>出庫 — {warehouse.name}</DialogTitle>
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
                {(warehouse.stockLevels ?? []).map((sl) => (
                  <option key={sl.item.id} value={sl.item.id}>
                    {sl.item.code} — {sl.item.name} (庫存: {Number(sl.quantity).toLocaleString()})
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
