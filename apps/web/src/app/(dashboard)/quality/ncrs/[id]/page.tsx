'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle, Lock } from 'lucide-react';
import { qualityApi } from '@/lib/api/quality';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDateTime } from '@/lib/utils';

const SEVERITY_LABEL: Record<string, string> = {
  minor: '輕微',
  major: '重大',
  critical: '嚴重',
};

const SEVERITY_VARIANT: Record<string, any> = {
  minor: 'warning',
  major: 'destructive',
  critical: 'destructive',
};

const STATUS_LABEL: Record<string, string> = {
  open: '待處理',
  in_review: '處理中',
  resolved: '已解決',
  closed: '已關閉',
};

const STATUS_VARIANT: Record<string, any> = {
  open: 'destructive',
  in_review: 'warning',
  resolved: 'info',
  closed: 'secondary',
};

const resolveSchema = z.object({
  rootCause: z.string().min(1, '請填寫根本原因'),
  correctiveAction: z.string().min(1, '請填寫矯正措施'),
});

type ResolveValues = z.infer<typeof resolveSchema>;

export default function NcrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['ncr-detail', id] });

  const [showResolve, setShowResolve] = useState(false);

  const { data: ncr, isLoading } = useQuery({
    queryKey: ['ncr-detail', id],
    queryFn: () => qualityApi.ncrs.get(id),
  });

  const inReviewMut = useMutation({
    mutationFn: () => qualityApi.ncrs.markInReview(id),
    onSuccess: invalidate,
  });

  const closeMut = useMutation({
    mutationFn: () => qualityApi.ncrs.close(id),
    onSuccess: invalidate,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ResolveValues>({
    resolver: zodResolver(resolveSchema),
  });

  const resolveMut = useMutation({
    mutationFn: (d: ResolveValues) => qualityApi.ncrs.resolve(id, d),
    onSuccess: () => { invalidate(); setShowResolve(false); reset(); },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!ncr) return null;

  const severityCfg = {
    label: SEVERITY_LABEL[ncr.severity] ?? ncr.severity,
    variant: SEVERITY_VARIANT[ncr.severity] ?? 'outline',
    ring: ncr.severity === 'critical',
  };
  const statusCfg = {
    label: STATUS_LABEL[ncr.status] ?? ncr.status,
    variant: STATUS_VARIANT[ncr.status] ?? 'outline',
  };

  const canResolve = ['open', 'in_review'].includes(ncr.status);
  const canClose = ncr.status === 'resolved';
  const canMarkInReview = ncr.status === 'open';

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
              <h2 className="text-xl font-bold text-foreground">{ncr.ncrNo}</h2>
              <Badge
                variant={severityCfg.variant}
                className={severityCfg.ring ? 'ring-1 ring-red-500' : undefined}
              >
                {severityCfg.label}
              </Badge>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              建立於 {formatDateTime(ncr.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canMarkInReview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => inReviewMut.mutate()}
              disabled={inReviewMut.isPending}
            >
              處理中
            </Button>
          )}
          {canResolve && (
            <Button size="sm" onClick={() => setShowResolve(true)}>
              <CheckCircle size={14} /> 解決 NCR
            </Button>
          )}
          {canClose && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => closeMut.mutate()}
              disabled={closeMut.isPending}
            >
              <Lock size={14} /> 關閉 NCR
            </Button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold">異常資訊</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground">異常說明</dt>
            <dd className="font-medium">{ncr.description}</dd>
          </div>
          {ncr.inspectionOrder && (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">相關檢驗單</dt>
              <dd>
                <button
                  className="text-primary hover:underline font-mono text-xs"
                  onClick={() => router.push(`/quality/inspections/${ncr.inspectionOrder!.id}`)}
                >
                  {ncr.inspectionOrder.ioNo}
                </button>
                {ncr.inspectionOrder.itemName && (
                  <span className="ml-2 text-muted-foreground">
                    — {ncr.inspectionOrder.itemName}
                  </span>
                )}
              </dd>
            </div>
          )}
          {ncr.createdBy && (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">建立人員</dt>
              <dd>{ncr.createdBy}</dd>
            </div>
          )}
          {ncr.resolvedAt && (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">解決時間</dt>
              <dd>{formatDateTime(ncr.resolvedAt)}</dd>
            </div>
          )}
          {ncr.resolvedBy && (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">解決人員</dt>
              <dd>{ncr.resolvedBy}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Root cause card */}
      {ncr.rootCause && (
        <div className="glass rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-amber-400">根本原因分析</h3>
          <p className="text-sm text-foreground">{ncr.rootCause}</p>
        </div>
      )}

      {/* Corrective action card */}
      {ncr.correctiveAction && (
        <div className="glass rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-semibold text-emerald-400">矯正措施</h3>
          <p className="text-sm text-foreground">{ncr.correctiveAction}</p>
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={showResolve} onOpenChange={setShowResolve}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>解決 NCR</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => resolveMut.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">根本原因 *</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="描述導致此品質異常的根本原因..."
                {...register('rootCause')}
              />
              {errors.rootCause && (
                <p className="text-xs text-destructive">{errors.rootCause.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">矯正措施 *</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="描述已採取或計劃採取的矯正措施..."
                {...register('correctiveAction')}
              />
              {errors.correctiveAction && (
                <p className="text-xs text-destructive">{errors.correctiveAction.message}</p>
              )}
            </div>
            {resolveMut.error && (
              <p className="text-sm text-destructive">{(resolveMut.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowResolve(false)}>
                取消
              </Button>
              <Button type="submit" disabled={resolveMut.isPending}>
                {resolveMut.isPending ? '儲存中...' : '確認解決'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
