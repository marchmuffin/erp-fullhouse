'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Search, ShieldOff, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth.store';
import { formatDateTime } from '@/lib/utils';

function getRoleBadge(user: any) {
  if (user.isSuperAdmin) return <Badge variant="info">系統管理員</Badge>;
  const roles = user.userRoles?.map((ur: any) => ur.role.name) ?? [];
  if (roles.some((r: string) => r.toLowerCase().includes('admin'))) return <Badge variant="warning">租戶管理員</Badge>;
  return <Badge variant="secondary">一般用戶</Badge>;
}

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  active: { label: '啟用', variant: 'success' },
  inactive: { label: '停用', variant: 'secondary' },
  locked: { label: '鎖定', variant: 'destructive' },
  pending_verification: { label: '待驗證', variant: 'warning' },
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.user);
  const isSuperAdmin = currentUser?.isSuperAdmin;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', displayName: '', password: '', roleIds: [] as string[] });
  const [createError, setCreateError] = useState('');

  const queryKey = ['admin-users', page, search, statusFilter, isSuperAdmin];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => isSuperAdmin
      ? adminApi.users.listSystem({ page, perPage: 20, search: search || undefined })
      : adminApi.users.list({ page, perPage: 20, search: search || undefined }),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminApi.users.roles(),
    enabled: showCreate,
  });
  const roles: any[] = Array.isArray(rolesData) ? rolesData : (rolesData?.data ?? []);

  const createMut = useMutation({
    mutationFn: () => adminApi.users.create(newUser),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setShowCreate(false);
      setNewUser({ email: '', displayName: '', password: '', roleIds: [] });
      setCreateError('');
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => adminApi.users.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const activateMut = useMutation({
    mutationFn: (id: string) => adminApi.users.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const resetTwoFaMut = useMutation({
    mutationFn: (id: string) => adminApi.users.resetTwoFa(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.users.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const users: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  const meta = data?.meta;
  const total = meta?.total ?? users.length;

  const filtered = statusFilter ? users.filter((u: any) => u.status === statusFilter) : users;

  const COLUMNS: Column<any>[] = [
    {
      key: 'email', header: '電子郵件',
      render: (r) => (
        <div>
          <p className="font-medium text-sm text-foreground">{r.email}</p>
          {r.tenant && <p className="text-xs text-muted-foreground">{r.tenant.name}</p>}
        </div>
      ),
    },
    { key: 'displayName', header: '顯示名稱', width: 'w-32' },
    { key: 'role', header: '角色', width: 'w-32', render: (r) => getRoleBadge(r) },
    {
      key: 'twoFaEnabled', header: '2FA', width: 'w-20',
      render: (r) => <Badge variant={r.twoFaEnabled ? 'success' : 'secondary'}>{r.twoFaEnabled ? '已啟用' : '未啟用'}</Badge>,
    },
    {
      key: 'status', header: '狀態', width: 'w-20',
      render: (r) => {
        const cfg = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' };
        return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
      },
    },
    {
      key: 'lastLoginAt', header: '最後登入', width: 'w-36',
      render: (r) => r.lastLoginAt ? formatDateTime(r.lastLoginAt) : '—',
    },
    {
      key: 'id', header: '操作', width: 'w-40',
      render: (r) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          {r.status === 'active' ? (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
              onClick={() => deactivateMut.mutate(r.id)} disabled={deactivateMut.isPending}>
              停用
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-green-400 border-green-800"
              onClick={() => activateMut.mutate(r.id)} disabled={activateMut.isPending}>
              啟用
            </Button>
          )}
          {r.twoFaEnabled && (
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs"
              onClick={() => resetTwoFaMut.mutate(r.id)} disabled={resetTwoFaMut.isPending}
              title="重設2FA">
              <ShieldOff size={12} />
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-destructive border-destructive/40"
            onClick={() => { if (window.confirm(`確定要刪除 ${r.email}？`)) deleteMut.mutate(r.id); }}
            disabled={deleteMut.isPending}>
            <Trash2 size={12} />
          </Button>
        </div>
      ),
    },
  ];

  const STATUS_TABS = [
    { value: '', label: '全部' },
    { value: 'active', label: '啟用中' },
    { value: 'inactive', label: '停用' },
    { value: 'locked', label: '鎖定' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">用戶管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {total} 位用戶</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 新增用戶
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋 Email、名稱..."
            className="pl-9"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
          />
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {STATUS_TABS.map(tab => (
          <button key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={COLUMNS}
        data={filtered}
        meta={meta}
        loading={isLoading}
        onPageChange={setPage}
        emptyMessage="尚無用戶資料"
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增用戶</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">電子郵件 *</label>
              <Input placeholder="user@example.com" value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">顯示名稱 *</label>
              <Input placeholder="姓名" value={newUser.displayName}
                onChange={e => setNewUser({ ...newUser, displayName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">密碼 *</label>
              <Input type="password" placeholder="••••••••" value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            {roles.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">角色</label>
                <div className="space-y-1 max-h-32 overflow-y-auto border border-border rounded-md p-2">
                  {roles.map((role: any) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="rounded"
                        checked={newUser.roleIds.includes(role.id)}
                        onChange={e => {
                          const ids = e.target.checked
                            ? [...newUser.roleIds, role.id]
                            : newUser.roleIds.filter(id => id !== role.id);
                          setNewUser({ ...newUser, roleIds: ids });
                        }} />
                      {role.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? '建立中...' : '建立用戶'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
