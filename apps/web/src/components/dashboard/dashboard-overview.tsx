'use client';

import {
  ShoppingCart, TrendingUp, Package, DollarSign,
  Users, AlertTriangle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

interface StatCard {
  title: string;
  value: string;
  change: number;
  icon: React.ElementType;
  color: string;
}

const STAT_CARDS: StatCard[] = [
  { title: '本月銷售額', value: 'NT$ 2,450,000', change: 12.5, icon: TrendingUp, color: 'text-emerald-400' },
  { title: '待處理採購單', value: '28', change: -3, icon: ShoppingCart, color: 'text-blue-400' },
  { title: '庫存警示品項', value: '12', change: 5, icon: Package, color: 'text-amber-400' },
  { title: '應收帳款', value: 'NT$ 890,000', change: -8.2, icon: DollarSign, color: 'text-purple-400' },
  { title: '在職員工數', value: '156', change: 2, icon: Users, color: 'text-cyan-400' },
  { title: '品質異常件數', value: '3', change: -1, icon: AlertTriangle, color: 'text-red-400' },
];

export function DashboardOverview() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">系統概覽</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          const isPositive = card.change > 0;
          const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

          return (
            <div
              key={card.title}
              className="glass rounded-xl p-5 hover:border-primary/30 transition-colors group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-2 rounded-lg bg-current/10 ${card.color}`}>
                  <Icon size={20} className={card.color} />
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                    isPositive
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  <TrendIcon size={12} />
                  {Math.abs(card.change)}%
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
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
                    item.type === 'info' ? 'bg-blue-400' : 'bg-muted-foreground'
                  }`}
                />
                <p className="text-sm text-foreground flex-1">{item.text}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">待我審核</h3>
          <div className="space-y-3">
            {[
              { title: '採購申請單 PR-2024-0156', desc: '辦公用品採購 NT$ 12,500', urgent: false },
              { title: '請假申請 - 王大明', desc: '特休 3 天 (2024/12/25-27)', urgent: false },
              { title: '超額採購單 PO-2024-0088', desc: '超出預算 15% 需主管核准', urgent: true },
              { title: '銷售折扣申請 SO-2024-0230', desc: '特殊折扣 20% 授權', urgent: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    {item.urgent && (
                      <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/20">
                        緊急
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                <button className="ml-3 flex-shrink-0 text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
                  審核
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
