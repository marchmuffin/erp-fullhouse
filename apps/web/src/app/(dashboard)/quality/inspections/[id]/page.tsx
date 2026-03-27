'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, CheckCircle, AlertTriangle, Save } from 'lucide-react';
import { qualityApi } from '@/lib/api/quality';
import type { IoChecklistItem } from '@/lib/api/quality';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDateTime } from '@/lib/utils';

const TYPE_LABEL: Record<string, string> = {
  incoming: '進料檢驗',
  in_process: '製程檢驗',
  outgoing: '出貨檢驗',
};

const TYPE_VARIANT: Record<string, any> = {
  incoming: 'info',
  in_process: 'warning',
  outgoing: 'secondary',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '待檢驗',
  in_progress: '檢驗中',
  passed: '合格',
  failed: '不合格',
  on_hold: '待確認',
};

const STATUS_VARIANT: Record<string, any> = {
  pending: 'secondary',
  in_progress: 'warning',
  passed: 'success',
  failed: 'destructive',
  on_hold: 'outline',
};

const NCR_SEVERITY_LABEL: Record<string, string> = {
  minor: '輕微',
  major: '重大',
  critical: '嚴重',
};

const NCR_SEVERITY_VARIANT: Record<string, any> = {
  minor: 'warning',
  major: 'destructive',
  critical: 'destructive',
};

const NCR_STATUS_LABEL: Record<string, string> = {
  open: '待處理',
  in_review: '處理中',
  resolved: '已解決',
  closed: '已關閉',
};

const NCR_STATUS_VARIANT: Record<string, any> = {
  open: 'destructive',
  in_review: 'warning',
  resolved: 'info',
  closed: 'secondary',
};

const recordResultSchema = z.object({
  result: z.enum(['pass', 'fail', 'conditional']),
  notes: z.string().optional(),
});

const createNcrSchema = z.object({
  severity: z.enum(['minor', 'major', 'critical']),
  description: z.string().min(1, '請輸入異常說明'),
});

type RecordResultValues = z.infer<typeof recordResultSchema>;
type CreateNcrValues = z.infer<typeof createNcrSchema>;

