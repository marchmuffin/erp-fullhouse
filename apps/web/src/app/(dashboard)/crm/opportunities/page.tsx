'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { crmApi, type Opportunity } from '@/lib/api/crm';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency, formatDate } from '@/lib/utils';

const STAGE_MAP: Record<string, { label: string; variant: any }> = {
  prospecting: { label: '開發中', variant: 'secondary' },
  qualification: { label: '資格確認', variant: 'info' },
  proposal: { label: '提案', variant: 'warning' },
  negotiation: { label: '議價', variant: 'warning' },
  closed_won: { label: '成交', variant: 'success' },
  closed_lost: { label: '失敗', variant: 'destructive' },
};

const STAGE_TABS = [
  { value: '', label: '全部' },
  { value: 'prospecting', label: '開發中' },
  { value: 'qualification', label: '資格確認' },
  { value: 'proposal', label: '提案' },
  { value: 'negotiation', label: '議價' },
  { value: 'closed_won', label: '成交' },
  { value: 'closed_lost', label: '失敗' },
];

const createOpportunitySchema = z.object({
  title: z.string().min(1, '必填'),
  leadId: z.string().optional(),
  stage: z.enum(['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  probability: z.coerce.number().min(0).max(100),
  value: z.coerce.number().min(0),
  expectedClose: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
});

type CreateForm = z.infer<typeof createOpportunitySchema>;

const COLUMNS: Column<Opportunity>[] = [
  { key: 'title', header: '標題' },
  {
    key: 'leadId', header: '潛在客戶', width: 'w-32',
    render: (r) => (r.lead?.name ?? r.leadId ?? '-'),
  },
  {
    key: 'stage', header: '階段', width: 'w-28',
    render: (r) => {
      const m = STAGE_MAP[r.stage] ?? { label: r.stage, variant: 'secondary' };
      return <Badge variant={m.variant}>{m.label}</Badge>;
    },
  },
  {
    key: 'probability', header: '成交機率', width: 'w-36',
    render: (r) => (
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">{r.probability}%</span>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full bg-primary"
            style={{ width: `${r.probability}%` }}
          />
        </div>
      </div>
    ),
  },
  {
    key: 'value', header: '預估金額', width: 'w-36',
    render: (r) => formatCurrency(r.value),
  },
  {
    key: 'expectedClose', header: '預計關閉日', width: 'w-32',
    render: (r) => r.expectedClose ? formatDate(r.expectedClose) : '-',
  },
];

export default function OpportunitiesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [stageFilter, setStageFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-opportunities', page, stageFilter],
    queryFn: () => crmApi.opportunities.list({ page, perPage: 20, stage: stageFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => crmApi.opportunities.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-opportunities'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createOpportunitySchema),
    defaultValues: { stage: 'prospecting', probability: 50, value: 0 },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">銷售機會</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆機會</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['crm-opportunities'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 新增機會
          </Button>
        </div>
      </div>

      {/* Stage filter tabs */}
      <div className="flex gap-2 flex-wrap border-b border-border">
        {STAGE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStageFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              stageFilter === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/crm/opportunities/${row.id}`)}
        emptyMessage="尚無銷售機會資料"
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增機會</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">標題 *</label>
              <Input placeholder="機會標題" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">潛在客戶ID</label>
              <Input placeholder="lead-uuid（選填）" {...register('leadId')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">階段</label>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('stage')}
                >
                  <option value="prospecting">開發中</option>
                  <option value="qualification">資格確認</option>
                  <option value="proposal">提案</option>
                  <option value="negotiation">議價</option>
                  <option value="closed_won">成交</option>
                  <option value="closed_lost">失敗</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">成交機率 (0-100)</label>
                <Input type="number" min="0" max="100" {...register('probability')} />
                {errors.probability && <p className="text-xs text-destructive">{errors.probability.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">預估金額</label>
                <Input type="number" min="0" placeholder="0" {...register('value')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">預計關閉日</label>
                <Input type="date" {...register('expectedClose')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">負責人</label>
              <Input placeholder="負責人" {...register('assignedTo')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input placeholder="備註..." {...register('notes')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '儲存中...' : '建立機會'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
