'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, CheckCircle, XCircle, Ban } from 'lucide-react';
import { procurementApi } from '@/lib/api/procurement';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, formatDateTime } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending_approval: { label: '待審核', variant: 'warning' },
  approved: { label: '已核准', variant: 'success' },
  converted: { label: '已轉單', variant: 'default' },
  rejected: { label: '已駁回', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'outline' },
};

export default function PRDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['pr-detail', id] });

  const { data: pr, isLoading } = useQuery({ queryKey: ['pr-detail', id], queryFn: () => procurementApi.requisitions.get(id) });

  const submitMut = useMutation({ mutationFn: () => procurementApi.requisitions.submit(id), onSuccess: invalidate });
  const approveMut = useMutation({ mutationFn: () => procurementApi.requisitions.approve(id), onSuccess: invalidate });
  const rejectMut = useMutation({ mutationFn: () => procurementApi.requisitions.reject(id), onSuccess: invalidate });
  const cancelMut = useMutation({ mutationFn: () => procurementApi.requisitions.cancel(id), onSuccess: invalidate });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!pr) return null;

  const statusCfg = STATUS_CONFIG[pr.status] ?? { label: pr.status, variant: 'outline' };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft size={18} /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{pr.prNo}</h2>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pr.department && `${pr.department} · `}建立於 {formatDateTime(pr.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {pr.status === 'draft' && (
            <>
              <Button variant="outline" size="sm" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}><Ban size={14} /> 取消</Button>
              <Button size="sm" onClick={() => submitMut.mutate()} disabled={submitMut.isPending}><Send size={14} /> 送審</Button>
            </>
          )}
          {pr.status === 'pending_approval' && (
            <>
              <Button variant="outline" size="sm" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}><XCircle size={14} /> 駁回</Button>
              <Button size="sm" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}><CheckCircle size={14} /> 核准</Button>
            </>
          )}
        </div>
      </div>

      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">申請資訊</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">申請日期</dt><dd>{formatDate(pr.requestDate)}</dd></div>
          {pr.requiredDate && <div className="flex justify-between"><dt className="text-muted-foreground">需求日期</dt><dd>{formatDate(pr.requiredDate)}</dd></div>}
          {pr.department && <div className="flex justify-between"><dt className="text-muted-foreground">申請部門</dt><dd>{pr.department}</dd></div>}
          {pr.purpose && <div className="flex justify-between col-span-2"><dt className="text-muted-foreground">採購原因</dt><dd>{pr.purpose}</dd></div>}
        </dl>
      </div>

      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">申請品項</h3>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border">{['#', '料號', '品名', '規格', '單位', '數量'].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
          <tbody>
            {pr.lines?.map((line) => (
              <tr key={line.id} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2.5 text-muted-foreground">{line.lineNo}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{line.itemCode}</td>
                <td className="px-3 py-2.5">{line.itemName}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{line.spec ?? '-'}</td>
                <td className="px-3 py-2.5">{line.unit}</td>
                <td className="px-3 py-2.5 font-medium">{Number(line.quantity).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pr.status === 'approved' && (
        <div className="flex justify-end">
          <Button onClick={() => router.push(`/procurement/orders/new?prId=${pr.id}`)}>
            <ShoppingCartIcon size={14} /> 轉採購訂單
          </Button>
        </div>
      )}
    </div>
  );
}

function ShoppingCartIcon({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
}
