'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw, Trash2 } from 'lucide-react';
import { financeApi, type JournalEntry } from '@/lib/api/finance';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft:    { label: '草稿', variant: 'secondary' },
  posted:   { label: '已過帳', variant: 'success' },
  reversed: { label: '已沖銷', variant: 'outline' },
};

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'posted', label: '已過帳' },
];

const lineSchema = z.object({
  lineNo:          z.number(),
  debitAccountId:  z.string().optional(),
  creditAccountId: z.string().optional(),
  amount:          z.coerce.number().min(0.01, '金額必須大於 0'),
  description:     z.string().optional(),
});

const formSchema = z.object({
  jeDate:      z.string().min(1, '必填'),
  description: z.string().min(1, '必填'),
  lines:       z.array(lineSchema).min(1),
});

type FormData = z.infer<typeof formSchema>;

export default function JournalPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['journal-list', page, search, statusFilter],
    queryFn: () => financeApi.journal.list({ page, perPage: 20, search: search || undefined, status: statusFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (d: FormData) => financeApi.journal.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal-list'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, control, handleSubmit, reset, watch } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jeDate: new Date().toISOString().split('T')[0],
      description: '',
      lines: [{ lineNo: 1, debitAccountId: '', creditAccountId: '', amount: 0, description: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');

  const totalDebit = watchedLines?.reduce((sum, l) => sum + (l.debitAccountId ? Number(l.amount) || 0 : 0), 0) ?? 0;
  const totalCredit = watchedLines?.reduce((sum, l) => sum + (l.creditAccountId ? Number(l.amount) || 0 : 0), 0) ?? 0;
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const COLUMNS: Column<JournalEntry>[] = [
    { key: 'jeNo', header: '傳票號', width: 'w-36' },
    { key: 'jeDate', header: '日期', width: 'w-28', render: (r) => formatDate(r.jeDate) },
    { key: 'description', header: '說明' },
    {
      key: 'lines', header: '借方合計', width: 'w-32',
      render: (r) => formatCurrency(
        (r.lines ?? []).reduce((sum, l) => sum + (l.debitAccountId ? Number(l.amount) : 0), 0)
      ),
    },
    {
      key: 'status', header: '狀態', width: 'w-24',
      render: (r) => {
        const cfg = STATUS_CONFIG[r.status] ?? { label: r.status, variant: 'outline' };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    { key: 'createdAt', header: '建立時間', width: 'w-36', render: (r) => formatDate(r.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">日記帳</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆傳票</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> 新增傳票</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋傳票號、說明..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
          />
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
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['journal-list'] })}><RefreshCw size={14} /></Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/finance/journal/${(r as any).id}`)}
        emptyMessage="尚無傳票資料"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>新增傳票</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">傳票日期 *</label>
                <Input type="date" {...register('jeDate')} />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <label className="text-sm font-medium text-foreground">說明 *</label>
                <Input placeholder="傳票說明" {...register('description')} />
              </div>
            </div>

            {/* Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">分錄明細</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ lineNo: fields.length + 1, debitAccountId: '', creditAccountId: '', amount: 0, description: '' })}
                >
                  <Plus size={14} /> 新增行
                </Button>
              </div>

              <div className="rounded-lg border border-border/50 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {['序', '借方科目代碼', '貸方科目代碼', '金額', '說明', ''].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => (
                      <tr key={field.id} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 text-muted-foreground text-xs w-8">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <Input
                            placeholder="借方科目代碼"
                            className="h-8 text-xs"
                            {...register(`lines.${idx}.debitAccountId`)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            placeholder="貸方科目代碼"
                            className="h-8 text-xs"
                            {...register(`lines.${idx}.creditAccountId`)}
                          />
                        </td>
                        <td className="px-2 py-1.5 w-32">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            className="h-8 text-xs"
                            {...register(`lines.${idx}.amount`)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            placeholder="說明"
                            className="h-8 text-xs"
                            {...register(`lines.${idx}.description`)}
                          />
                        </td>
                        <td className="px-2 py-1.5 w-8">
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(idx)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end gap-6 text-sm px-2">
                <span className="text-muted-foreground">借方合計：<span className="font-semibold text-foreground">{formatCurrency(totalDebit)}</span></span>
                <span className="text-muted-foreground">貸方合計：<span className="font-semibold text-foreground">{formatCurrency(totalCredit)}</span></span>
                {!balanced && (
                  <span className="text-destructive font-semibold">借貸不平衡</span>
                )}
              </div>
            </div>

            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '儲存中...' : '建立傳票'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