function ChecklistRow({
  item,
  ioId,
  isInProgress,
}: {
  item: IoChecklistItem;
  ioId: string;
  isInProgress: boolean;
}) {
  const qc = useQueryClient();
  const [localResult, setLocalResult] = useState(item.result ?? '');
  const [localActual, setLocalActual] = useState(item.actualValue ?? '');
  const [localNotes, setLocalNotes] = useState(item.notes ?? '');

  const saveMut = useMutation({
    mutationFn: () =>
      qualityApi.inspections.updateChecklistItem(ioId, item.id, {
        result: localResult,
        actualValue: localActual,
        notes: localNotes,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['io-detail', ioId] }),
  });

  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-3 py-2.5 text-muted-foreground text-center">{item.itemNo}</td>
      <td className="px-3 py-2.5">{item.checkPoint}</td>
      <td className="px-3 py-2.5 text-muted-foreground text-sm">{item.criteria ?? '—'}</td>
      <td className="px-3 py-2.5 w-28">
        {isInProgress ? (
          <select
            className="flex h-8 w-full rounded-md border border-border bg-input px-2 text-xs text-foreground focus-visible:outline-none"
            value={localResult}
            onChange={(e) => setLocalResult(e.target.value)}
          >
            <option value="">選擇</option>
            <option value="pass">合格</option>
            <option value="fail">不合格</option>
            <option value="na">N/A</option>
          </select>
        ) : (
          <span className={
            item.result === 'pass' ? 'text-emerald-400 text-sm' :
            item.result === 'fail' ? 'text-red-400 text-sm' :
            'text-muted-foreground text-sm'
          }>
            {item.result === 'pass' ? '合格' : item.result === 'fail' ? '不合格' : item.result === 'na' ? 'N/A' : '—'}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 w-32">
        {isInProgress ? (
          <Input
            className="h-8 text-xs"
            placeholder="實測值"
            value={localActual}
            onChange={(e) => setLocalActual(e.target.value)}
          />
        ) : (
          <span className="text-sm">{item.actualValue ?? '—'}</span>
        )}
      </td>
      <td className="px-3 py-2.5 w-28">
        {isInProgress ? (
          <Input
            className="h-8 text-xs"
            placeholder="備註"
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
          />
        ) : (
          <span className="text-sm text-muted-foreground">{item.notes ?? '—'}</span>
        )}
      </td>
      {isInProgress && (
        <td className="px-3 py-2.5 w-16">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !localResult}
          >
            <Save size={14} />
          </Button>
        </td>
      )}
    </tr>
  );
}

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['io-detail', id] });

  const [showResult, setShowResult] = useState(false);
  const [showCreateNcr, setShowCreateNcr] = useState(false);

  const { data: io, isLoading } = useQuery({
    queryKey: ['io-detail', id],
    queryFn: () => qualityApi.inspections.get(id),
  });

  const startMut = useMutation({
    mutationFn: () => qualityApi.inspections.start(id),
    onSuccess: invalidate,
  });

  const resultForm = useForm<RecordResultValues>({
    resolver: zodResolver(recordResultSchema),
    defaultValues: { result: 'pass' },
  });

  const recordResultMut = useMutation({
    mutationFn: (d: RecordResultValues) => qualityApi.inspections.recordResult(id, d),
    onSuccess: () => { invalidate(); setShowResult(false); resultForm.reset(); },
  });

  const ncrForm = useForm<CreateNcrValues>({
    resolver: zodResolver(createNcrSchema),
    defaultValues: { severity: 'minor' },
  });

  const createNcrMut = useMutation({
    mutationFn: (d: CreateNcrValues) =>
      qualityApi.ncrs.create({ ...d, inspectionOrderId: id }),
    onSuccess: () => { invalidate(); setShowCreateNcr(false); ncrForm.reset(); },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!io) return null;

  const typeCfg = { label: TYPE_LABEL[io.type] ?? io.type, variant: TYPE_VARIANT[io.type] ?? 'outline' };
  const statusCfg = { label: STATUS_LABEL[io.status] ?? io.status, variant: STATUS_VARIANT[io.status] ?? 'outline' };
  const isInProgress = io.status === 'in_progress';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{io.ioNo}</h2>
              <Badge variant={typeCfg.variant}>{typeCfg.label}</Badge>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              建立於 {formatDateTime(io.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {io.status === 'pending' && (
            <Button size="sm" onClick={() => startMut.mutate()} disabled={startMut.isPending}>
              <Play size={14} /> 開始檢驗
            </Button>
          )}
          {isInProgress && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateNcr(true)}
              >
                <AlertTriangle size={14} /> 新增 NCR
              </Button>
              <Button size="sm" onClick={() => setShowResult(true)}>
                <CheckCircle size={14} /> 記錄結果
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="glass rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold">檢驗資訊</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">品名</dt>
            <dd className="font-medium">{io.itemName ?? '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">數量</dt>
            <dd>{Number(io.quantity).toLocaleString()}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">檢驗員</dt>
            <dd>{io.inspector ?? '—'}</dd>
          </div>
          {io.refDocType && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">參考單據</dt>
              <dd>{io.refDocType} {io.refDocNo}</dd>
            </div>
          )}
          {io.result && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">檢驗結論</dt>
              <dd className={
                io.result === 'pass' ? 'text-emerald-400 font-medium' :
                io.result === 'fail' ? 'text-red-400 font-medium' :
                'text-amber-400 font-medium'
              }>
                {io.result === 'pass' ? '合格' : io.result === 'fail' ? '不合格' : '條件放行'}
              </dd>
            </div>
          )}
          {io.inspectedAt && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">檢驗時間</dt>
              <dd>{formatDateTime(io.inspectedAt)}</dd>
            </div>
          )}
          {io.notes && (
            <div className="flex flex-col gap-0.5 col-span-full">
              <dt className="text-muted-foreground">備註</dt>
              <dd>{io.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Checklist */}
      {(io.checklistItems?.length ?? 0) > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">檢驗清單</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['#', '檢驗項目', '允收準則', '結果', '實測值', '備註', ...(isInProgress ? [''] : [])].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {io.checklistItems?.map((ci) => (
                  <ChecklistRow key={ci.id} item={ci} ioId={id} isInProgress={isInProgress} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NCRs */}
      {(io.ncrs?.length ?? 0) > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">品質異常 ({io.ncrs?.length})</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['NCR 號', '嚴重度', '說明', '狀態'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {io.ncrs?.map((ncr) => (
                <tr
                  key={ncr.id}
                  className="border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/30"
                  onClick={() => router.push(`/quality/ncrs/${ncr.id}`)}
                >
                  <td className="px-3 py-2.5 font-mono text-xs">{ncr.ncrNo}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={NCR_SEVERITY_VARIANT[ncr.severity] ?? 'outline'}>
                      {NCR_SEVERITY_LABEL[ncr.severity] ?? ncr.severity}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 max-w-xs truncate">{ncr.description}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={NCR_STATUS_VARIANT[ncr.status] ?? 'outline'}>
                      {NCR_STATUS_LABEL[ncr.status] ?? ncr.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>記錄檢驗結果</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={resultForm.handleSubmit((d) => recordResultMut.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">檢驗結論 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...resultForm.register('result')}
              >
                <option value="pass">合格 (Pass)</option>
                <option value="fail">不合格 (Fail)</option>
                <option value="conditional">條件放行 (Conditional)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="輸入備註說明" {...resultForm.register('notes')} />
            </div>
            {recordResultMut.error && (
              <p className="text-sm text-destructive">{(recordResultMut.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowResult(false)}>
                取消
              </Button>
              <Button type="submit" disabled={recordResultMut.isPending}>
                {recordResultMut.isPending ? '儲存中...' : '確認結果'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create NCR Dialog */}
      <Dialog open={showCreateNcr} onOpenChange={setShowCreateNcr}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增品質異常 (NCR)</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={ncrForm.handleSubmit((d) => createNcrMut.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">嚴重度 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...ncrForm.register('severity')}
              >
                <option value="minor">輕微 (Minor)</option>
                <option value="major">重大 (Major)</option>
                <option value="critical">嚴重 (Critical)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">異常說明 *</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="詳細描述品質異常情形..."
                {...ncrForm.register('description')}
              />
              {ncrForm.formState.errors.description && (
                <p className="text-xs text-destructive">
                  {ncrForm.formState.errors.description.message}
                </p>
              )}
            </div>
            {createNcrMut.error && (
              <p className="text-sm text-destructive">{(createNcrMut.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateNcr(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createNcrMut.isPending}>
                {createNcrMut.isPending ? '建立中...' : '建立 NCR'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
