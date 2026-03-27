'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { salesApi, type SalesOrder } from '@/lib/api/sales';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  pending_approval: { label: '待審核', variant: 'warning' },
  approved: { label: '已核准', variant: 'success' },
  processing: { label: '處理中', variant: 'info' },
  partial_shipped: { label: '部分出貨', variant: 'info' },
  shipped: { label: '已出貨', variant: 'success' },
  invoiced: { label: '已開票', variant: 'default' },
  cancelled: { label: '已取消', variant: 'destructive' },
};

const COLUMNS: Column<SalesOrder>[] = [
  { key: 'orderNo', header: '訂單編號', width: 'w-36' },
  {
    key: 'customer',
    header: '客戶',
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.customer?.name}</p>
        <p className="text-xs text-muted-foreground">{row.customer?.code}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: '狀態',
    width: 'w-28',
    render: (row) => {
      const cfg = STATUS_CONFIG[row.status] ?? { label: row.status, variant: 'outline' };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
  {
    key: 'orderDate',
    header: '訂單日期',
    width: 'w-28',
    render: (row) => formatDate(row.orderDate),
  },
  {
    key: 'total',
    header: '金額',
    width: 'w-36',
    render: (row) => (
      <span className="font-medium">
        {row.currency} {Number(row.total).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'lines',
    header: '品項數',
    width: 'w-20',
    render: (row) => `${row.lines?.length ?? 0} 項`,
  },
];

export default function SalesOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', page, search, statusFilter],
    queryFn: () =>
      salesApi.orders.list({
        page,
        perPage: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">銷售訂單</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {data?.meta?.total ?? 0} 筆訂單
          </p>
        </div>
        <Button onClick={() => router.push('/sales/orders/new')}>
          <Plus size={16} /> 新增訂單
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋訂單編號、客戶名稱..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setSearch(searchInput); setPage(1); }
            }}
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
          {[
            { value: '', label: '全部' },
            { value: 'draft', label: '草稿' },
            { value: 'pending_approval', label: '待審核' },
            { value: 'approved', label: '已核准' },
            { value: 'shipped', label: '已出貨' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['sales-orders'] })}
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/sales/orders/${row.id}`)}
        emptyMessage="尚無銷售訂單，請點擊「新增訂單」建立"
      />
    </div>
  );
}
