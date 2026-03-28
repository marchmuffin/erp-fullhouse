'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, X, Plus, RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { manufacturingApi, type MrpRun, type MrpRequirement } from '@/lib/api/manufacturing';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';

const STATUS_MAP: Record<string, { label: string; variant: 'secondary' | 'default' | 'success' | 'destructive' | 'warning' }> = {
  draft:     { label: '草稿',   variant: 'secondary' },
  running:   { label: '執行中', variant: 'default' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'destructive' },
};

const COLUMNS: Column<MrpRun & { _count?: { requirements: number } }>[] = [
  {
    key: 'runNo',
    header: '計畫編號',
    width: 'w-44',
    render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.runNo}</span>,
  },
  {
    key: 'planningDate',
    header: '計畫日期',
    width: 'w-32',
    render: (r) => <span className="text-sm">{new Date(r.planningDate).toLocaleDateString('zh-TW')}</span>,
  },
  {
    key: 'horizon',
    header: '規劃天數',
    width: 'w-24',
    render: (r) => <span className="text-sm">{r.horizon} 天</span>,
  },
  {
    key: 'status',
    header: '狀態',
    width: 'w-28',
    render: (r) => {
      const s = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' as const };
      return <Badge variant={s.variant}>{s.label}</Badge>;
    },
  },
  {
    key: 'requirements',
    header: '需求筆數',
    width: 'w-28',
    render: (r) => <span className="text-sm">{r._count?.requirements ?? 0} 筆</span>,
  },
  {
    key: 'createdAt',
    header: '建立時間',
    width: 'w-40',
    render: (r) => (
      <span className="text-xs text-muted-foreground">
        {new Date(r.createdAt).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
      </span>
    ),
  },
];

const REQ_COLUMNS: Column<MrpRequirement>[] = [
  {
    key: 'itemCode',
    header: '料號',
    width: 'w-32',
    render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.itemCode}</span>,
  },
  {
    key: 'itemName',
    header: '品名',
    render: (r) => <span className="text-sm font-medium">{r.itemName}</span>,
  },
  {
    key: 'unit',
    header: '單位',
    width: 'w-16',
    render: (r) => <span className="text-xs">{r.unit}</span>,
  },
  {
    key: 'requiredQty',
    header: '需求量',
    width: 'w-28',
    render: (r) => <span className="text-sm text-right block">{Number(r.requiredQty).toFixed(2)}</span>,
  },
  {
    key: 'availableQty',
    header: '在庫量',
    width: 'w-28',
    render: (r) => <span className="text-sm text-right block">{Number(r.availableQty).toFixed(2)}</span>,
  },
  {
    key: 'shortageQty',
    header: '缺料量',
    width: 'w-28',
    render: (r) => (
      <span className={`text-sm font-medium text-right block ${Number(r.shortageQty) > 0 ? 'text-destructive' : 'text-emerald-400'}`}>
        {Number(r.shortageQty) > 0 && <AlertTriangle size={12} className="inline mr-1" />}
        {Number(r.shortageQty).toFixed(2)}
      </span>
    ),
  },
];

interface CreateMrpForm {
  planningDate: string;
  horizon: string;
  notes: string;
}

export default function MrpPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateMrpForm>({
    planningDate: new Date().toISOString().split('T')[0],
    horizon: '30',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['mrp-list', page],
    queryFn: () => manufacturingApi.mrp.list({ page, perPage: 20 }),
  });

  const { data: expandedRun, isLoading: reqLoading } = useQuery({
    queryKey: ['mrp-detail', expandedId],
    queryFn: () => manufacturingApi.mrp.get(expandedId!),
    enabled: !!expandedId,
  });

  const createMut = useMutation({
    mutationFn: () =>
      manufacturingApi.mrp.create({
        planningDate: form.planningDate,
        horizon: form.horizon ? parseInt(form.horizon, 10) : undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mrp-list'] });
      setDialogOpen(false);
      setForm({ planningDate: new Date().toISOString().split('T')[0], horizon: '30', notes: '' });
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const runMut = useMutation({
    mutationFn: (id: string) => manufacturingApi.mrp.run(id),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['mrp-list'] });
      qc.invalidateQueries({ queryKey: ['mrp-detail', updated.id] });
      if (expandedId === updated.id) {
        // keep expanded — query will refresh
      }
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => manufacturingApi.mrp.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mrp-list'] });
      qc.invalidateQueries({ queryKey: ['mrp-detail', expandedId] });
    },
  });

  const handleSubmit = () => {
    if (!form.planningDate) { setFormError('請選擇計畫日期'); return; }
    const h = parseInt(form.horizon, 10);
    if (!h || h < 1) { setFormError('規劃天數須大於 0'); return; }
    setFormError('');
    createMut.mutate();
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const rows = (data?.data ?? []) as (MrpRun & { _count?: { requirements: number } })[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">物料需求計畫 (MRP)</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆計畫</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['mrp-list'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => { setDialogOpen(true); setFormError(''); }}>
            <Plus size={16} /> 新增MRP計畫
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">載入中...</div>
        )}
        {!isLoading && rows.length === 0 && (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground text-sm">尚無MRP計畫資料</div>
        )}
        {rows.map((row) => {
          const isExpanded = expandedId === row.id;
          const s = STATUS_MAP[row.status] ?? { label: row.status, variant: 'secondary' as const };
          return (
            <div key={row.id} className="glass rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleExpand(row.id)}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <span className="font-mono text-xs text-muted-foreground w-44 shrink-0">{row.runNo}</span>
                <span className="text-sm w-32 shrink-0">
                  {new Date(row.planningDate).toLocaleDateString('zh-TW')}
                </span>
                <span className="text-sm text-muted-foreground w-20 shrink-0">{row.horizon} 天</span>
                <Badge variant={s.variant}>{s.label}</Badge>
                <span className="text-sm text-muted-foreground ml-2">{row._count?.requirements ?? 0} 筆需求</span>
                <div className="ml-auto flex gap-2">
                  {['draft', 'running'].includes(row.status) && (
                    <>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); runMut.mutate(row.id); }}
                        disabled={runMut.isPending}
                      >
                        <Play size={12} /> 執行
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); cancelMut.mutate(row.id); }}
                        disabled={cancelMut.isPending}
                      >
                        <X size={12} /> 取消
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border/30 px-4 pb-4 pt-2">
                  {reqLoading && (
                    <p className="text-sm text-muted-foreground py-4 text-center">載入需求明細...</p>
                  )}
                  {!reqLoading && expandedRun && (
                    <>
                      {expandedRun.requirements && expandedRun.requirements.length > 0 ? (
                        <DataTable
                          columns={REQ_COLUMNS}
                          data={expandedRun.requirements}
                          loading={false}
                          emptyMessage="無需求資料"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          {row.status === 'completed' ? '無需求資料（工單無BOM或無匹配組件）' : '請先執行此MRP計畫以產生需求明細'}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一頁
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            {page} / {data.meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一頁
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增MRP計畫</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                計畫日期 <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={form.planningDate}
                onChange={(e) => setForm({ ...form, planningDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">將計算該日期起算指定天數內的工單需求</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                規劃天數 <span className="text-destructive">*</span>
              </label>
              <Input
                type="number"
                min={1}
                placeholder="預設30天"
                value={form.horizon}
                onChange={(e) => setForm({ ...form, horizon: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input
                placeholder="說明（選填）"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>
              {createMut.isPending ? '建立中...' : '建立計畫'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
