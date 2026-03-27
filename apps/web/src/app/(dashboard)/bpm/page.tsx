'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  Clock,
  LayoutList,
  SendHorizonal,
  BookOpen,
  ScrollText,
} from 'lucide-react';
import { bpmApi } from '@/lib/api/bpm';
import type { WorkflowInstance } from '@/lib/api/bpm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

function formatDate(s: string | undefined | null) {
  if (!s) return '--';
  return new Date(s).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}

const DOC_TYPE_LABEL: Record<string, string> = {
  so: '銷售訂單',
  po: '採購訂單',
  pr: '請購單',
  leave: '請假單',
  payroll: '薪資單',
  wo: '工單',
  inspection: '檢驗單',
};

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待審',
  approved: '已核准',
  rejected: '已駁回',
  cancelled: '已取消',
};

const QUICK_LINKS = [
  {
    label: '待審清單',
    desc: '需要我審核的申請',
    icon: Clock,
    href: '/bpm',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  {
    label: '我的申請',
    desc: '我提交的流程',
    icon: SendHorizonal,
    href: '/bpm',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    label: '流程定義',
    desc: '管理審核流程',
    icon: BookOpen,
    href: '/bpm/definitions',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    label: '稽核軌跡',
    desc: '所有流程記錄',
    icon: ScrollText,
    href: '/bpm/instances',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
];

function ActDialog({
  open,
  onOpenChange,
  mode,
  instanceId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'approve' | 'reject';
  instanceId: string;
  onDone: () => void;
}) {
  const [comment, setComment] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'approve'
        ? bpmApi.instances.approve(instanceId, comment || undefined)
        : bpmApi.instances.reject(instanceId, comment || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bpm-pending'] });
      qc.invalidateQueries({ queryKey: ['bpm-mine'] });
      qc.invalidateQueries({ queryKey: ['bpm-stats'] });
      setComment('');
      onOpenChange(false);
      onDone();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'approve' ? '確認核准' : '確認駁回'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">審核意見（選填）</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              rows={3}
              placeholder="輸入審核意見..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          {mutation.error && (
            <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant={mode === 'approve' ? 'default' : 'destructive'}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={mode === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {mutation.isPending
              ? mode === 'approve'
                ? '核准中...'
                : '駁回中...'
              : mode === 'approve'
              ? '確認核准'
              : '確認駁回'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BpmPage() {
  const router = useRouter();
  const [actDialog, setActDialog] = useState<{
    open: boolean;
    mode: 'approve' | 'reject';
    instanceId: string;
  }>({ open: false, mode: 'approve', instanceId: '' });

  const { data: statsData } = useQuery({
    queryKey: ['bpm-stats'],
    queryFn: () => bpmApi.stats.get(),
  });

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['bpm-pending'],
    queryFn: () => bpmApi.instances.pending(),
  });

  const { data: mineData, isLoading: mineLoading } = useQuery({
    queryKey: ['bpm-mine'],
    queryFn: () => bpmApi.instances.mine(),
  });

  const stats = statsData ?? {
    pendingCount: 0,
    approvedThisMonth: 0,
    rejectedThisMonth: 0,
    totalDefinitions: 0,
  };

  const pending = pendingData?.data ?? [];
  const mine = mineData?.data ?? [];

  const openAct = (mode: 'approve' | 'reject', id: string) => {
    setActDialog({ open: true, mode, instanceId: id });
  };

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">流程管理 BPM</h1>
        <p className="text-sm text-muted-foreground mt-0.5">審核工作流程、待辦清單與稽核軌跡</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.label}
            onClick={() => router.push(link.href)}
            className="glass rounded-xl p-5 flex items-start gap-3 text-left hover:ring-1 hover:ring-primary/40 transition-all"
          >
            <div className={`rounded-lg p-2 ${link.bg}`}>
              <link.icon size={18} className={link.color} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{link.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{link.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">待審件數</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{stats.pendingCount}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">本月核准</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{stats.approvedThisMonth}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">本月駁回</p>
          <p className="text-3xl font-bold text-rose-400 mt-1">{stats.rejectedThisMonth}</p>
        </div>
        <div className="glass rounded-xl p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">流程定義數</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{stats.totalDefinitions}</p>
        </div>
      </div>

      {/* Pending approvals */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-amber-400" />
          <h2 className="text-base font-semibold text-foreground">待我審核</h2>
          {pending.length > 0 && (
            <Badge variant="warning" className="text-xs">{pending.length}</Badge>
          )}
        </div>

        {pendingLoading ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">目前沒有待審核的申請</p>
        ) : (
          <div className="space-y-3">
            {pending.map((inst: WorkflowInstance) => (
              <div
                key={inst.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/30 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {DOC_TYPE_LABEL[inst.docType] ?? inst.docType}
                  </Badge>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary"
                      onClick={() => router.push(`/bpm/instances/${inst.id}`)}
                    >
                      {inst.docNo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      申請人：{inst.submittedBy} · {formatDate(inst.submittedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <Button
                    size="sm"
                    className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => openAct('approve', inst.id)}
                  >
                    <CheckCircle size={13} className="mr-1" />
                    核准
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 px-3 text-xs"
                    onClick={() => openAct('reject', inst.id)}
                  >
                    <XCircle size={13} className="mr-1" />
                    駁回
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My submissions */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <LayoutList size={16} className="text-blue-400" />
          <h2 className="text-base font-semibold text-foreground">我的申請</h2>
        </div>

        {mineLoading ? (
          <div className="flex items-center justify-center h-16">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mine.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">尚未提交任何申請</p>
        ) : (
          <div className="space-y-2">
            {mine.map((inst: WorkflowInstance) => (
              <div
                key={inst.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background/30 px-4 py-3 cursor-pointer hover:bg-background/50 transition-colors"
                onClick={() => router.push(`/bpm/instances/${inst.id}`)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {DOC_TYPE_LABEL[inst.docType] ?? inst.docType}
                  </Badge>
                  <span className="text-sm font-medium text-foreground truncate">{inst.docNo}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge variant={STATUS_VARIANT[inst.status] ?? 'secondary'} className="text-xs">
                    {STATUS_LABEL[inst.status] ?? inst.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(inst.submittedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Act dialog */}
      <ActDialog
        open={actDialog.open}
        onOpenChange={(v) => setActDialog((s) => ({ ...s, open: v }))}
        mode={actDialog.mode}
        instanceId={actDialog.instanceId}
        onDone={() => {}}
      />
    </div>
  );
}
