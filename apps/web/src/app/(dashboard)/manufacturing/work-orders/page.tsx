'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { manufacturingApi, type WorkOrder } from '@/lib/api/manufacturing';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  released: { label: '已發放', variant: 'info' },
  in_progress: { label: '生產中', variant: 'warning' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'outline' },
};

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'released', label: '已發放' },
  { value: 'in_progress', label: '生產中' },
  { value: 'completed', label: '已完成' },
];

const COLUMNS: Column<WorkOrder>[] = [
  { key: 'woNo', header: '工單號', width: 'w-40', render: (r) => <span className="font-mono text-xs">{r.woNo}</span> },
  {
    key: 'item',
    header: '成品',
    render: (r) => (
      <div>
        <p className="font-medium text-foreground">{r.item?.name ?? '—'}</p>
        <p className="text-xs text-muted-foreground font-mono">{r.item?.code}</p>
      </div>
    ),
  },
  {
    key: 'bom',
    header: 'BOM版本',
    width: 'w-24',
    render: (r) => r.bom?.version ? <span className="font-mono text-xs">v{r.bom.version}</span> : <span className="text-muted-foreground">—</span>,
  },
  { key: 'plannedQty', header: '計畫數量', width: 'w-24', render: (r) => Number(r.plannedQty).toLocaleString() },
  {
    key: 'producedQty',
    header: '已產出',
    width: 'w-24',
    render: (r) => (
      <span className={Number(r.producedQty) >= Number(r.plannedQty) ? 'text-emerald-400 font-medium' : ''}>
        {Number(r.producedQty).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'status',
    header: '狀態',
    width: 'w-24',
    render: (r) => {
      const c = STATUS_CONFIG[r.status] ?? { label: r.status, variant: 'outline' };
      return <Badge variant={c.variant}>{c.label}</Badge>;
    },
  },
  {
    key: 'plannedStart',
    header: '計畫開始',
    width: 'w-28',
    render: (r) => r.plannedStart ? formatDate(r.plannedStart) : <span className="text-muted-foreground">—</span>,
  },
];

function generateWoNo(): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `WO-${yyyymm}-${rand}`;
}

interface CreateWoForm {
  woNo: string;
  itemId: string;
  bomId: string;
  plannedQty: string;
  plannedStart: string;
  plannedEnd: string;
  notes: string;
}

export default function WorkOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateWoForm>({
    woNo: generateWoNo(),
    itemId: '',
    bomId: '',
    plannedQty: '',
    plannedStart: '',
    plannedEnd: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['wo-list', page, search, statusFilter],
    queryFn: () =>
      manufacturingApi.workOrders.list({
        page,
        perPage: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const createMut = useMutation({
    mutationFn: () =>
      manufacturingApi.workOrders.create({
        woNo: form.woNo,
        itemId: form.itemId,
        bomId: form.bomId || undefined,
        plannedQty: Number(form.plannedQty),
        plannedStart: form.plannedStart || undefined,
        plannedEnd: form.plannedEnd || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: (wo) => {
      qc.invalidateQueries({ queryKey: ['wo-list'] });
      setDialogOpen(false);
      setFormError('');
      router.push(`/manufacturing/work-orders/${wo.id}`);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const handleSubmit = () => {
    if (!form.woNo.trim()) { setFormError('請填入工單號'); return; }
    if (!form.itemId.trim()) { setFormError('請填入成品料號ID'); return; }
    if (!form.plannedQty || isNaN(Number(form.plannedQty)) || Number(form.plannedQty) <= 0) {
      setFormError('請填入有效的計畫數量');
      return;
    }
    setFormError('');
    createMut.mutate();
  };

  const openDialog = () => {
    setForm({
      woNo: generateWoNo(),
      itemId: '',
      bomId: '',
      plannedQty: '',
      plannedStart: '',
      plannedEnd: '',
      notes: '',
    });
    setFormError('');
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">工單管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆</p>
        </div>
        <Button onClick={openDialog}>
          <Plus size={16} /> 新增工單
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋工單號、成品..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setSearch(searchInput); setPage(1); }
            }}
          />
        </div>
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setStatusFilter(t.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === t.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ['wo-list'] })}
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/manufacturing/work-orders/${r.id}`)}
        emptyMessage="尚無工單資料"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增工單</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">工單號 <span className="text-destructive">*</span></label>
              <Input
                value={form.woNo}
                onChange={(e) => setForm({ ...form, woNo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">成品料號ID <span className="text-destructive">*</span></label>
              <Input
                placeholder="請輸入成品料號ID"
                value={form.itemId}
                onChange={(e) => setForm({ ...form, itemId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">BOM ID</label>
              <Input
                placeholder="選填，輸入BOM ID"
                value={form.bomId}
                onChange={(e) => setForm({ ...form, bomId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">計畫數量 <span className="text-destructive">*</span></label>
              <Input
                type="number"
                placeholder="0"
                min="1"
                value={form.plannedQty}
                onChange={(e) => setForm({ ...form, plannedQty: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">計畫開始</label>
                <Input
                  type="date"
                  value={form.plannedStart}
                  onChange={(e) => setForm({ ...form, plannedStart: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">計畫結束</label>
                <Input
                  type="date"
                  value={form.plannedEnd}
                  onChange={(e) => setForm({ ...form, plannedEnd: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input
                placeholder="備註（選填）"
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
              {createMut.isPending ? '建立中...' : '建立工單'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
