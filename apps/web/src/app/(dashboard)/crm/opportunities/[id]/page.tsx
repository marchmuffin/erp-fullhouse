'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { crmApi, type CrmActivity } from '@/lib/api/crm';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

const STAGE_MAP: Record<string, { label: string; variant: any }> = {
  prospecting: { label: '開發中', variant: 'secondary' },
  qualification: { label: '資格確認', variant: 'info' },
  proposal: { label: '提案', variant: 'warning' },
  negotiation: { label: '議價', variant: 'warning' },
  closed_won: { label: '成交', variant: 'success' },
  closed_lost: { label: '失敗', variant: 'destructive' },
};

const ACTIVITY_TYPE_MAP: Record<string, { label: string; variant: any }> = {
  call: { label: '電話', variant: 'info' },
  email: { label: 'Email', variant: 'secondary' },
  meeting: { label: '會議', variant: 'warning' },
  note: { label: '備註', variant: 'outline' },
  task: { label: '任務', variant: 'success' },
};

const ACTIVITY_STATUS_MAP: Record<string, { label: string; variant: any }> = {
  planned: { label: '計畫中', variant: 'secondary' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'outline' },
};

const createActivitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  subject: z.string().min(1, '必填'),
  description: z.string().optional(),
  scheduledAt: z.string().optional(),
});

type CreateActivityForm = z.infer<typeof createActivitySchema>;

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showActivity, setShowActivity] = useState(false);

  const { data: opp, isLoading } = useQuery({
    queryKey: ['crm-opportunity-detail', id],
    queryFn: () => crmApi.opportunities.get(id),
    enabled: !!id,
  });

  const closeWonMutation = useMutation({
    mutationFn: () => crmApi.opportunities.closeWon(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-opportunity-detail', id] }),
  });

  const closeLostMutation = useMutation({
    mutationFn: () => crmApi.opportunities.closeLost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-opportunity-detail', id] }),
  });

  const createActivityMutation = useMutation({
    mutationFn: (data: any) => crmApi.activities.create({ ...data, opportunityId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-opportunity-detail', id] });
      setShowActivity(false);
      resetActivity();
    },
  });

  const {
    register: registerActivity,
    handleSubmit: handleActivitySubmit,
    reset: resetActivity,
    formState: { errors: activityErrors },
  } = useForm<CreateActivityForm>({
    resolver: zodResolver(createActivitySchema),
    defaultValues: { type: 'call' },
  });

  const ACTIVITY_COLUMNS: Column<CrmActivity>[] = [
    {
      key: 'type', header: '類型', width: 'w-24',
      render: (r) => {
        const m = ACTIVITY_TYPE_MAP[r.type] ?? { label: r.type, variant: 'secondary' };
        return <Badge variant={m.variant}>{m.label}</Badge>;
      },
    },
    { key: 'subject', header: '主旨' },
    {
      key: 'scheduledAt', header: '計畫時間', width: 'w-40',
      render: (r) => r.scheduledAt ? formatDateTime(r.scheduledAt) : '-',
    },
    {
      key: 'status', header: '狀態', width: 'w-24',
      render: (r) => {
        const m = ACTIVITY_STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' };
        return <Badge variant={m.variant}>{m.label}</Badge>;
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">載入中...</p>
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-muted-foreground">找不到此機會</p>
      </div>
    );
  }

  const stageInfo = STAGE_MAP[opp.stage] ?? { label: opp.stage, variant: 'secondary' };
  const isClosed = opp.stage === 'closed_won' || opp.stage === 'closed_lost';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={14} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{opp.title}</h2>
              <Badge variant={stageInfo.variant}>{stageInfo.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">銷售機會詳情</p>
          </div>
        </div>
        {!isClosed && (
          <div className="flex gap-2">
            <Button
              className="bg-green-700 hover:bg-green-600 text-white"
              onClick={() => closeWonMutation.mutate()}
              disabled={closeWonMutation.isPending}
            >
              成交 ✓
            </Button>
            <Button
              variant="destructive"
              onClick={() => closeLostMutation.mutate()}
              disabled={closeLostMutation.isPending}
            >
              失敗 ✗
            </Button>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">階段</p>
              <Badge variant={stageInfo.variant}>{stageInfo.label}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">成交機率</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{opp.probability}%</span>
                <div className="flex-1 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${opp.probability}%` }}
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">預估金額</p>
              <p className="text-lg font-semibold text-foreground">{formatCurrency(opp.value)}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">預計關閉日</p>
              <p className="text-sm text-foreground">{opp.expectedClose ? formatDate(opp.expectedClose) : '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">負責人</p>
              <p className="text-sm text-foreground">{opp.assignedTo ?? '-'}</p>
            </div>
            {opp.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">備註</p>
                <p className="text-sm text-foreground">{opp.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-foreground">活動記錄</h3>
          <Button size="sm" variant="outline" onClick={() => setShowActivity(true)}>
            <Plus size={14} /> 新增活動
          </Button>
        </div>
        <DataTable
          columns={ACTIVITY_COLUMNS}
          data={((opp.activities ?? []) as any)}
          loading={false}
          emptyMessage="尚無活動記錄"
        />
      </div>

      {/* Create Activity Dialog */}
      <Dialog open={showActivity} onOpenChange={setShowActivity}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增活動</DialogTitle></DialogHeader>
          <form onSubmit={handleActivitySubmit((d) => createActivityMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">類型</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...registerActivity('type')}
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
              <Input placeholder="活動主旨" {...registerActivity('subject')} />
              {activityErrors.subject && <p className="text-xs text-destructive">{activityErrors.subject.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">描述</label>
              <Input placeholder="活動描述..." {...registerActivity('description')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">計畫時間</label>
              <Input type="datetime-local" {...registerActivity('scheduledAt')} />
            </div>
            {createActivityMutation.error && (
              <p className="text-sm text-destructive">{(createActivityMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowActivity(false)}>取消</Button>
              <Button type="submit" disabled={createActivityMutation.isPending}>
                {createActivityMutation.isPending ? '新增中...' : '新增活動'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
