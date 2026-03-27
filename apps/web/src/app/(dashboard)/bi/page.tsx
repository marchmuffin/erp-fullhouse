'use client';

import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, AlertCircle, DollarSign, Package, Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { biApi } from '@/lib/api/bi';
import { formatCurrency } from '@/lib/utils';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted/30 rounded ${className}`} />;
}

// ── Status colours for pie chart ──────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  draft: '#64748b',
  pending_approval: '#f59e0b',
  approved: '#3b82f6',
  processing: '#6366f1',
  partial_shipped: '#8b5cf6',
  shipped: '#8b5cf6',
  invoiced: '#10b981',
  cancelled: '#ef4444',
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? '#94a3b8';
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
}

function KpiCard({ label, value, icon, iconBg, loading }: KpiCardProps) {
  return (
    <div className="glass rounded-xl p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg shrink-0 ${iconBg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-1 truncate">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p className="text-xl font-bold text-foreground truncate">{value}</p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BiPage() {
  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['bi-summary-sales'],
    queryFn: biApi.summary.sales,
  });

  const { data: procurement, isLoading: procLoading } = useQuery({
    queryKey: ['bi-summary-procurement'],
    queryFn: biApi.summary.procurement,
  });

  const { data: inventory, isLoading: invLoading } = useQuery({
    queryKey: ['bi-summary-inventory'],
    queryFn: biApi.summary.inventory,
  });

  const { data: finance, isLoading: finLoading } = useQuery({
    queryKey: ['bi-summary-finance'],
    queryFn: biApi.summary.finance,
  });

  const { data: hr, isLoading: hrLoading } = useQuery({
    queryKey: ['bi-summary-hr'],
    queryFn: biApi.summary.hr,
  });

  const { data: monthlySales, isLoading: trendLoading } = useQuery({
    queryKey: ['bi-charts-monthly-sales'],
    queryFn: biApi.charts.monthlySales,
  });

  const { data: topCustomers, isLoading: topCustLoading } = useQuery({
    queryKey: ['bi-charts-top-customers'],
    queryFn: biApi.charts.topCustomers,
  });

  const { data: ordersByStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['bi-charts-orders-by-status'],
    queryFn: biApi.charts.ordersByStatus,
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">商業智能儀表板</h2>
        <p className="text-muted-foreground text-sm mt-1">
          跨模組即時 KPI 彙整 — 銷售、採購、庫存、財務、人力資源
        </p>
      </div>

      {/* ── Row 1: KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="本月銷售額"
          value={sales ? formatCurrency(sales.revenueThisMonth) : '—'}
          loading={salesLoading}
          icon={<TrendingUp size={20} className="text-emerald-400" />}
          iconBg="bg-emerald-400/10"
        />
        <KpiCard
          label="本月採購額"
          value={procurement ? formatCurrency(procurement.spendThisMonth) : '—'}
          loading={procLoading}
          icon={<TrendingDown size={20} className="text-red-400" />}
          iconBg="bg-red-400/10"
        />
        <KpiCard
          label="應收帳款"
          value={finance ? formatCurrency(finance.totalAR) : '—'}
          loading={finLoading}
          icon={<AlertCircle size={20} className="text-amber-400" />}
          iconBg="bg-amber-400/10"
        />
        <KpiCard
          label="應付帳款"
          value={finance ? formatCurrency(finance.totalAP) : '—'}
          loading={finLoading}
          icon={<DollarSign size={20} className="text-blue-400" />}
          iconBg="bg-blue-400/10"
        />
        <KpiCard
          label="庫存總價值"
          value={inventory ? formatCurrency(inventory.totalStockValue) : '—'}
          loading={invLoading}
          icon={<Package size={20} className="text-purple-400" />}
          iconBg="bg-purple-400/10"
        />
        <KpiCard
          label="待處理假單"
          value={hr ? hr.pendingLeaves : '—'}
          loading={hrLoading}
          icon={<Users size={20} className="text-yellow-400" />}
          iconBg="bg-yellow-400/10"
        />
      </div>

      {/* ── Row 2: Charts ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart — monthly sales trend */}
        <div className="glass rounded-xl p-6 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">月度銷售趨勢（近 6 個月）</h3>
          {trendLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlySales ?? []} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                      ? `${(v / 1_000).toFixed(0)}K`
                      : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 8,
                    color: '#f1f5f9',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [formatCurrency(value), '銷售額']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ fill: '#06b6d4', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart — orders by status */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">訂單狀態分佈</h3>
          {statusLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={ordersByStatus ?? []}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {(ordersByStatus ?? []).map((entry) => (
                    <Cell key={entry.status} fill={statusColor(entry.status)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: 8,
                    color: '#f1f5f9',
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [value, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 3: Tables ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top customers */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">客戶排行榜（本年度）</h3>
          {topCustLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border">
                  <th className="pb-2 text-left font-medium">客戶名稱</th>
                  <th className="pb-2 text-right font-medium">訂單數</th>
                  <th className="pb-2 text-right font-medium">總金額</th>
                </tr>
              </thead>
              <tbody>
                {(topCustomers ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="pt-4 text-center text-muted-foreground text-xs">
                      尚無資料
                    </td>
                  </tr>
                ) : (
                  (topCustomers ?? []).map((c, idx) => (
                    <tr
                      key={c.id}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors"
                    >
                      <td className="py-2.5 pr-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4 shrink-0">{idx + 1}</span>
                        <span className="text-foreground truncate">{c.name}</span>
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">{c.orderCount}</td>
                      <td className="py-2.5 text-right font-medium text-foreground">
                        {formatCurrency(c.totalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Module quick stats */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">模組快覽</h3>
          <div className="space-y-3">
            {/* HR */}
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">員工人數</span>
              {hrLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="font-semibold text-foreground">
                  {hr?.activeEmployees ?? '—'}
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    / {hr?.totalEmployees ?? '—'} 位
                  </span>
                </span>
              )}
            </div>

            {/* Procurement */}
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">供應商數</span>
              {procLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="font-semibold text-foreground">
                  {procurement?.totalSuppliers ?? '—'}
                  <span className="text-xs text-muted-foreground font-normal ml-1">家</span>
                </span>
              )}
            </div>

            {/* Inventory */}
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">庫存品項</span>
              {invLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="font-semibold text-foreground">
                  {inventory?.totalItems ?? '—'}
                  <span className="text-xs text-muted-foreground font-normal ml-1">項</span>
                </span>
              )}
            </div>

            {/* Low stock */}
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">低庫存品項</span>
              {invLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className={`font-semibold ${(inventory?.lowStockCount ?? 0) > 0 ? 'text-amber-400' : 'text-foreground'}`}>
                  {inventory?.lowStockCount ?? '—'}
                  <span className="text-xs text-muted-foreground font-normal ml-1">項</span>
                </span>
              )}
            </div>

            {/* Finance */}
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">會計科目數</span>
              {finLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className="font-semibold text-foreground">
                  {finance?.totalAccounts ?? '—'}
                  <span className="text-xs text-muted-foreground font-normal ml-1">個</span>
                </span>
              )}
            </div>

            {/* Draft JEs */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">未過帳傳票</span>
              {finLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span className={`font-semibold ${(finance?.draftJournalEntries ?? 0) > 0 ? 'text-amber-400' : 'text-foreground'}`}>
                  {finance?.draftJournalEntries ?? '—'}
                  <span className="text-xs text-muted-foreground font-normal ml-1">筆</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
