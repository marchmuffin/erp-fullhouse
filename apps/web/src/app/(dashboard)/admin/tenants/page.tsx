'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, RefreshCw } from 'lucide-react';
import { adminApi, type AdminTenant } from '@/lib/api/admin';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';

const PLAN_MAP: Record<string, { label: string; variant: any }> = {
  starter: { label: 'Starter', variant: 'secondary' },
  professional: { label: 'Professional', variant: 'info' },
  enterprise: { label: 'Enterprise', variant: 'success' },
  custom: { label: 'Custom', variant: 'warning' },
};

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  trial: { label: '試用中', variant: 'warning' },
  active: { label: '啟用', variant: 'success' },
  suspended: { label: '暫停', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'outline' },
};

export default function AdminTenantsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [newTenant, setNewTenant] = useState({
    code: '',
    name: '',
    contactEmail: '',
    plan: 'starter',
    maxUsers: 10,
  });
  const [createError, setCreateError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  const queryKey = ['admin-tenants', page];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => adminApi.tenants.list({ page, perPage: 20 }),
  });

  const tenants: AdminTenant[] = Array.isArray(data) ? data : (data?.data ?? []);
  const meta = data?.meta;
  const total = meta?.total ?? tenants.length;

  const createMut = useMutation({
    mutationFn: () => adminApi.tenants.create(newTenant),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tenants'] });
      setShowCreate(false);
      setNewTenant({ code: '', name: '', contactEmail: '', plan: 'starter', maxUsers: 10 });
      setCreateError('');
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const suspendMut = useMutation({
    mutationFn: (id: string) => adminApi.tenants.suspend(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenants'] }),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => adminApi.tenants.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-tenants'] }),
  });

  async function handleExportCsv() {
    setExportLoading(true);
    try {
      const blob = await adminApi.tenants.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tenants.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setExportLoading(false);
    }
  }

  const COLUMNS: Column<AdminTenant>[] = [
    {
      key: 'code', header: '租戶代碼', width: 'w-28',
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code}</span>,
    },
    {
      key: 'name', header: '名稱',
      render: (r) => (
        <div>
          <p className="font-medium text-sm text-foreground">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.contactEmail}</p>
        </div>
      ),
    },
    {
      key: 'plan', header: '方案', width: 'w-28',
      render: (r) => {
        const cfg = PLAN_MAP[r.plan] ?? { label: r.plan, variant: 'secondary' };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: '_count', header: '用戶數', width: 'w-20',
      render: (r) => <span className="text-sm">{r._count?.users ?? '—'}</span>,
    },
    {
      key: 'status', header: '狀態', width: 'w-24',
      render: (r) => {
        const cfg = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'createdAt', header: '建立時間', width: 'w-28',
      render: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'id', header: '操作', width: 'w-32',
      render: (r) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          {r.status === 'active' || r.status === 'trial' ? (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-destructive border-destructive/40"
              onClick={() => suspendMut.mutate(r.id)} disabled={suspendMut.isPending}>
              暫停
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-green-400 border-green-800"
              onClick={() => activateMut.mutate(r.id)} disabled={activateMut.isPending}>
              啟用
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">租戶管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {total} 個租戶</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['admin-tenants'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={exportLoading}>
            <Download size={14} /> {exportLoading ? '匯出中...' : '匯出 CSV'}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 新增租戶
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={tenants}
        meta={meta}
        loading={isLoading}
        onPageChange={setPage}
        emptyMessage="尚無租戶資料"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增租戶</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">租戶代碼 *</label>
              <Input placeholder="e.g. acme" value={newTenant.code}
                onChange={e => setNewTenant({ ...newTenant, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">名稱 *</label>
              <Input placeholder="公司名稱" value={newTenant.name}
                onChange={e => setNewTenant({ ...newTenant, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">聯絡 Email *</label>
              <Input type="email" placeholder="contact@company.com" value={newTenant.contactEmail}
                onChange={e => setNewTenant({ ...newTenant, contactEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">方案</label>
              <select
                value={newTenant.plan}
                onChange={e => setNewTenant({ ...newTenant, plan: e.target.value })}
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">最大用戶數</label>
              <Input type="number" placeholder="10" value={newTenant.maxUsers}
                onChange={e => setNewTenant({ ...newTenant, maxUsers: parseInt(e.target.value) || 10 })} />
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? '建立中...' : '建立租戶'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
