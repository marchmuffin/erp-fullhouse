'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import { bpmApi } from '@/lib/api/bpm';
import type { WorkflowStep } from '@/lib/api/bpm';
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

const STEP_ACTION_VARIANT: Record<string, 'success' | 'destructive' | 'warning'> = {
  approved: 'success',
  rejected: 'destructive',
  pending: 'warning',
};

const STEP_ACTION_LABEL: Record<string, string> = {
  approved: '已核准',
  rejected: '已駁回',
  pending: '待審中',
};

function ActDialog({
  open,
  onOpenChange,
  mode,
  instanceId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'approve' | 'reject';
  instanceId: string;
}) {
  const [comment, setComment] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'approve'
        ? bpmApi.instances.approve(instanceId, comment || undefined)
        : bpmApi.instances.reject(instanceId, comment || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bpm-instance-detail', instanceId] });
      qc.invalidateQueries({ queryKey: ['bpm-pending'] });
      qc.invalidateQueries({ queryKey: ['bpm-stats'] });
      qc.invalidateQueries({ queryKey: ['bpm-instances'] });
      setComment('');
      onOpenChange(false);
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

export default function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [actDialog, setActDialog] = useState<{
    open: boolean;
    mode: 'approve' | 'reject';
  }>({ open: false, mode: 'approve' });

  const { data: instance, isLoading } = useQuery({
    queryKey: ['bpm-instance-detail', id],
    queryFn: () => bpmApi.instances.get(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!instance) return null;

  const steps = instance.steps ?? [];
  const totalSteps = instance.definition?.steps ?? 1;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {DOC_TYPE_LABEL[instance.docType] ?? instance.docType}
              </Badge>
              <h2 className="text-xl font-bold text-foreground">{instance.docNo}</h2>
              <Badge variant={STATUS_VARIANT[instance.status] ?? 'secondary'}>
                {STATUS_LABEL[instance.status] ?? instance.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {instance.definition?.name ?? '未知流程'} · 第 {instance.currentStep}/{totalSteps} 步
            </p>
          </div>
        </div>
        {instance.status === 'pending' && (
          <div className="flex gap-2 shrink-0">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setActDialog({ open: true, mode: 'approve' })}
            >
              <CheckCircle size={15} className="mr-1.5" />
              核准
            </Button>
            <Button
              variant="destructive"
              onClick={() => setActDialog({ open: true, mode: 'reject' })}
            >
              <XCircle size={15} className="mr-1.5" />
              駁回
            </Button>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3">流程資訊</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">流程定義</dt>
            <dd className="font-medium">{instance.definition?.name ?? '--'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">流程代碼</dt>
            <dd className="font-mono text-xs">{instance.definition?.code ?? '--'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">申請人</dt>
            <dd>{instance.submittedBy}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">申請時間</dt>
            <dd>{formatDate(instance.submittedAt)}</dd>
          </div>
          {instance.completedAt && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">完成時間</dt>
              <dd>{formatDate(instance.completedAt)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">文件 ID</dt>
            <dd className="font-mono text-xs text-muted-foreground">{instance.docId.slice(0, 12)}…</dd>
          </div>
        </dl>
      </div>

      {/* Timeline */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">審核軌跡</h3>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-6 pl-12">
            {/* Submitted step */}
            <div className="relative">
              <div className="absolute -left-8 w-5 h-5 rounded-full bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">申請提交</span>
                  <Badge variant="secondary" className="text-xs">步驟 0</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  申請人：{instance.submittedBy} · {formatDate(instance.submittedAt)}
                </p>
              </div>
            </div>

            {/* Workflow steps */}
            {Array.from({ length: totalSteps }).map((_, idx) => {
              const stepNo = idx + 1;
              const stepRecord = steps.find((s: WorkflowStep) => s.stepNo === stepNo);
              const isCurrentPending =
                instance.status === 'pending' && instance.currentStep === stepNo;
              const action = stepRecord?.action ?? (isCurrentPending ? 'pending' : null);

              const iconColor =
                action === 'approved'
                  ? 'border-emerald-500 bg-emerald-500/20'
                  : action === 'rejected'
                  ? 'border-rose-500 bg-rose-500/20'
                  : action === 'pending'
                  ? 'border-amber-500 bg-amber-500/20'
                  : 'border-border bg-muted';

              const dotColor =
                action === 'approved'
                  ? 'bg-emerald-400'
                  : action === 'rejected'
                  ? 'bg-rose-400'
                  : action === 'pending'
                  ? 'bg-amber-400'
                  : 'bg-muted-foreground/40';

              return (
                <div key={stepNo} className="relative">
                  <div
                    className={`absolute -left-8 w-5 h-5 rounded-full border-2 flex items-center justify-center ${iconColor}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        審核步驟 {stepNo}
                      </span>
                      {action ? (
                        <Badge
                          variant={STEP_ACTION_VARIANT[action] ?? 'secondary'}
                          className="text-xs"
                        >
                          {STEP_ACTION_LABEL[action] ?? action}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">尚未進行</Badge>
                      )}
                    </div>
                    {stepRecord?.actorName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        審核人：{stepRecord.actorName}
                        {stepRecord.actedAt ? ` · ${formatDate(stepRecord.actedAt)}` : ''}
                      </p>
                    )}
                    {isCurrentPending && !stepRecord?.actorName && (
                      <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
                        <Clock size={11} />
                        等待審核中
                      </p>
                    )}
                    {stepRecord?.comment && (
                      <p className="text-xs text-muted-foreground mt-1 pl-3 border-l-2 border-border italic">
                        {stepRecord.comment}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Completed marker */}
            {(instance.status === 'approved' ||
              instance.status === 'rejected' ||
              instance.status === 'cancelled') && (
              <div className="relative">
                <div
                  className={`absolute -left-8 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    instance.status === 'approved'
                      ? 'border-emerald-500 bg-emerald-500/20'
                      : 'border-rose-500 bg-rose-500/20'
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      instance.status === 'approved' ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">流程結束</span>
                    <Badge
                      variant={STATUS_VARIANT[instance.status] ?? 'secondary'}
                      className="text-xs"
                    >
                      {STATUS_LABEL[instance.status]}
                    </Badge>
                  </div>
                  {instance.completedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(instance.completedAt)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Act dialog */}
      <ActDialog
        open={actDialog.open}
        onOpenChange={(v) => setActDialog((s) => ({ ...s, open: v }))}
        mode={actDialog.mode}
        instanceId={id}
      />
    </div>
  );
}
