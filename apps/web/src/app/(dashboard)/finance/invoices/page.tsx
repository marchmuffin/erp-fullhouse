'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw, Trash2 } from 'lucide-react';
import { financeApi, type Invoice } from '@/lib/api/finance';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft:     { label: '草稿', variant: 'secondary' },
  issued:    { label: '已開立', variant: 'info' },
  partial:   { label: '部分付款', variant: 'warning' },
  paid:      { label: '已付款', variant: 'success' },
  overdue:   { label: '逾期', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'outline' },
};

const TYPE_TABS = [
  { value: '', label: '全部' },
  { value: 'ar', label: '應收' },
  { value: 'ap', label: '應付' },
];

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'issued', label: '未付' },
  { value: 'partial', label: '部分付款' },
  { value: 'paid', label: '已付' },
];

const lineSchema = z.object({
  lineNo:      z.number(),
  description: z.string().min(1, '必填'),
  quantity:    z.coerce.number().min(0.0001, '數量必須大於 0'),
  unitPrice:   z.coerce.number().min(0, '單價不得為負'),
});

const formSchema = z.object({
  type:        z.enum(['ar', 'ap']),
  partyName:   z.string().min(1, '必填'),
  partyId:     z.string().min(1, '必填'),
  invoiceDate: z.string().min(1, '必填'),
  dueDate:     z.string().min(1, '必填'),
  lines:       z.array(lineSchema).min(1),
});

type FormData = z.infer<typeof formSchema>;

function InvoiceFormLines({ control, register }: { control: any; register: any }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = useWatch({ control, name: 'lines' }) ?? [];

  const subtotal = watchedLines.reduce((sum: number, l: any) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">發票明細</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ lineNo: fields.length + 1, description: '', quantity: 1, unitPrice: 0 })}
        >
          <Plus size={14} /> 新增行
        </Button>
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['說明', '數量', '單價', '金額', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field, idx) => {
              const qty = Number(watchedLines[idx]?.quantity) || 0;
              const price = Number(watchedLines[idx]?.unitPrice) || 0;
              const lineAmt = qty * price;
              return (
                <tr key={field.id} className="border-b border-border/40 last:border-0">
                  <td className="px-2 py-1.5">
                    <Input placeholder="品項說明" className="h-8 text-xs" {...register(`lines.${idx}.description`)} />
                  </td>
                  <td className="px-2 py-1.5 w-24">
                    <Input type="number" step="0.0001" placeholder="1" className="h-8 text-xs" {...register(`lines.${idx}.quantity`)} />
                  </td>
                  <td className="px-2 py-1.5 w-32">
                    <Input type="number" step="0.01" placeholder="0" className="h-8 text-xs" {...register(`lines.${idx}.unitPrice`)} />
                  </td>
                  <td className="px-3 py-1.5 w-28 text-right tabular-nums text-xs text-muted-foreground">
                    {formatCurrency(lineAmt)}
                  </td>
                  <td className="px-2 py-1.5 w-8">
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-sm text-right px-2">
        <div className="flex justify-end gap-4">
          <span className="text-muted-foreground">小計</span>
          <span className="w-28 tabular-nums font-medium">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-end gap-4">
          <span className="text-muted-foreground">稅額 (5%)</span>
          <span className="w-28 tabular-nums">{formatCurrency(tax)}</span>
        </div>
        <div className="flex justify-end gap-4 border-t border-border pt-1">
          <span className="font-semibold">合計</span>
          <span className="w-28 tabular-nums font-bold text-primary">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}

const COLUMNS: Column<Invoice>[] = [
  { key: 'invoiceNo', header: '發票號', width: 'w-36' },
  { key: 'partyName', header: '對象名稱' },
  {
    key: 'type', header: '類型', width: 'w-20',
    render: (r) => (
      <Badge variant={r.type === 'ar' ? 'success' : 'warning'}>
        {r.type === 'ar' ? 'AR' : 'AP'}
      </Badge>
    ),
  },
  { key: 'invoiceDate', header: '發票日期', width: 'w-28', render: (r) => formatDate(r.invoiceDate) },
  { key: 'dueDate', header: '到期日', width: 'w-28', render: (r) => formatDate(r.dueDate) },
  { key: 'totalAmount', header: '總金額', width: 'w-32', render: (r) => formatCurrency(Number(r.totalAmount)) },
  { key: 'paidAmount', header: '已付', width: 'w-28', render: (r) => formatCurrency(Number(r.paidAmount)) },
  {
    key: 'status', header: '狀態', width: 'w-24',
    render: (r) => {
      const cfg = STATUS_CONFIG[r.status] ?? { label: r.status, variant: 'outline' };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
];

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const t = searchParams.get('type');
    if (t) setTypeFilter(t);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['invoice-list', page, search, typeFilter, statusFilter],
    queryFn: () => financeApi.invoices.list({
      page, perPage: 20,
      search: search || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
  });

  const createMutation = useMutation({
    mutationFn: (d: FormData) => financeApi.invoices.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-list'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, control, handleSubmit, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'ar',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      lines: [{ lineNo: 1, description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">發票管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> 新增發票</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋發票號、對象..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
          />
        </div>
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setTypeFilter(t.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${typeFilter === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setStatusFilter(t.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['invoice-list'] })}><RefreshCw size={14} /></Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/finance/invoices/${(r as any).id}`)}
        emptyMessage="尚無發票資料"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增發票</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">類型 *</label>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('type')}
                >
                  <option value="ar">應收帳款 (AR)</option>
                  <option value="ap">應付帳款 (AP)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">對象 ID *</label>
                <Input placeholder="客戶或供應商 ID" {...register('partyId')} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <label className="text-sm font-medium text-foreground">對象名稱 *</label>
                <Input placeholder="客戶或供應商名稱" {...register('partyName')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">發票日期 *</label>
                <Input type="date" {...register('invoiceDate')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">到期日 *</label>
                <Input type="date" {...register('dueDate')} />
              </div>
            </div>

            <InvoiceFormLines control={control} register={register} />

            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '儲存中...' : '建立發票'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
