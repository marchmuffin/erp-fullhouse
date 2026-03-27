'use client';

import { useQueries } from '@tanstack/react-query';
import {
  ShoppingCart, TrendingUp, Package, DollarSign,
  Users, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { biApi } from '@/lib/api/bi';
import { bpmApi } from '@/lib/api/bpm';
import { formatCurrency } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function KpiSkeleton() {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="animate-pulse bg-muted/30 rounded-lg h-9 w-9" />
      </div>
      <div className="space-y-2">
        <div className="animate-pulse bg-muted/30 rounded h-8 w-24" />
        <div className="animate-pulse bg-muted/30 rounded h-4 w-20" />
      </div>
    </div>
  );
}

function PendingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
          <div className="flex-1 space-y-1.5">
            <div className="animate-pulse bg-muted/30 rounded h-4 w-40" />
            <div className="animate-pulse bg-muted/30 rounded h-3 w-28" />
          </div>
          <div className="animate-pulse bg-muted/30 rounded-md h-7 w-12 ml-3" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Doc-type badge colour mapping
// ---------------------------------------------------------------------------

const DOC_TYPE_COLOURS: Record<string, string> = {
  PR: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  PO: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  SO: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  LEAVE: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

function docTypeBadgeClass(docType: string) {
  return (
    DOC_TYPE_COLOURS[docType.toUpperCase()] ??
    'bg-muted/30 text-muted-foreground border-border/50'
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DashboardOverview() {
  const results = useQueries({
    queries: [
      { queryKey: ['bi', 'summary', 'sales'],        queryFn: biApi.summary.sales,        staleTime: 60_000 },
      { queryKey: ['bi', 'summary', 'procurement'],  queryFn: biApi.summary.procurement,  staleTime: 60_000 },
      { queryKey: ['bi', 'summary', 'inventory'],    queryFn: biApi.summary.inventory,    staleTime: 60_000 },
      { queryKey: ['bi', 'summary', 'finance'],      queryFn: biApi.summary.finance,      staleTime: 60_000 },
      { queryKey: ['bi', 'summary', 'hr'],           queryFn: biApi.summary.hr,           staleTime: 60_000 },
      { queryKey: ['bpm', 'instances', 'pending'],   queryFn: bpmApi.instances.pending,   staleTime: 30_000 },
    ],
  });

  const [salesQ, procQ, invQ, finQ, hrQ, bpmQ] = results;

  const sales       = salesQ.data;
  const procurement = procQ.data;
  const inventory   = invQ.data;
  const finance     = finQ.data;
  const hr          = hrQ.data;
  const pendingBpm  = bpmQ.data;

  // KPI cards definition — values resolved from live data (or undefined while loading)
  const kpiCards = [
    {
      title: '本月銷售額',
      value: sales ? formatCurrency(sales.revenueThisMonth) : undefined,
      icon: TrendingUp,
      color: 'text-emerald-400',
      loading: salesQ.isLoading,
    },
    {
      title: '待處理採購單',
      value: procurement ? String(procurement.pendingPRs) : undefined,
      icon: ShoppingCart,
      color: 'text-blue-400',
      loading: procQ.isLoading,
    },
    {
      title: '庫存警示品項',
      value: inventory ? String(inventory.lowStockCount) : undefined,
      icon: Package,
      color: 'text-amber-400',
      loading: invQ.isLoading,
    },
    {
      title: '應收帳款',
      value: finance ? formatCurrency(finance.totalAR) : undefined,
      icon: DollarSign,
      color: 'text-purple-400',
      loading: finQ.isLoading,
    },
    {
      title: '在職員工數',
      value: hr ? String(hr.activeEmployees) : undefined,
      icon: Users,
      color: 'text-cyan-400',
      loading: hrQ.isLoading,
    },
    {
      title: '品質異常',
      value: finance ? String(finance.draftJournalEntries) : undefined,
      icon: AlertTriangle,
      color: 'text-red-400',
      loading: finQ.isLoading,
    },
  ];

  const pendingInstances = pendingBpm?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">系統概覽</h2>
        <p className="text-muted-foreground text-sm mt-1" suppressHydrationWarning>
          {new Date().toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => {
          if (card.loading) return <KpiSkeleton key={card.title} />;

          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="glass rounded-xl p-5 hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-lg bg-current/10 ${card.color}`}>
                  <Icon size={20} className={card.color} />
                </div>
              </div>
              <div>
                {card.value !== undefined ? (
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                ) : (
                  <div className="animate-pulse bg-muted/30 rounded h-8 w-24" />
                )}
                <p className="text-sm text-muted-foreground mt-1">{card.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lower panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities — static feed kept as-is */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">最新動態</h3>
          <div className="space-y-3">
            {[
              { text: '採購單 PO-2024-0089 已核准', time: '5 分鐘前', type: 'success' },
              { text: '庫存品項 RAW-001 低於安全庫存', time: '23 分鐘前', type: 'warning' },
              { text: '銷售訂單 SO-2024-0234 已建立', time: '1 小時前', type: 'info' },
              { text: '員工 張小明 請假申請待審核', time: '2 小時前', type: 'pending' },
              { text: 'IQC 檢驗 QC-2024-0045 已完成', time: '3 小時前', type: 'success' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.type === 'success' ? 'bg-emerald-400' :
                    item.type === 'warning' ? 'bg-amber-400' :
                    item.type === 'info'    ? 'bg-blue-400' : 'bg-muted-foreground'
                  }`}
                />
                <p className="text-sm text-foreground flex-1">{item.text}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals — wired to bpmApi */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">待我審核</h3>

          {bpmQ.isLoading ? (
            <PendingSkeleton />
          ) : pendingInstances.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">目前沒有待審核項目</p>
          ) : (
            <div className="space-y-3">
              {pendingInstances.map((instance) => (
                <div
                  key={instance.id}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded border font-mono ${docTypeBadgeClass(instance.docType)}`}
                      >
                        {instance.docType}
                      </span>
                      <p className="text-sm font-medium text-foreground truncate">{instance.docNo}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      由 {instance.submittedBy} 提交
                    </p>
                  </div>
                  <Link
                    href={`/bpm/instances/${instance.id}`}
                    className="ml-3 flex-shrink-0 text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    審核
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
