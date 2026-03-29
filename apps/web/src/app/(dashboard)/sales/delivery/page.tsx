'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Truck } from 'lucide-react';
import { salesApi, type SalesOrder } from '@/lib/api/sales';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  approved:       { label: '已核准', variant: 'success' },
  processing:     { label: '處理中', variant: 'info' },
  partial_shipped:{ label: '部分出貨', variant: 'warning' },
  shipped:        { label: '已出貨', variant: 'success' },
};

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'approved', label: '待出貨' },
  { value: 'processing', label: '處理中' },
  { value: 'partial_shipped', label: '部分出貨' },
  { value: 'shipped', label: '已出貨' },
];

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
    header: '出貨狀態',
    width: 'w-28',
    render: (row) => {
      const cfg = STATUS_CONFIG[row.status] ?? { label: row.status, variant: 'outline' };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
  {
    key: 'requestedDate',
    header: '要求出貨日',
    width: 'w-28',
    render: (row) => row.requestedDate ? formatDate(row.requestedDate) : '—',
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
];

export default function DeliveryPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeStatus, setActiveStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['delivery-orders', page, search, activeStatus],
    queryFn: () =>
      salesApi.orders.list({
        page,
        perPage: 20,
        search: search || undefined,
        status: activeStatus || undefined,
      }),
  });

  // Filter to only delivery-relevant statuses when no filter is selected
  const displayData = activeStatus
    ? data?.data ?? []
    : (data?.data ?? []).filter((o) =>
        ['approved', 'processing', 'partial_shipped', 'shipped'].includes(o.status),
      );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Truck size={20} className="text-primary" />
            出貨管理
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {displayData.length} 筆待處理出貨
          </p>
        </div>
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
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜尋訂單編號、客戶..."
          className="pl-8 h-8 text-sm"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(1); } }}
        />
      </div>

      <DataTable
        columns={COLUMNS}
        data={displayData as any}
        loading={isLoading}
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/sales/orders/${row.id}`)}
        emptyMessage="目前沒有待出貨訂單"
      />
    </div>
  );
}
