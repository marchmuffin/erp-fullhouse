'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { crmApi, type CrmActivity } from '@/lib/api/crm';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDateTime } from '@/lib/utils';

const TYPE_MAP: Record<string, { label: string; variant: any }> = {
  call: { label: '電話', variant: 'info' },
  email: { label: 'Email', variant: 'secondary' },
  meeting: { label: '會議', variant: 'warning' },
  note: { label: '備註', variant: 'outline' },
  task: { label: '任務', variant: 'success' },
};

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  planned: { label: '計畫中', variant: 'secondary' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'outline' },
};

const TYPE_TABS = [
  { value: '', label: '全部' },
  { value: 'call', label: '電話' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: '會議' },
  { value: 'note', label: '備註' },
  { value: 'task', label: '任務' },
];

const createActivitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  subject: z.string().min(1, '必填'),
  description: z.string().optional(),
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  scheduledAt: z.string().optional(),
});

type CreateForm = z.infer<typeof createActivitySchema>;

export default function ActivitiesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-activities', page, typeFilter],
    queryFn: () => crmApi.activities.list({ page, perPage: 20, type: typeFilter || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => crmApi.activities.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-activities'] });
      setShowCreate(false);
      reset();
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => crmApi.activities.complete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-activities'] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createActivitySchema),
    defaultValues: { type: 'call' },
  });

  const COLUMNS: Column<CrmActivity>[] = [
    {
      key: 'type', header: '類型', width: 'w-24',
      render: (r) => {
        const m = TYPE_MAP[r.type] ?? { label: r.type, variant: 'secondary' };
        return <Badge variant={m.variant}>{m.label}</Badge>;
      },
    },
    { key: 'subject', header: '主旨' },
    {
      key: 'leadId', header: '潛在客戶', width: 'w-32',
      render: (r: any) => r.lead ? r.lead.name || r.lead.companyName || r.leadId : (r.leadId ? r.leadId.slice(0, 8) + '...' : '-'),
    },
    {
      key: 'opportunityId', header: '機會', width: 'w-32',
      render: (r: any) => r.opportunity ? r.opportunity.title || r.opportunityId : (r.opportunityId ? r.opportunityId.slice(0, 8) + '...' : '-'),
    },
    {
      key: 'scheduledAt', header: '計畫時間', width: 'w-40',
      render: (r) => r.scheduledAt ? formatDateTime(r.scheduledAt) : '-',
    },
    {
      key: 'status', header: '狀態', width: 'w-24',
      render: (r) => {
        const m = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' };
        return <Badge variant={m.variant}>{m.label}</Badge>;
      },
    },
    {
      key: 'id', header: '操作', width: 'w-24',
      render: (r) => r.status === 'planned' ? (
        <div onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs text-green-400 border-green-800 hover:bg-green-900/30"
            onClick={() => completeMutation.mutate(r.id)}
            disabled={completeMutation.isPending}
          >
            完成
          </Button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">活動記錄</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆活動</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['crm-activities'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 新增活動
          </Button>
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="flex gap-2 flex-wrap border-b border-border">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setTypeFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              typeFilter === tab.value
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
        emptyMessage="尚無活動記錄"
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增活動</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">類型</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('type')}
              >
                <option value="call">電話</option>
                <option value="email">Email</option>
                <option value="meeting">會議</option>
                <option value="note">備註</option>
                <option value="task">任務</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">主旨 *</label>
              <Input placeholder="活動主旨" {...register('subject')} />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">描述</label>
              <Input placeholder="活動描述..." {...register('description')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">潛在客戶ID</label>
                <Input placeholder="lead-uuid（選填）" {...register('leadId')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">機會ID</label>
                <Input placeholder="opportunity-uuid（選填）" {...register('opportunityId')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">計畫時間</label>
              <Input type="datetime-local" {...register('scheduledAt')} />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '新增中...' : '新增活動'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
