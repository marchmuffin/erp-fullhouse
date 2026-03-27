'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, XCircle, Send, PackageCheck } from 'lucide-react';
import { procurementApi } from '@/lib/api/procurement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending_approval: { label: '待審核', variant: 'warning' },
  approved: { label: '已核准', variant: 'success' },
  partial_received: { label: '部分收貨', variant: 'info' },
  received: { label: '已收貨', variant: 'success' },
  invoiced: { label: '已對帳', variant: 'default' },
  cancelled: { label: '已取消', variant: 'destructive' },
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['po-detail', id] });

  const { data: po, isLoading } = useQuery({ queryKey: ['po-detail', id], queryFn: () => procurementApi.orders.get(id) });

  const submitMut = useMutation({ mutationFn: () => procurementApi.orders.submit(id), onSuccess: invalidate });
  const approveMut = useMutation({ mutationFn: () => procurementApi.orders.approve(id), onSuccess: invalidate });
  const cancelMut = useMutation({ mutationFn: () => procurementApi.orders.cancel(id), onSuccess: invalidate });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!po) return null;

  const statusCfg = STATUS_CONFIG[po.status] ?? { label: po.status, variant: 'outline' };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft size={18} /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{po.poNo}</h2>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{po.supplier?.name} · 建立於 {formatDateTime(po.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {po.status === 'draft' && (
            <>
              <Button variant="outline" size="sm" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}><XCircle size={14} /> 取消</Button>
              <Button size="sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}><Send size={14} /> 送審</Button>
            </>
          )}
          {po.status === 'pending_approval' && (
            <>
              <Button variant="outline" size="sm" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}><XCircle size={14} /> 駁回</Button>
              <Button size="sm" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}><CheckCircle size={14} /> 核准</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">訂單資訊</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">供應商</dt><dd className="font-medium">{po.supplier?.name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">訂單日期</dt><dd>{formatDate(po.orderDate)}</dd></div>
            {po.expectedDate && <div className="flex justify-between"><dt className="text-muted-foreground">預計到貨</dt><dd>{formatDate(po.expectedDate)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">幣別</dt><dd>{po.currency}</dd></div>
          </dl>
        </div>
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">金額摘要</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">小計</dt><dd>{po.currency} {Number(po.subtotal).toLocaleString()}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">稅額</dt><dd>{po.currency} {Number(po.taxAmount).toLocaleString()}</dd></div>
            <div className="flex justify-between border-t border-border pt-2"><dt className="font-semibold">合計</dt><dd className="font-bold text-lg text-primary">{po.currency} {Number(po.total).toLocaleString()}</dd></div>
          </dl>
        </div>
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">採購品項</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">{['#', '料號', '品名', '單位', '數量', '單價', '小計', '已收貨'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody>
            {po.lines?.map((line) => (
              <tr key={line.id} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2.5 text-muted-foreground">{line.lineNo}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{line.itemCode}</td>
                <td className="px-3 py-2.5">{line.itemName}</td>
                <td className="px-3 py-2.5">{line.unit}</td>
                <td className="px-3 py-2.5">{Number(line.quantity).toLocaleString()}</td>
                <td className="px-3 py-2.5">{Number(line.unitPrice).toLocaleString()}</td>
                <td className="px-3 py-2.5 font-medium">{Number(line.amount).toLocaleString()}</td>
                <td className="px-3 py-2.5">
                  <span className={Number(line.receivedQty) >= Number(line.quantity) ? 'text-emerald-400' : 'text-amber-400'}>
                    {Number(line.receivedQty).toLocaleString()} / {Number(line.quantity).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {po.notes && <div className="glass rounded-xl p-5"><h3 className="text-sm font-semibold mb-2">備註</h3><p className="text-sm text-muted-foreground">{po.notes}</p></div>}
    </div>
  );
}
