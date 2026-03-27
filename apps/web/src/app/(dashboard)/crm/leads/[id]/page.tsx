'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, Building2, Plus } from 'lucide-react';
import { crmApi } from '@/lib/api/crm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDateTime } from '@/lib/utils';

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
  disqualified: '已取消資格',
};

const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  call: '電話', email: 'Email', meeting: '會議', note: '備註', task: '任務',
};

const ACTIVITY_STATUS_VARIANT: Record<string, any> = {
  planned: 'secondary', completed: 'success', cancelled: 'outline',
};

const activitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note', 'task']),
  subject: z.string().min(1, '必填'),
  description: z.string().optional(),
  scheduledAt: z.string().optional(),
});

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showDisqualify, setShowDisqualify] = useState(false);
  const [disqualifyReason, setDisqualifyReason] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['lead-detail', id] });

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead-detail', id],
    queryFn: () => crmApi.leads.get(id),
  });

  const contactedMut = useMutation({
    mutationFn: () => crmApi.leads.update(id, { status: 'contacted' }),
    onSuccess: invalidate,
  });

  const qualifyMut = useMutation({
    mutationFn: () => crmApi.leads.qualify(id),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['opportunities'] });
    },
  });

  const disqualifyMut = useMutation({
    mutationFn: () => crmApi.leads.disqualify(id, disqualifyReason),
    onSuccess: () => { invalidate(); setShowDisqualify(false); },
  });

  const addActivityMut = useMutation({
    mutationFn: (d: any) => crmApi.activities.create({ ...d, leadId: id }),
    onSuccess: () => { invalidate(); setShowAddActivity(false); actReset(); },
  });

  const { register: actReg, handleSubmit: actSubmit, reset: actReset, formState: { errors: actErrors } } =
    useForm<z.infer<typeof activitySchema>>({
      resolver: zodResolver(activitySchema),
      defaultValues: { type: 'call' },
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!lead) return null;

  const canQualify = lead.status !== 'qualified' && lead.status !== 'disqualified';
  const canDisqualify = lead.status !== 'disqualified';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{lead.name}</h2>
              <Badge variant={STATUS_VARIANT[lead.status] ?? 'outline'}>
                {STATUS_LABEL[lead.status] ?? lead.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lead.company ?? '無公司資料'} · 建立於 {formatDateTime(lead.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {lead.status === 'new' && (
            <Button size="sm" variant="outline" onClick={() => contactedMut.mutate()} disabled={contactedMut.isPending}>
              標記已聯繫
            </Button>
          )}
          {canQualify && (
            <Button size="sm" onClick={() => qualifyMut.mutate()} disabled={qualifyMut.isPending}>
              {qualifyMut.isPending ? '處理中...' : '轉換為商機'}
            </Button>
          )}
          {lead.status === 'qualified' && (
            <span className="text-sm text-emerald-400 self-center">轉換為機會已完成</span>
          )}
          {canDisqualify && (
            <Button size="sm" variant="destructive" onClick={() => setShowDisqualify(true)}>
              取消資格
            </Button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="glass rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-3">聯絡資訊</h3>
          <dl className="space-y-2 text-sm">
            {lead.company && (
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-muted-foreground shrink-0" />
                <span>{lead.company}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-muted-foreground shrink-0" />
                <span>{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-muted-foreground shrink-0" />
                <span>{lead.phone}</span>
              </div>
            )}
            {!lead.company && !lead.email && !lead.phone && (
              <p className="text-muted-foreground">無聯絡資訊</p>
            )}
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-3">開發資訊</h3>
          <dl className="space-y-2 text-sm">
            {lead.source && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">來源</dt>
                <dd>{lead.source}</dd>
              </div>
            )}
            {lead.estimatedValue != null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">預估金額</dt>
                <dd className="font-medium">TWD {Number(lead.estimatedValue).toLocaleString()}</dd>
              </div>
            )}
            {lead.assignedTo && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">負責人</dt>
                <dd>{lead.assignedTo}</dd>
              </div>
            )}
          </dl>
        </div>
        {lead.notes && (
          <div className="sm:col-span-2">
            <h3 className="text-sm font-semibold mb-2">備註</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
          </div>
        )}
      </div>

      {/* Linked opportunities */}
      {(lead.opportunities?.length ?? 0) > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">關聯商機</h3>
          <div className="space-y-2">
            {lead.opportunities?.map((opp) => (
              <div
                key={opp.id}
                className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 cursor-pointer hover:text-primary transition-colors"
                onClick={() => router.push(`/crm/opportunities/${opp.id}`)}
              >
                <span className="text-sm font-medium">{opp.title}</span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">TWD {Number(opp.value).toLocaleString()}</span>
                  <Badge variant="secondary">{opp.stage}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">活動記錄</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddActivity(true)}>
            <Plus size={14} /> 新增活動
          </Button>
        </div>
        {(lead.activities?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">尚無活動記錄</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['類型', '主旨', '計畫時間', '狀態'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lead.activities?.map((act) => (
                <tr key={act.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2.5">
                    <Badge variant="outline">{ACTIVITY_TYPE_LABEL[act.type] ?? act.type}</Badge>
                  </td>
                  <td className="px-3 py-2.5">{act.subject}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {act.scheduledAt ? formatDateTime(act.scheduledAt) : '-'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={ACTIVITY_STATUS_VARIANT[act.status] ?? 'outline'}>
                      {act.status === 'planned' ? '計畫中' : act.status === 'completed' ? '已完成' : '已取消'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add activity dialog */}
      <Dialog open={showAddActivity} onOpenChange={setShowAddActivity}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增活動</DialogTitle></DialogHeader>
          <form onSubmit={actSubmit((d) => addActivityMut.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">類型 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...actReg('type')}
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
              <Input placeholder="首次電訪" {...actReg('subject')} />
              {actErrors.subject && <p className="text-xs text-destructive">{actErrors.subject.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">說明</label>
              <Input placeholder="活動說明..." {...actReg('description')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">計畫時間</label>
              <Input type="datetime-local" {...actReg('scheduledAt')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddActivity(false)}>取消</Button>
              <Button type="submit" disabled={addActivityMut.isPending}>
                {addActivityMut.isPending ? '儲存中...' : '新增活動'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Disqualify dialog */}
      <Dialog open={showDisqualify} onOpenChange={setShowDisqualify}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>取消資格</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">原因</label>
              <Input
                placeholder="請輸入取消資格原因..."
                value={disqualifyReason}
                onChange={(e) => setDisqualifyReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDisqualify(false)}>取消</Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => disqualifyMut.mutate()}
                disabled={disqualifyMut.isPending}
              >
                {disqualifyMut.isPending ? '處理中...' : '確認取消資格'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
