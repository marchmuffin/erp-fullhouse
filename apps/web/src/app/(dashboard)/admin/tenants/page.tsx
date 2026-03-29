'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, RefreshCw, Settings2 } from 'lucide-react';
import { adminApi, type AdminTenant } from '@/lib/api/admin';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatDate } from '@/lib/utils';

const ALL_MODULES = [
  { key: 'sales',         label: '銷售管理' },
  { key: 'procurement',   label: '採購管理' },
  { key: 'inventory',     label: '庫存管理' },
  { key: 'manufacturing', label: '生產管理' },
  { key: 'finance',       label: '財務管理' },
  { key: 'hr',            label: '人力資源' },
  { key: 'crm',           label: '客戶關係' },
  { key: 'quality',       label: '品質管理' },
  { key: 'bi',            label: '商業智能' },
  { key: 'bpm',           label: '流程管理' },
  { key: 'pos',           label: 'POS 銷售' },
];

const PLAN_DEFAULTS: Record<string, string[]> = {
  starter:      ['sales', 'procurement', 'inventory'],
  professional: ['sales', 'procurement', 'inventory', 'finance', 'hr', 'crm', 'quality'],
  enterprise:   ['sales', 'procurement', 'inventory', 'manufacturing', 'finance', 'hr', 'crm', 'quality', 'bi', 'bpm', 'pos'],
  custom:       [],
};

const PLAN_MAX_USERS: Record<string, number> = {
  starter: 10, professional: 50, enterprise: 999, custom: 10,
};

const PLAN_MAP: Record<string, { label: string; variant: any }> = {
  starter:      { label: 'Starter',      variant: 'secondary' },
  professional: { label: 'Professional', variant: 'info' },
  enterprise:   { label: 'Enterprise',   variant: 'success' },
  custom:       { label: 'Custom',       variant: 'warning' },
};

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  trial:     { label: '試用中', variant: 'warning' },
  active:    { label: '啟用',   variant: 'success' },
  suspended: { label: '暫停',   variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'outline' },
};

