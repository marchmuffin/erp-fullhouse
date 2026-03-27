'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, RotateCcw } from 'lucide-react';
import { financeApi } from '@/lib/api/finance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft:    { label: '草稿', variant: 'secondary' },
  posted:   { label: '已過帳', variant: 'success' },
  reversed: { label: '已沖銷', variant: 'outline' },
};

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['journal-detail', id] });

  const { data: je, isLoading } = useQuery({
    queryKey: ['journal-detail', id],
    queryFn: () => financeApi.journal.get(id),
  });

  const postMut = useMutation({
    mutationFn: () => financeApi.journal.post(id),
    onSuccess: invalidate,
  });

  const reverseMut = useMutation({
    mutationFn: () => financeApi.journal.reverse(id),
    onSuccess: () => { invalidate(); setShowReverseConfirm(false); },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!je) return null;

  const statusCfg = STATUS_CONFIG[je.status] ?? { label: je.status, variant: 'outline' };

  const totalDebit = (je.lines ?? []).reduce((sum, l) => sum + (l.debitAccountId ? Number(l.amount) : 0), 0);
  const totalCredit = (je.lines ?? []).reduce((sum, l) => sum + (l.creditAccountId ? Number(l.amount) : 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft size={18} /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{je.jeNo}</h2>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">建立於 {formatDateTime(je.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {je.status === 'draft' && (
            <Button size="sm" onClick={() => postMut.mutate()} disabled={postMut.isPending}>
              <CheckCircle size={14} /> 過帳
            </Button>
          )}
          {je.status === 'posted' && (
            <Button variant="outline" size="sm" onClick={() => setShowReverseConfirm(true)} disabled={reverseMut.isPending}>
              <RotateCcw size={14} /> 沖銷
            </Button>
          )}
          {je.status === 'reversed' && (
            <span className="text-sm text-muted-foreground px-3 py-1.5 rounded-md bg-muted/30">已沖銷</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">傳票資訊</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">日期</dt>
              <dd>{formatDate(je.jeDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">說明</dt>
              <dd className="text-right max-w-[60%]">{je.description}</dd>
            </div>
            {je.refDocType && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">來源單據類型</dt>
                <dd>{je.refDocType}</dd>
              </div>
            )}
            {je.refDocNo && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">來源單號</dt>
                <dd className="font-mono text-xs">{je.refDocNo}</dd>
              </div>
            )}
          </dl>
        </div>
        {je.status === 'posted' && (
          <div className="glass rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold">過帳資訊</h3>
            <dl className="space-y-2 text-sm">
              {je.postedBy && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">過帳人</dt>
                  <dd>{je.postedBy}</dd>
                </div>
              )}
              {je.postedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">過帳時間</dt>
                  <dd>{formatDateTime(je.postedAt)}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Lines Table */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">分錄明細</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['序號', '借方科目', '貸方科目', '金額', '說明'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(je.lines ?? []).map((line) => (
                <tr key={line.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2.5 text-muted-foreground">{line.lineNo}</td>
                  <td className="px-3 py-2.5">
                    {line.debitAccount
                      ? <span>{line.debitAccount.code} <span className="text-muted-foreground">{line.debitAccount.name}</span></span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {line.creditAccount
                      ? <span>{line.creditAccount.code} <span className="text-muted-foreground">{line.creditAccount.name}</span></span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-medium tabular-nums">{formatCurrency(Number(line.amount))}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{line.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            {/* Summary Row */}
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={2} className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">借方合計</td>
                <td colSpan={3} className="px-3 py-2.5 font-bold text-foreground tabular-nums">{formatCurrency(totalDebit)}</td>
              </tr>
              <tr className="border-t border-border/40 bg-muted/10">
                <td colSpan={2} className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">貸方合計</td>
                <td colSpan={3} className="px-3 py-2.5 font-bold text-foreground tabular-nums">{formatCurrency(totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Reverse Confirmation Dialog */}
      <Dialog open={showReverseConfirm} onOpenChange={setShowReverseConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>確認沖銷</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            確定要沖銷傳票 <span className="font-semibold text-foreground">{je.jeNo}</span>？此操作將建立反向傳票，無法還原。
          </p>
          {reverseMut.error && (
            <p className="text-sm text-destructive">{(reverseMut.error as Error).message}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowReverseConfirm(false)}>取消</Button>
            <Button variant="destructive" onClick={() => reverseMut.mutate()} disabled={reverseMut.isPending}>
              {reverseMut.isPending ? '處理中...' : '確認沖銷'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
