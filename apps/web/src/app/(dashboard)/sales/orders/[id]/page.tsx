'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, XCircle, Send, Package } from 'lucide-react';
import { salesApi } from '@/lib/api/sales';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending_approval: { label: '待審核', variant: 'warning' },
  approved: { label: '已核准', variant: 'success' },
  processing: { label: '處理中', variant: 'info' },
  partial_shipped: { label: '部分出貨', variant: 'info' },
  shipped: { label: '已出貨', variant: 'success' },
  invoiced: { label: '已開票', variant: 'default' },
  cancelled: { label: '已取消', variant: 'destructive' },
};

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['sales-order', id],
    queryFn: () => salesApi.orders.get(id),
  });

  const submitMutation = useMutation({
    mutationFn: () => salesApi.orders.submit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales-order', id] }),
  });

  const approveMutation = useMutation({
    mutationFn: () => salesApi.orders.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales-order', id] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => salesApi.orders.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales-order', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const statusCfg = STATUS_CONFIG[order.status] ?? { label: order.status, variant: 'outline' };

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
              <h2 className="text-xl font-bold text-foreground">{order.orderNo}</h2>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {order.customer?.name} · 建立於 {formatDateTime(order.createdAt)}
            </p>
          </div>
        </div>

        {/* Action buttons based on status */}
        <div className="flex gap-2">
          {order.status === 'draft' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <XCircle size={14} /> 作廢
              </Button>
              <Button
                size="sm"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
              >
                <Send size={14} /> 送審
              </Button>
            </>
          )}
          {order.status === 'pending_approval' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <XCircle size={14} /> 駁回
              </Button>
              <Button
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                <CheckCircle size={14} /> 核准
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">訂單資訊</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">客戶</dt>
              <dd className="text-foreground font-medium">{order.customer?.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">訂單日期</dt>
              <dd className="text-foreground">{formatDate(order.orderDate)}</dd>
            </div>
            {order.requestedDate && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">要求交期</dt>
                <dd className="text-foreground">{formatDate(order.requestedDate)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">幣別</dt>
              <dd className="text-foreground">{order.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">信用審核</dt>
              <dd>
                <Badge variant={order.creditChecked ? 'success' : 'warning'}>
                  {order.creditChecked ? '通過' : '未通過'}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>

        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">金額摘要</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">小計</dt>
              <dd className="text-foreground">
                {order.currency} {Number(order.subtotal).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">稅額</dt>
              <dd className="text-foreground">
                {order.currency} {Number(order.taxAmount).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-semibold text-foreground">合計</dt>
              <dd className="font-bold text-lg text-primary">
                {order.currency} {Number(order.total).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Order Lines */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">訂單品項</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['#', '料號', '品名', '規格', '單位', '數量', '單價', '折扣', '小計'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.lines?.map((line) => (
                <tr key={line.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2.5 text-muted-foreground">{line.lineNo}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{line.itemCode}</td>
                  <td className="px-3 py-2.5">{line.itemName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{line.spec ?? '-'}</td>
                  <td className="px-3 py-2.5">{line.unit}</td>
                  <td className="px-3 py-2.5">{Number(line.quantity).toLocaleString()}</td>
                  <td className="px-3 py-2.5">{Number(line.unitPrice).toLocaleString()}</td>
                  <td className="px-3 py-2.5">{line.discount}%</td>
                  <td className="px-3 py-2.5 font-medium">
                    {Number(line.amount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">備註</h3>
          <p className="text-sm text-muted-foreground">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
