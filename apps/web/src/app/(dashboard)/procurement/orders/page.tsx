'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { procurementApi, type PurchaseOrder } from '@/lib/api/procurement';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending_approval: { label: '待審核', variant: 'warning' },
  approved: { label: '已核准', variant: 'success' },
  partial_received: { label: '部分收貨', variant: 'info' },
  received: { label: '已收貨', variant: 'success' },
  invoiced: { label: '已對帳', variant: 'default' },
  cancelled: { label: '已取消', variant: 'destructive' },
};

const COLUMNS: Column<PurchaseOrder>[] = [
  { key: 'poNo', header: '採購單號', width: 'w-36' },
  { key: 'supplier', header: '供應商', render: (r) => <div><p className="font-medium text-foreground">{r.supplier?.name}</p><p className="text-xs text-muted-foreground">{r.supplier?.code}</p></div> },
  { key: 'status', header: '狀態', width: 'w-28', render: (r) => { const c = STATUS_CONFIG[r.status] ?? { label: r.status, variant: 'outline' }; return <Badge variant={c.variant}>{c.label}</Badge>; } },
  { key: 'orderDate', header: '訂單日期', width: 'w-28', render: (r) => formatDate(r.orderDate) },
  { key: 'total', header: '金額', width: 'w-36', render: (r) => <span className="font-medium">{r.currency} {Number(r.total).toLocaleString()}</span> },
  { key: 'lines', header: '品項數', width: 'w-20', render: (r) => `${r.lines?.length ?? 0} 項` },
];

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['po-list', page, search, statusFilter],
    queryFn: () => procurementApi.orders.list({ page, perPage: 20, search: search || undefined, status: statusFilter || undefined }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">採購訂單</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta.total ?? 0} 筆</p>
        </div>
        <Button onClick={() => router.push('/procurement/orders/new')}><Plus size={16} /> 新增採購單</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="搜尋單號、供應商..." className="pl-9" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }} />
        </div>
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {[{ value: '', label: '全部' }, { value: 'draft', label: '草稿' }, { value: 'pending_approval', label: '待審核' }, { value: 'approved', label: '已核准' }, { value: 'received', label: '已收貨' }].map((t) => (
            <button key={t.value} onClick={() => { setStatusFilter(t.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusFilter === t.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['po-list'] })}><RefreshCw size={14} /></Button>
      </div>

      <DataTable columns={COLUMNS} data={(data?.data as any) ?? []} meta={data?.meta} loading={isLoading} onPageChange={setPage}
        onRowClick={(r) => router.push(`/procurement/orders/${r.id}`)} emptyMessage="尚無採購訂單" />
    </div>
  );
}
