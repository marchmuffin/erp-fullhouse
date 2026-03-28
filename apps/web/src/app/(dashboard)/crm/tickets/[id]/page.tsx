'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { crmApi } from '@/lib/api/crm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';

const STATUS_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'success' | 'outline' | 'destructive'> = {
  open: 'secondary',
  in_progress: 'info',
  pending_customer: 'warning',
  resolved: 'success',
  closed: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  open: '待處理',
  in_progress: '處理中',
  pending_customer: '等待客戶',
  resolved: '已解決',
  closed: '已關閉',
};

const PRIORITY_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'destructive' | 'outline'> = {
  low: 'secondary', medium: 'info', high: 'warning', urgent: 'destructive',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: '低', medium: '中', high: '高', urgent: '緊急',
};

const TYPE_LABEL: Record<string, string> = {
  complaint: '投訴', inquiry: '詢問', repair: '維修', return: '退貨', other: '其他',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ticket-detail', id] });

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket-detail', id],
    queryFn: () => crmApi.tickets.get(id),
  });

  const resolveMut = useMutation({ mutationFn: () => crmApi.tickets.resolve(id), onSuccess: invalidate });
  const closeMut = useMutation({ mutationFn: () => crmApi.tickets.close(id), onSuccess: invalidate });
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const updateMut = useMutation({
    mutationFn: (status: string) => crmApi.tickets.update(id, { status }),
    onSuccess: () => { invalidate(); setEditStatus(null); },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted/30 rounded animate-pulse w-48" />
        <div className="h-40 bg-muted/30 rounded animate-pulse" />
      </div>
    );
  }

  if (!ticket) return null;

  const canResolve = ['open', 'in_progress', 'pending_customer'].includes(ticket.status);
  const canClose = ticket.status === 'resolved';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{ticket.title}</h2>
              <Badge variant={STATUS_VARIANT[ticket.status] ?? 'outline'}>{STATUS_LABEL[ticket.status] ?? ticket.status}</Badge>
              <Badge variant={PRIORITY_VARIANT[ticket.priority] ?? 'outline'}>{PRIORITY_LABEL[ticket.priority] ?? ticket.priority}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{ticket.ticketNo}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canResolve && (
            <Button size="sm" variant="outline" onClick={() => resolveMut.mutate()} disabled={resolveMut.isPending}>
              <CheckCircle size={14} className="mr-1 text-emerald-400" /> 標記解決
            </Button>
          )}
          {canClose && (
            <Button size="sm" variant="outline" onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
              <XCircle size={14} className="mr-1 text-muted-foreground" /> 關閉工單
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass rounded-xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">工單說明</h3>
            {ticket.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{ticket.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">無說明</p>
            )}
          </div>

          {/* Status change */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">更新狀態</h3>
            <div className="flex flex-wrap gap-2">
              {['open', 'in_progress', 'pending_customer'].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={ticket.status === s ? 'default' : 'outline'}
                  disabled={ticket.status === s || updateMut.isPending || ['resolved', 'closed'].includes(ticket.status)}
                  onClick={() => updateMut.mutate(s)}
                >
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Side info */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">工單資訊</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">類型</dt>
                <dd><Badge variant="outline">{TYPE_LABEL[ticket.type] ?? ticket.type}</Badge></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">負責人</dt>
                <dd className="text-foreground">{ticket.assignedTo ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">建立時間</dt>
                <dd className="text-foreground">{formatDateTime(ticket.createdAt)}</dd>
              </div>
              {ticket.resolvedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">解決時間</dt>
                  <dd className="text-foreground">{formatDateTime(ticket.resolvedAt)}</dd>
                </div>
              )}
              {ticket.closedAt && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">關閉時間</dt>
                  <dd className="text-foreground">{formatDateTime(ticket.closedAt)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
