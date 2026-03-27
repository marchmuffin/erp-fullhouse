'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, X } from 'lucide-react';
import { posApi } from '@/lib/api/pos';
import type { PosOrder } from '@/lib/api/pos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DataTable, type Column } from '@/components/ui/data-table';

function formatCurrency(n: number | string) {
  return `NT$ ${Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0 })}`;
}

function formatDateTime(s: string | undefined | null) {
  if (!s) return '--';
  return new Date(s).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: '現金',
  card: '刷卡',
  mobile: '行動支付',
};

const ORDER_COLUMNS: Column<PosOrder>[] = [
  { key: 'orderNo', header: '訂單號', width: 'w-44' },
  {
    key: 'totalAmount', header: '金額', width: 'w-32',
    render: (r) => formatCurrency(r.totalAmount),
  },
  {
    key: 'paymentMethod', header: '付款方式', width: 'w-28',
    render: (r) => PAYMENT_LABEL[r.paymentMethod] ?? r.paymentMethod,
  },
  {
    key: 'status', header: '狀態', width: 'w-24',
    render: (r) => (
      <Badge variant={r.status === 'completed' ? 'success' : 'destructive'}>
        {r.status === 'completed' ? '已完成' : '已作廢'}
      </Badge>
    ),
  },
  {
    key: 'createdAt', header: '時間', width: 'w-40',
    render: (r) => formatDateTime(r.createdAt),
  },
];

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showClose, setShowClose] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const { data: session, isLoading } = useQuery({
    queryKey: ['pos-session-detail', id],
    queryFn: () => posApi.sessions.get(id),
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      posApi.sessions.close(id, {
        closingCash: closingCash ? Number(closingCash) : undefined,
        notes: closeNotes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-session-detail', id] });
      qc.invalidateQueries({ queryKey: ['pos-active-session'] });
      qc.invalidateQueries({ queryKey: ['pos-sessions'] });
      setShowClose(false);
      setClosingCash('');
      setCloseNotes('');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const orders = (session.orders ?? []) as PosOrder[];

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
              <h2 className="text-xl font-bold text-foreground">{session.sessionNo}</h2>
              <Badge variant={session.status === 'open' ? 'success' : 'secondary'}>
                {session.status === 'open' ? '開班中' : '已結班'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {session.cashierName} · 開班 {formatDateTime(session.openedAt)}
            </p>
          </div>
        </div>
        {session.status === 'open' && (
          <Button variant="outline" onClick={() => setShowClose(true)}>
            <X size={14} /> 結束班次
          </Button>
        )}
      </div>

      {/* Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">班次資訊</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">開班時間</dt>
              <dd>{formatDateTime(session.openedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">結班時間</dt>
              <dd>{session.closedAt ? formatDateTime(session.closedAt) : '--'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">開班備用金</dt>
              <dd>{formatCurrency(session.openingCash)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">結班現金</dt>
              <dd>{session.closingCash != null ? formatCurrency(session.closingCash) : '--'}</dd>
            </div>
            {session.notes && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">備註</dt>
                <dd className="text-right max-w-xs">{session.notes}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">銷售摘要</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">訂單數</dt>
              <dd className="font-medium">{session.totalOrders}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-semibold">銷售總額</dt>
              <dd className="font-bold text-lg text-primary">{formatCurrency(session.totalSales)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Orders Table */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">交易紀錄</h3>
        <DataTable
          columns={ORDER_COLUMNS}
          data={orders as any}
          loading={false}
          emptyMessage="本班次尚無訂單"
        />
      </div>

      {/* Close Dialog */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>結束班次</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">結班現金 (NT$)</label>
              <Input
                type="number" min={0} placeholder="4800"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input
                placeholder="班次備註..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>
            {closeMutation.error && (
              <p className="text-sm text-destructive">{(closeMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowClose(false)}>取消</Button>
              <Button
                variant="destructive"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
              >
                {closeMutation.isPending ? '結班中...' : '確認結班'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
