'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, XCircle, CreditCard } from 'lucide-react';
import { financeApi } from '@/lib/api/finance';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft:     { label: '草稿', variant: 'secondary' },
  issued:    { label: '已開立', variant: 'info' },
  partial:   { label: '部分付款', variant: 'warning' },
  paid:      { label: '已付款', variant: 'success' },
  overdue:   { label: '逾期', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'outline' },
};

const paymentSchema = z.object({
  paymentDate: z.string().min(1, '必填'),
  amount:      z.coerce.number().min(0.01, '金額必須大於 0'),
  method:      z.enum(['cash', 'bank_transfer', 'cheque', 'credit_card']),
  reference:   z.string().optional(),
  notes:       z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

const METHOD_LABELS: Record<string, string> = {
  cash:          '現金',
  bank_transfer: '銀行轉帳',
  cheque:        '支票',
  credit_card:   '信用卡',
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['invoice-detail', id] });

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: () => financeApi.invoices.get(id),
  });

  const issueMut = useMutation({
    mutationFn: () => financeApi.invoices.issue(id),
    onSuccess: invalidate,
  });

  const cancelMut = useMutation({
    mutationFn: () => financeApi.invoices.cancel(id),
    onSuccess: invalidate,
  });

  const paymentMut = useMutation({
    mutationFn: (d: PaymentFormData) => financeApi.invoices.recordPayment(id, d),
    onSuccess: () => { invalidate(); setShowPayment(false); paymentReset(); },
  });

  const { register, handleSubmit, reset: paymentReset, formState: { errors } } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      method: 'bank_transfer',
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!invoice) return null;

  const statusCfg = STATUS_CONFIG[invoice.status] ?? { label: invoice.status, variant: 'outline' };
  const outstanding = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const hasPayments = (invoice.payments?.length ?? 0) > 0;

  const canIssue = invoice.status === 'draft';
  const canPay   = ['issued', 'partial'].includes(invoice.status);
  const canCancel = invoice.status === 'issued' && !hasPayments;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft size={18} /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{invoice.invoiceNo}</h2>
              <Badge variant={invoice.type === 'ar' ? 'success' : 'warning'}>
                {invoice.type === 'ar' ? 'AR 應收' : 'AP 應付'}
              </Badge>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">建立於 {formatDateTime(invoice.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canIssue && (
            <Button size="sm" onClick={() => issueMut.mutate()} disabled={issueMut.isPending}>
              <Send size={14} /> 開立發票
            </Button>
          )}
          {canPay && (
            <Button size="sm" onClick={() => setShowPayment(true)}>
              <CreditCard size={14} /> 記錄付款
            </Button>
          )}
          {canCancel && (
            <Button variant="outline" size="sm" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              <XCircle size={14} /> 取消
            </Button>
          )}
        </div>
      </div>

      {/* Info + Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">基本資訊</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">對象名稱</dt>
              <dd className="font-medium">{invoice.partyName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">發票日期</dt>
              <dd>{formatDate(invoice.invoiceDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">到期日</dt>
              <dd>{formatDate(invoice.dueDate)}</dd>
            </div>
            {invoice.refDocNo && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">來源單號</dt>
                <dd className="font-mono text-xs">{invoice.refDocNo}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold">金額摘要</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">小計</dt>
              <dd className="tabular-nums">{formatCurrency(Number(invoice.subtotal))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">稅額</dt>
              <dd className="tabular-nums">{formatCurrency(Number(invoice.taxAmount))}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-semibold">發票金額</dt>
              <dd className="font-bold tabular-nums">{formatCurrency(Number(invoice.totalAmount))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">已付金額</dt>
              <dd className="tabular-nums text-emerald-400">{formatCurrency(Number(invoice.paidAmount))}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <dt className="font-semibold">未付金額</dt>
              <dd className={cn('font-bold tabular-nums', outstanding > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                {formatCurrency(outstanding)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Lines Table */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">發票明細</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['說明', '數量', '單價', '金額'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invoice.lines ?? []).map((line) => (
                <tr key={line.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2.5">{line.description}</td>
                  <td className="px-3 py-2.5 tabular-nums">{Number(line.quantity).toLocaleString()}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatCurrency(Number(line.unitPrice))}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums">{formatCurrency(Number(line.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments Table */}
      {(invoice.payments?.length ?? 0) > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">付款記錄</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['付款單號', '日期', '方式', '金額', '參考號'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoice.payments!.map((p) => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs">{p.paymentNo}</td>
                    <td className="px-3 py-2.5">{formatDate(p.paymentDate)}</td>
                    <td className="px-3 py-2.5">{METHOD_LABELS[p.method] ?? p.method}</td>
                    <td className="px-3 py-2.5 font-medium tabular-nums text-emerald-400">{formatCurrency(Number(p.amount))}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{p.reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>記錄付款</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => paymentMut.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">付款日期 *</label>
              <Input type="date" {...register('paymentDate')} />
              {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">付款金額 *</label>
              <Input
                type="number"
                step="0.01"
                placeholder={String(outstanding)}
                {...register('amount')}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              <p className="text-xs text-muted-foreground">未付金額：{formatCurrency(outstanding)}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">付款方式 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('method')}
              >
                <option value="bank_transfer">銀行轉帳</option>
                <option value="cash">現金</option>
                <option value="cheque">支票</option>
                <option value="credit_card">信用卡</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">參考號</label>
              <Input placeholder="轉帳末五碼或支票號碼" {...register('reference')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="備註說明" {...register('notes')} />
            </div>
            {paymentMut.error && (
              <p className="text-sm text-destructive">{(paymentMut.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPayment(false)}>取消</Button>
              <Button type="submit" disabled={paymentMut.isPending}>
                {paymentMut.isPending ? '記錄中...' : '確認付款'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
