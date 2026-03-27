'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PackagePlus, PackageMinus } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import type { Warehouse } from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const receiveSchema = z.object({
  warehouseId: z.string().min(1, '請選擇倉庫'),
  quantity: z.coerce.number().positive('數量必須大於 0'),
  unitCost: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

const issueSchema = z.object({
  warehouseId: z.string().min(1, '請選擇倉庫'),
  quantity: z.coerce.number().positive('數量必須大於 0'),
  notes: z.string().optional(),
});

type ReceiveFormData = z.infer<typeof receiveSchema>;
type IssueFormData = z.infer<typeof issueSchema>;

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory-item', id] });

  const [showReceive, setShowReceive] = useState(false);
  const [showIssue, setShowIssue] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: () => inventoryApi.items.get(id),
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['inventory-warehouses-all'],
    queryFn: () => inventoryApi.warehouses.list({ perPage: 100 }),
  });
  const warehouses: Warehouse[] = warehousesData?.data ?? [];

  const receiveMutation = useMutation({
    mutationFn: (d: ReceiveFormData) =>
      inventoryApi.transactions.receive({ itemId: id, ...d }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      setShowReceive(false);
      receiveForm.reset();
    },
  });

  const issueMutation = useMutation({
    mutationFn: (d: IssueFormData) =>
      inventoryApi.transactions.issue({ itemId: id, ...d }),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!item) return null;

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
              <span className="font-mono text-sm text-muted-foreground">{item.code}</span>
              <h2 className="text-xl font-bold text-foreground">{item.name}</h2>
              <Badge variant={item.isActive ? 'success' : 'secondary'}>
                {item.isActive ? '啟用' : '停用'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              最後更新：{formatDateTime(item.updatedAt)}
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

      {/* Info Card */}
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">品項資訊</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">類別</dt>
            <dd>{item.category ?? '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">單位</dt>
            <dd>{item.unit}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">單位成本</dt>
            <dd>{formatCurrency(Number(item.unitCost))}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">安全庫存</dt>
            <dd>{Number(item.safetyStock).toLocaleString()} {item.unit}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">再訂購點</dt>
            <dd>{Number(item.reorderPoint).toLocaleString()} {item.unit}</dd>
          </div>
          {item.notes && (
            <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-3">
              <dt className="text-muted-foreground text-xs">備註</dt>
              <dd>{item.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Stock Levels Table */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">各倉庫庫存</h3>
        {!item.stockLevels || item.stockLevels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">尚無庫存資料</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['倉庫', '現有庫存', '保留庫存', '可用庫存'].map((h) => (
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
              {item.stockLevels.map((sl) => {
                const available = Number(sl.quantity) - Number(sl.reservedQty);
                const isBelowSafety = Number(sl.quantity) < Number(item.safetyStock);
                return (
                  <tr
                    key={sl.id}
                    className={cn(
                      'border-b border-border/40 last:border-0',
                      isBelowSafety && 'bg-amber-500/5',
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <span className={cn(isBelowSafety && 'text-amber-400')}>
                        {sl.warehouse.name}
                        <span className="text-xs text-muted-foreground ml-1.5">({sl.warehouse.code})</span>
                      </span>
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 font-medium',
                        isBelowSafety ? 'text-amber-400' : 'text-foreground',
                      )}
                    >
                      {Number(sl.quantity).toLocaleString()} {item.unit}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {Number(sl.reservedQty).toLocaleString()} {item.unit}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2.5 font-medium',
                        available < 0 ? 'text-destructive' : 'text-foreground',
                      )}
                    >
                      {available.toLocaleString()} {item.unit}
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
            <DialogTitle>入庫 — {item.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={receiveForm.handleSubmit((d) => receiveMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">倉庫 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...receiveForm.register('warehouseId')}
              >
                <option value="">請選擇倉庫</option>
                {warehouses.map((w) => (
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
            <DialogTitle>出庫 — {item.name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={issueForm.handleSubmit((d) => issueMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">倉庫 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...issueForm.register('warehouseId')}
              >
                <option value="">請選擇倉庫</option>
                {warehouses.map((w) => (
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
