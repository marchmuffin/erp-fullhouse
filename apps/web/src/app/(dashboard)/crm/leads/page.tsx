'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { crmApi } from '@/lib/api/crm';
import type { Lead } from '@/lib/api/crm';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDateTime } from '@/lib/utils';

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'new', label: '新建' },
  { value: 'contacted', label: '已聯繫' },
  { value: 'qualified', label: '已確認' },
  { value: 'disqualified', label: '已取消' },
];

const STATUS_VARIANT: Record<string, any> = {
  new: 'secondary',
  contacted: 'info',
  qualified: 'success',
  disqualified: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  new: '新建',
  contacted: '已聯繫',
  qualified: '已確認',
  disqualified: '已取消',
};

const SOURCE_LABEL: Record<string, string> = {
  website: '官網',
  referral: '推薦',
  cold_call: '電訪',
  exhibition: '展覽',
  social_media: '社群',
};

const COLUMNS: Column<Lead>[] = [
  { key: 'name', header: '姓名' },
  { key: 'company', header: '公司', render: (r) => r.company ?? '-' },
  {
    key: 'source', header: '來源', width: 'w-24',
    render: (r) => r.source ? (
      <Badge variant="outline">{SOURCE_LABEL[r.source] ?? r.source}</Badge>
    ) : '-',
  },
  {
    key: 'estimatedValue', header: '預估金額', width: 'w-36',
    render: (r) => r.estimatedValue != null
      ? `TWD ${Number(r.estimatedValue).toLocaleString()}`
      : '-',
  },
  {
    key: 'status', header: '狀態', width: 'w-24',
    render: (r) => (
      <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>
        {STATUS_LABEL[r.status] ?? r.status}
      </Badge>
    ),
  },
  {
    key: 'createdAt', header: '建立時間', width: 'w-40',
    render: (r) => formatDateTime(r.createdAt),
  },
];

const schema = z.object({
  name: z.string().min(1, '必填'),
  company: z.string().optional(),
  email: z.string().email('格式不正確').optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.enum(['website', 'referral', 'cold_call', 'exhibition', 'social_media']).optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export default function LeadsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search, activeStatus],
    queryFn: () =>
      crmApi.leads.list({
        page,
        perPage: 20,
        search: search || undefined,
        status: activeStatus || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => crmApi.leads.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">潛在客戶</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} /> 新增潛在客戶</Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setActiveStatus(tab.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeStatus === tab.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + refresh */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋姓名、公司、Email..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
          />
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['leads'] })}>
          <RefreshCw size={14} />
        </Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/crm/leads/${row.id}`)}
        emptyMessage="尚無潛在客戶資料"
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增潛在客戶</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">姓名 *</label>
                <Input placeholder="王大明" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">公司</label>
                <Input placeholder="ABC Corp" {...register('company')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input placeholder="wang@abc.com" {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">電話</label>
                <Input placeholder="+886-2-12345678" {...register('phone')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">來源</label>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('source')}
                >
                  <option value="">— 選擇來源 —</option>
                  <option value="website">官網</option>
                  <option value="referral">推薦</option>
                  <option value="cold_call">電訪</option>
                  <option value="exhibition">展覽</option>
                  <option value="social_media">社群媒體</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">預估金額 (TWD)</label>
                <Input type="number" placeholder="500000" {...register('estimatedValue')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="備註說明..." {...register('notes')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '儲存中...' : '建立潛在客戶'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
