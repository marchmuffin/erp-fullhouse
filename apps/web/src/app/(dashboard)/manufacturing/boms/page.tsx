'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { manufacturingApi, type Bom } from '@/lib/api/manufacturing';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';

const COLUMNS: Column<Bom>[] = [
  {
    key: 'item',
    header: '料號',
    width: 'w-32',
    render: (r) => (
      <span className="font-mono text-xs text-muted-foreground">{r.item?.code ?? r.itemId}</span>
    ),
  },
  {
    key: 'itemName',
    header: '品名',
    render: (r) => <span className="font-medium text-foreground">{r.item?.name ?? '—'}</span>,
  },
  { key: 'version', header: '版本', width: 'w-24', render: (r) => <span className="font-mono text-xs">{r.version}</span> },
  {
    key: 'lines',
    header: '組件數',
    width: 'w-24',
    render: (r) => `${r.lines?.length ?? 0} 項`,
  },
  {
    key: 'isActive',
    header: '狀態',
    width: 'w-24',
    render: (r) => (
      <Badge variant={r.isActive ? 'success' : 'secondary'}>
        {r.isActive ? '啟用' : '停用'}
      </Badge>
    ),
  },
];

interface CreateBomForm {
  itemId: string;
  version: string;
  description: string;
}

export default function BomsPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateBomForm>({ itemId: '', version: '1.0', description: '' });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['boms-list', page, search],
    queryFn: () => manufacturingApi.boms.list({ page, perPage: 20, search: search || undefined }),
  });

  const createMut = useMutation({
    mutationFn: () => manufacturingApi.boms.create({
      itemId: form.itemId,
      version: form.version,
      description: form.description || undefined,
      isActive: true,
    }),
    onSuccess: (bom) => {
      qc.invalidateQueries({ queryKey: ['boms-list'] });
      setDialogOpen(false);
      setForm({ itemId: '', version: '1.0', description: '' });
      setFormError('');
      router.push(`/manufacturing/boms/${bom.id}`);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const handleSubmit = () => {
    if (!form.itemId.trim()) { setFormError('請填入成品料號ID'); return; }
    if (!form.version.trim()) { setFormError('請填入版本號'); return; }
    setFormError('');
    createMut.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">BOM管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆</p>
        </div>
        <Button onClick={() => { setDialogOpen(true); setFormError(''); }}>
          <Plus size={16} /> 新增BOM
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋料號、品名..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setSearch(searchInput); setPage(1); }
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ['boms-list'] })}
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(r) => router.push(`/manufacturing/boms/${r.id}`)}
        emptyMessage="尚無BOM資料"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增BOM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">成品料號ID <span className="text-destructive">*</span></label>
              <Input
                placeholder="請輸入成品料號ID"
                value={form.itemId}
                onChange={(e) => setForm({ ...form, itemId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">版本 <span className="text-destructive">*</span></label>
              <Input
                placeholder="例：1.0"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">說明</label>
              <Input
                placeholder="BOM說明（選填）"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={createMut.isPending}>
              {createMut.isPending ? '建立中...' : '建立BOM'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
