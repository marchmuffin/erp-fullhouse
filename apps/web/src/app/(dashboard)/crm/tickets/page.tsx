'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { crmApi } from '@/lib/api/crm';
import type { ServiceTicket } from '@/lib/api/crm';
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
  { value: 'open', label: '待處理' },
  { value: 'in_progress', label: '處理中' },
  { value: 'pending_customer', label: '等待客戶' },
  { value: 'resolved', label: '已解決' },
  { value: 'closed', label: '已關閉' },
];

const STATUS_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'success' | 'outline' | 'destructive'> = {
  open: 'secondary',
  in_progress: 'info',
  pending_customer: 'warning',
  resolved: 'success',
  closed: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
  open: '待處理',
  in_progress: '處理中',
  pending_customer: '等待客戶',
  resolved: '已解決',
  closed: '已關閉',
};

const PRIORITY_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'info',
  high: 'warning',
  urgent: 'destructive',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急',
};

const TYPE_LABEL: Record<string, string> = {
  complaint: '投訴',
  inquiry: '詢問',
  repair: '維修',
  return: '退貨',
  other: '其他',
};

const COLUMNS: Column<ServiceTicket>[] = [
  { key: 'ticketNo', header: '工單編號', width: 'w-32' },
  { key: 'title', header: '標題' },
  {
    key: 'type', header: '類型', width: 'w-20',
    render: (r) => <Badge variant="outline">{TYPE_LABEL[r.type] ?? r.type}</Badge>,
  },
  {
    key: 'priority', header: '優先級', width: 'w-20',
    render: (r) => <Badge variant={PRIORITY_VARIANT[r.priority] ?? 'outline'}>{PRIORITY_LABEL[r.priority] ?? r.priority}</Badge>,
  },
  {
    key: 'status', header: '狀態', width: 'w-28',
    render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>,
  },
  {
    key: 'createdAt', header: '建立時間', width: 'w-40',
    render: (r) => formatDateTime(r.createdAt),
  },
];

const formSchema = z.object({
  title: z.string().min(1, '必填'),
  description: z.string().optional(),
  type: z.enum(['complaint', 'inquiry', 'repair', 'return', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
});

type FormValues = z.infer<typeof formSchema>;

export default function TicketsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeStatus, setActiveStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', page, search, activeStatus],
    queryFn: () =>
      crmApi.tickets.list({ page, perPage: 20, search: search || undefined, status: activeStatus || undefined }),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: 'inquiry', priority: 'medium' },
  });

  const createMut = useMutation({
    mutationFn: (vals: FormValues) => crmApi.tickets.create(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setShowCreate(false);
      reset();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">客服工單</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {data?.meta?.total ?? 0} 筆工單
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={16} className="mr-1" /> 新建工單
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setActiveStatus(tab.value); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeStatus === tab.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋工單..."
            className="pl-8 h-8 text-sm"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setSearch(searchInput); setPage(1); }}>
          <RefreshCw size={14} />
        </Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        loading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/crm/tickets/${row.id}`)}
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建客服工單</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((v) => createMut.mutate(v))} className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">標題 *</label>
              <Input {...register('title')} className="mt-1" />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">說明</label>
              <textarea
                {...register('description')}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">類型</label>
                <select {...register('type')} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="complaint">投訴</option>
                  <option value="inquiry">詢問</option>
                  <option value="repair">維修</option>
                  <option value="return">退貨</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">優先級</label>
                <select {...register('priority')} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">緊急</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowCreate(false); reset(); }}>取消</Button>
              <Button type="submit" size="sm" disabled={isSubmitting || createMut.isPending}>建立</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
