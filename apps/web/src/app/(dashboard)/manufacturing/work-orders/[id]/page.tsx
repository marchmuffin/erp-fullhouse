'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Play, Send, Package, CheckCircle, CheckSquare } from 'lucide-react';
import { manufacturingApi, type WoOperation } from '@/lib/api/manufacturing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { formatDate, formatDateTime } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  released: { label: '已發放', variant: 'info' },
  in_progress: { label: '生產中', variant: 'warning' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'outline' },
};

const OP_STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  pending: { label: '待開始', variant: 'secondary' },
  in_progress: { label: '進行中', variant: 'warning' },
  completed: { label: '已完成', variant: 'success' },
};

type TabKey = 'materials' | 'operations' | 'history';

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['wo-detail', id] });

  const [activeTab, setActiveTab] = useState<TabKey>('materials');
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [producedQty, setProducedQty] = useState('');
  const [completeError, setCompleteError] = useState('');

  const [opDialogOpen, setOpDialogOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<WoOperation | null>(null);
  const [actualHours, setActualHours] = useState('');
  const [opError, setOpError] = useState('');

  const { data: wo, isLoading } = useQuery({
    queryKey: ['wo-detail', id],
    queryFn: () => manufacturingApi.workOrders.get(id),
  });

  const releaseMut = useMutation({ mutationFn: () => manufacturingApi.workOrders.release(id), onSuccess: invalidate });
  const startMut = useMutation({ mutationFn: () => manufacturingApi.workOrders.start(id), onSuccess: invalidate });
  const issueMut = useMutation({ mutationFn: () => manufacturingApi.workOrders.issueMaterials(id), onSuccess: invalidate });
  const cancelMut = useMutation({ mutationFn: () => manufacturingApi.workOrders.cancel(id), onSuccess: invalidate });

  const completeMut = useMutation({
    mutationFn: () => manufacturingApi.workOrders.complete(id, { producedQty: Number(producedQty) }),
    onSuccess: () => {
      invalidate();
      setCompleteDialogOpen(false);
      setProducedQty('');
      setCompleteError('');
    },
    onError: (err: Error) => setCompleteError(err.message),
  });

  const completeOpMut = useMutation({
    mutationFn: () =>
      manufacturingApi.workOrders.completeOperation(id, selectedOp!.id, {
        actualHours: Number(actualHours),
      }),
    onSuccess: () => {
      invalidate();
      setOpDialogOpen(false);
      setSelectedOp(null);
      setActualHours('');
      setOpError('');
    },
    onError: (err: Error) => setOpError(err.message),
  });

  const handleComplete = () => {
    if (!producedQty || isNaN(Number(producedQty)) || Number(producedQty) < 0) {
      setCompleteError('請填入有效的產出數量');
      return;
    }
    setCompleteError('');
    completeMut.mutate();
  };

  const handleCompleteOp = () => {
    if (!actualHours || isNaN(Number(actualHours)) || Number(actualHours) < 0) {
      setOpError('請填入有效的實際工時');
      return;
    }
    setOpError('');
    completeOpMut.mutate();
  };

  const openOpDialog = (op: WoOperation) => {
    setSelectedOp(op);
    setActualHours('');
    setOpError('');
    setOpDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!wo) return null;

  const statusCfg = STATUS_CONFIG[wo.status] ?? { label: wo.status, variant: 'outline' };
  const isDone = wo.status === 'completed' || wo.status === 'cancelled';

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'materials', label: '用料清單' },
    { key: 'operations', label: '工序' },
    { key: 'history', label: '歷史' },
  ];

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
              <h2 className="text-xl font-bold text-foreground font-mono">{wo.woNo}</h2>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {wo.item?.name ?? '—'}
              {wo.item?.code && <span className="font-mono ml-1">({wo.item.code})</span>}
            </p>
          </div>
        </div>

        {!isDone && (
          <div className="flex gap-2">
            {wo.status === 'draft' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => cancelMut.mutate()}
                  disabled={cancelMut.isPending}
                >
                  取消工單
                </Button>
                <Button size="sm" onClick={() => releaseMut.mutate()} disabled={releaseMut.isPending}>
                  <Send size={14} /> 發放工單
                </Button>
              </>
            )}
            {wo.status === 'released' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => issueMut.mutate()}
                  disabled={issueMut.isPending}
                >
                  <Package size={14} /> 發料
                </Button>
                <Button size="sm" onClick={() => startMut.mutate()} disabled={startMut.isPending}>
                  <Play size={14} /> 開始生產
                </Button>
              </>
            )}
            {wo.status === 'in_progress' && (
              <Button
                size="sm"
                onClick={() => {
                  setProducedQty(String(wo.plannedQty));
                  setCompleteError('');
                  setCompleteDialogOpen(true);
                }}
              >
                <CheckCircle size={14} /> 完成生產
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">工單資訊</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">BOM版本</p>
            <p className="font-medium">{wo.bom?.version ? `v${wo.bom.version}` : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">計畫數量</p>
            <p className="font-medium">{Number(wo.plannedQty).toLocaleString()} {wo.item?.unit}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">已產出數量</p>
            <p className={`font-medium ${Number(wo.producedQty) >= Number(wo.plannedQty) ? 'text-emerald-400' : ''}`}>
              {Number(wo.producedQty).toLocaleString()} {wo.item?.unit}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">計畫開始</p>
            <p className="font-medium">{wo.plannedStart ? formatDate(wo.plannedStart) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">計畫結束</p>
            <p className="font-medium">{wo.plannedEnd ? formatDate(wo.plannedEnd) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">實際開始</p>
            <p className="font-medium">{wo.actualStart ? formatDate(wo.actualStart) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">實際結束</p>
            <p className="font-medium">{wo.actualEnd ? formatDate(wo.actualEnd) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1 w-fit mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">用料清單</h3>
            {!wo.materialIssues || wo.materialIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">尚無用料記錄</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['料號', '品名', '倉庫', '需求數量', '已發數量', '進度', '發料時間'].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wo.materialIssues.map((mi) => {
                      const pct = Number(mi.requiredQty) > 0
                        ? Math.min(100, Math.round((Number(mi.issuedQty) / Number(mi.requiredQty)) * 100))
                        : 0;
                      return (
                        <tr key={mi.id} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                            {mi.item?.code ?? mi.itemId}
                          </td>
                          <td className="px-3 py-2.5">{mi.item?.name ?? '—'}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{mi.warehouse?.name ?? '—'}</td>
                          <td className="px-3 py-2.5">{Number(mi.requiredQty).toLocaleString()} {mi.item?.unit}</td>
                          <td className="px-3 py-2.5">{Number(mi.issuedQty).toLocaleString()} {mi.item?.unit}</td>
                          <td className="px-3 py-3 w-32">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-400' : 'bg-primary'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">
                            {mi.issuedAt ? formatDateTime(mi.issuedAt) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">工序</h3>
            {!wo.operations || wo.operations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">尚無工序資料</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['序號', '工序名稱', '計畫工時', '實際工時', '狀態', '完成時間', ''].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wo.operations.map((op) => {
                      const opCfg = OP_STATUS_CONFIG[op.status] ?? { label: op.status, variant: 'outline' };
                      return (
                        <tr key={op.id} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2.5 text-muted-foreground">{op.stepNo}</td>
                          <td className="px-3 py-2.5 font-medium">{op.name}</td>
                          <td className="px-3 py-2.5">
                            {op.plannedHours != null ? `${op.plannedHours} h` : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            {op.actualHours != null ? `${op.actualHours} h` : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant={opCfg.variant}>{opCfg.label}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground text-xs">
                            {op.completedAt ? formatDateTime(op.completedAt) : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            {op.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openOpDialog(op)}
                              >
                                <CheckSquare size={12} /> 完成工序
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">歷史記錄</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border/40 pb-3">
                <dt className="text-muted-foreground">建立時間</dt>
                <dd className="font-medium">{formatDateTime(wo.createdAt)}</dd>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-3">
                <dt className="text-muted-foreground">最後更新</dt>
                <dd className="font-medium">{formatDateTime(wo.updatedAt)}</dd>
              </div>
              {wo.actualStart && (
                <div className="flex justify-between border-b border-border/40 pb-3">
                  <dt className="text-muted-foreground">實際開工</dt>
                  <dd className="font-medium">{formatDateTime(wo.actualStart)}</dd>
                </div>
              )}
              {wo.actualEnd && (
                <div className="flex justify-between border-b border-border/40 pb-3">
                  <dt className="text-muted-foreground">實際完工</dt>
                  <dd className="font-medium">{formatDateTime(wo.actualEnd)}</dd>
                </div>
              )}
              {wo.createdBy && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">建立人員</dt>
                  <dd className="font-medium">{wo.createdBy}</dd>
                </div>
              )}
              {wo.notes && (
                <div className="pt-3 border-t border-border/40">
                  <dt className="text-muted-foreground mb-1">備註</dt>
                  <dd className="text-foreground">{wo.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Complete Production Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>完成生產</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              請填入實際產出數量（計畫數量：{Number(wo.plannedQty).toLocaleString()} {wo.item?.unit}）
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">實際產出數量 <span className="text-destructive">*</span></label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                value={producedQty}
                onChange={(e) => setProducedQty(e.target.value)}
              />
            </div>
            {completeError && <p className="text-sm text-destructive">{completeError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleComplete} disabled={completeMut.isPending}>
              {completeMut.isPending ? '完成中...' : '確認完成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Operation Dialog */}
      <Dialog open={opDialogOpen} onOpenChange={setOpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>完成工序：{selectedOp?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              計畫工時：{selectedOp?.plannedHours != null ? `${selectedOp.plannedHours} h` : '未設定'}
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">實際工時（小時）<span className="text-destructive">*</span></label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                step="0.5"
                value={actualHours}
                onChange={(e) => setActualHours(e.target.value)}
              />
            </div>
            {opError && <p className="text-sm text-destructive">{opError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleCompleteOp} disabled={completeOpMut.isPending}>
              {completeOpMut.isPending ? '完成中...' : '確認完成'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
