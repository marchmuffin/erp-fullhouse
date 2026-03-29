'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, PackageCheck } from 'lucide-react';
import { procurementApi, type PurchaseOrder } from '@/lib/api/procurement';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  approved:         { label: '已核准', variant: 'success' },
  partial_received: { label: '部分收貨', variant: 'warning' },
  received:         { label: '已收貨', variant: 'success' },
};

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'approved', label: '待收貨' },
  { value: 'partial_received', label: '部分收貨' },
  { value: 'received', label: '已收貨' },
];

const COLUMNS: Column<PurchaseOrder>[] = [
  { key: 'poNo', header: '採購單號', width: 'w-36' },
  {
    key: 'supplier',
    header: '供應商',
    render: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.supplier?.name}</p>
        <p className="text-xs text-muted-foreground">{row.supplier?.code}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: '收貨狀態',
    width: 'w-28',
    render: (row) => {
      const cfg = STATUS_CONFIG[row.status] ?? { label: row.status, variant: 'outline' };
      return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
    },
  },
  {
    key: 'expectedDate',
    header: '預計到貨日',
    width: 'w-28',
    render: (row) => row.expectedDate ? formatDate(row.expectedDate) : '—',
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

export default function GoodsReceiptsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeStatus, setActiveStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['goods-receipts-queue', page, search, activeStatus],
    queryFn: () =>
      procurementApi.orders.list({
        page,
        perPage: 20,
        search: search || undefined,
        status: activeStatus || undefined,
      }),
  });

  // When no filter, show only receipt-relevant statuses
  const displayData = activeStatus
    ? data?.data ?? []
    : (data?.data ?? []).filter((o) =>
        ['approved', 'partial_received', 'received'].includes(o.status),
      );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <PackageCheck size={20} className="text-primary" />
            收貨管理
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {displayData.length} 筆待處理收貨
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
          placeholder="搜尋採購單號、供應商..."
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
        onRowClick={(row) => router.push(`/procurement/orders/${row.id}`)}
        emptyMessage="目前沒有待收貨訂單"
      />
    </div>
  );
}
