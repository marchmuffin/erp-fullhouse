'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { financeApi, type Account } from '@/lib/api/finance';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const TYPE_CONFIG: Record<string, { label: string; variant: any }> = {
  asset:     { label: '資產', variant: 'info' },
  liability: { label: '負債', variant: 'warning' },
  equity:    { label: '權益', variant: 'secondary' },
  revenue:   { label: '收入', variant: 'success' },
  expense:   { label: '費用', variant: 'destructive' },
};

const TYPE_TABS = [
  { value: '', label: '全部' },
  { value: 'asset', label: '資產' },
  { value: 'liability', label: '負債' },
  { value: 'equity', label: '權益' },
  { value: 'revenue', label: '收入' },
  { value: 'expense', label: '費用' },
];

const COLUMNS: Column<Account>[] = [
  { key: 'code', header: '科目代碼', width: 'w-32' },
  { key: 'name', header: '科目名稱' },
  {
    key: 'type', header: '類型', width: 'w-24',
    render: (r) => {
      const cfg = TYPE_CONFIG[r.type] ?? { label: r.type, variant: 'outline' };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
  { key: 'category', header: '類別', width: 'w-32', render: (r) => r.category ?? '-' },
  {
    key: 'isActive', header: '狀態', width: 'w-20',
    render: (r) => <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? '啟用' : '停用'}</Badge>,
  },
];

const schema = z.object({
  code:     z.string().min(1, '必填').max(20),
  name:     z.string().min(1, '必填').max(200),
  type:     z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  category: z.string().optional(),
  notes:    z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function AccountsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', page, search, typeFilter],
    queryFn: () => financeApi.accounts.list({ page, perPage: 20, search: search || undefined, type: typeFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (d: FormData) => financeApi.accounts.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'asset' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">會計科目</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta.total ?? 0} 個科目</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> 新增科目</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋代碼、名稱..."
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
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['accounts'] })}><RefreshCw size={14} /></Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        emptyMessage="尚無科目資料"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增科目</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">科目代碼 *</label>
                <Input placeholder="1101" {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">類型 *</label>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('type')}
                >
                  <option value="asset">資產</option>
                  <option value="liability">負債</option>
                  <option value="equity">權益</option>
                  <option value="revenue">收入</option>
                  <option value="expense">費用</option>
                </select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">科目名稱 *</label>
              <Input placeholder="現金及約當現金" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">類別</label>
              <Input placeholder="流動資產" {...register('category')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="備註說明" {...register('notes')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '儲存中...' : '建立科目'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