export default function AdminTenantsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [newTenant, setNewTenant] = useState({
    code: '', name: '', contactEmail: '', plan: 'starter', maxUsers: 10,
    adminEmail: '', adminPassword: '', adminName: '',
  });
  const [createError, setCreateError] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  // Edit modal state
  const [editTenant, setEditTenant] = useState<AdminTenant | null>(null);
  const [editPlan, setEditPlan] = useState('starter');
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editMaxUsers, setEditMaxUsers] = useState(10);
  const [editError, setEditError] = useState('');

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
      setNewTenant({ code: '', name: '', contactEmail: '', plan: 'starter', maxUsers: 10, adminEmail: '', adminPassword: '', adminName: '' });
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

  const updateModulesMut = useMutation({
    mutationFn: () =>
      adminApi.tenants.updateModules(editTenant!.id, editModules, editMaxUsers, editPlan),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-tenants'] });
      setEditTenant(null);
      setEditError('');
    },
    onError: (e: Error) => setEditError(e.message),
  });

  function openEdit(tenant: AdminTenant) {
    setEditTenant(tenant);
    setEditPlan(tenant.plan ?? 'starter');
    setEditModules(tenant.modules ?? []);
    setEditMaxUsers(tenant.maxUsers ?? 10);
    setEditError('');
  }

  function handleEditPlanChange(plan: string) {
    setEditPlan(plan);
    // Auto-apply plan defaults (for non-custom plans)
    if (plan !== 'custom') {
      setEditModules(PLAN_DEFAULTS[plan] ?? []);
      setEditMaxUsers(PLAN_MAX_USERS[plan] ?? 10);
    }
  }

  function toggleModule(key: string) {
    setEditModules((prev) =>
      prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key],
    );
  }

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
      render: (r) => (
        <span className="text-sm">
          {r._count?.users ?? 0}
          <span className="text-muted-foreground text-xs"> / {r.maxUsers >= 999 ? '∞' : r.maxUsers}</span>
        </span>
      ),
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
      key: 'id', header: '操作', width: 'w-40',
      render: (r) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
            onClick={() => openEdit(r)}>
            <Settings2 size={11} className="mr-1" />模組
          </Button>
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

      {/* Create Tenant Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增租戶</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">租戶代碼 *</label>
              <Input placeholder="e.g. ACME001" value={newTenant.code}
                onChange={e => setNewTenant({ ...newTenant, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} />
              <p className="text-xs text-muted-foreground">大寫英數字與底線，最多 20 字元</p>
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
                <option value="starter">Starter（入門版，10 位用戶）</option>
                <option value="professional">Professional（專業版，50 位用戶）</option>
                <option value="enterprise">Enterprise（企業版，不限用戶）</option>
                <option value="custom">Custom（自訂版）</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">最大用戶數</label>
              <Input type="number" placeholder="10" value={newTenant.maxUsers}
                onChange={e => setNewTenant({ ...newTenant, maxUsers: parseInt(e.target.value) || 10 })} />
            </div>
            <div className="border-t border-border pt-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">初始管理員帳號</p>
              <label className="text-sm font-medium text-foreground">管理員名稱</label>
              <Input placeholder="系統管理員" value={newTenant.adminName}
                onChange={e => setNewTenant({ ...newTenant, adminName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">管理員 Email *</label>
              <Input type="email" placeholder="admin@company.com" value={newTenant.adminEmail}
                onChange={e => setNewTenant({ ...newTenant, adminEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">管理員密碼 *</label>
              <Input type="password" placeholder="至少 8 個字元" value={newTenant.adminPassword}
                onChange={e => setNewTenant({ ...newTenant, adminPassword: e.target.value })} />
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

      {/* Edit Modules Dialog */}
      <Dialog open={!!editTenant} onOpenChange={(open) => !open && setEditTenant(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              編輯模組與方案
              {editTenant && (
                <span className="ml-2 font-mono text-sm text-muted-foreground font-normal">
                  {editTenant.code}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Plan selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">方案</label>
              <select
                value={editPlan}
                onChange={e => handleEditPlanChange(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="starter">Starter（入門版）</option>
                <option value="professional">Professional（專業版）</option>
                <option value="enterprise">Enterprise（企業版）</option>
                <option value="custom">Custom（自訂版）</option>
              </select>
              <p className="text-xs text-muted-foreground">
                選擇方案後會自動套用預設模組，您仍可手動調整。
              </p>
            </div>

            {/* Max users */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">最大用戶數</label>
              <Input
                type="number"
                min={1}
                max={9999}
                value={editMaxUsers}
                onChange={e => setEditMaxUsers(parseInt(e.target.value) || 1)}
                className="w-32"
              />
            </div>

            {/* Module checkboxes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">啟用模組</label>
                <span className="text-xs text-muted-foreground">{editModules.length} / {ALL_MODULES.length} 個模組</span>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 bg-muted/20">
                {ALL_MODULES.map((mod) => {
                  const checked = editModules.includes(mod.key);
                  return (
                    <label
                      key={mod.key}
                      className="flex items-center gap-2.5 cursor-pointer group py-0.5"
                    >
                      <div
                        onClick={() => toggleModule(mod.key)}
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                          checked
                            ? 'bg-primary border-primary'
                            : 'border-border bg-background group-hover:border-primary/50'
                        }`}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span
                        onClick={() => toggleModule(mod.key)}
                        className={`text-sm transition-colors ${checked ? 'text-foreground' : 'text-muted-foreground'}`}
                      >
                        {mod.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTenant(null)}>取消</Button>
            <Button onClick={() => updateModulesMut.mutate()} disabled={updateModulesMut.isPending}>
              {updateModulesMut.isPending ? '儲存中...' : '儲存變更'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
