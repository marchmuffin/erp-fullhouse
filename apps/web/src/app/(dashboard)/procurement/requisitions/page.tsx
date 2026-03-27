'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { procurementApi, type PurchaseRequisition } from '@/lib/api/procurement';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDate } from '@/lib/utils';
import { Trash2, Plus as PlusIcon } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending_approval: { label: '待審核', variant: 'warning' },
  approved: { label: '已核准', variant: 'success' },
  converted: { label: '已轉單', variant: 'default' },
  rejected: { label: '已駁回', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'outline' },
};

const COLUMNS: Column<PurchaseRequisition>[] = [
  { key: 'prNo', header: '申請單號', width: 'w-36' },
  { key: 'department', header: '申請部門', width: 'w-32', render: (r) => r.department ?? '-' },
  {
    key: 'status', header: '狀態', width: 'w-28',
    render: (r) => { const c = STATUS_CONFIG[r.status] ?? { label: r.status, variant: 'outline' }; return <Badge variant={c.variant}>{c.label}</Badge>; },
  },
  { key: 'requestDate', header: '申請日期', width: 'w-28', render: (r) => formatDate(r.requestDate) },
  { key: 'lines', header: '品項數', width: 'w-20', render: (r) => `${r.lines?.length ?? 0} 項` },
  { key: 'createdAt', header: '建立時間', width: 'w-36', render: (r) => formatDate(r.createdAt) },
];

const lineSchema = z.object({
  lineNo: z.number(),
  itemCode: z.string().min(1, '必填'),
  itemName: z.string().min(1, '必填'),
  spec: z.string().optional(),
  unit: z.string().min(1, '必填'),
  quantity: z.coerce.number().min(0.0001, '數量必須大於 0'),
  notes: z.string().optional(),
});

const formSchema = z.object({
  prNo: z.string().min(1).max(30),
  requestDate: z.string().min(1),
  requiredDate: z.string().optional(),
  department: z.string().optional(),
  purpose: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export default function RequisitionsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['pr-list', page, search, statusFilter],
    queryFn: () => procurementApi.requisitions.list({ page, perPage: 20, search: search || undefined, status: statusFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => procurementApi.requisitions.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pr-list'] }); setShowCreate(false); reset(); },
  });

  const { register, control, handleSubmit, reset, setValue } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requestDate: new Date().toISOString().split('T')[0],
      lines: [{ lineNo: 1, itemCode: '', itemName: '', unit: 'PCS', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  // Auto-generate PR number
  const genPrNo = () => {
    const d = new Date();
    setValue('prNo', `PR-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">採購申請單</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta.total ?? 0} 筆</p>
        </div>
        <Button onClick={() => { genPrNo(); setShowCreate(true); }}><Plus size={16} /> 新增申請單</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜尋申請單號、部門..." className="pl-9" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
        </div>
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {[{ value: '', label: '全部' }, { value: 'draft', label: '草稿' }, { value: 'pending_approval', label: '待審核' }, { value: 'approved', label: '已核准' }].map((t) => (
            <button key={t.value} onClick={() => { setStatusFilter(t.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['pr-list'] })}><RefreshCw size={14} /></Button>
      </div>

      <DataTable columns={COLUMNS} data={(data?.data as any) ?? []} meta={data?.meta} loading={isLoading} onPageChange={setPage}
        onRowClick={(r) => router.push(`/procurement/requisitions/${r.id}`)} emptyMessage="尚無採購申請單" />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增採購申請單</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">申請單號 *</label>
                <Input {...register('prNo')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">申請部門</label>
                <Input placeholder="Production" {...register('department')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">申請日期 *</label>
                <Input type="date" {...register('requestDate')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">需求日期</label>
                <Input type="date" {...register('requiredDate')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">採購原因</label>
              <Input placeholder="生產用料" {...register('purpose')} />
            </div>

            {/* Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">申請品項</label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ lineNo: fields.length + 1, itemCode: '', itemName: '', unit: 'PCS', quantity: 1 })}>
                  <PlusIcon size={14} /> 新增品項
                </Button>
              </div>
              {fields.map((field, idx) => (
                <div key={field.id} className="rounded-lg border border-border/50 p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">品項 {idx + 1}</span>
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1"><label className="text-xs text-muted-foreground">料號 *</label><Input placeholder="RAW-001" {...register(`lines.${idx}.itemCode`)} /></div>
                    <div className="col-span-1 sm:col-span-2 space-y-1"><label className="text-xs text-muted-foreground">品名 *</label><Input placeholder="物料名稱" {...register(`lines.${idx}.itemName`)} /></div>
                    <div className="space-y-1"><label className="text-xs text-muted-foreground">單位</label><Input placeholder="PCS" {...register(`lines.${idx}.unit`)} /></div>
                    <div className="space-y-1"><label className="text-xs text-muted-foreground">數量 *</label><Input type="number" step="0.0001" {...register(`lines.${idx}.quantity`)} /></div>
                    <div className="col-span-1 sm:col-span-3 space-y-1"><label className="text-xs text-muted-foreground">規格</label><Input placeholder="規格說明" {...register(`lines.${idx}.spec`)} /></div>
                  </div>
                </div>
              ))}
            </div>

            {createMutation.error && <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? '儲存中...' : '建立申請單'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
