'use client';

import Link from 'next/link';
import { Package, Building2, ArrowLeftRight, ClipboardList, ArrowRight, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api/inventory';
import type { Metadata } from 'next';

const QUICK_LINKS = [
  {
    href: '/inventory/items',
    icon: Package,
    title: '品項管理',
    desc: '管理所有料號與庫存水位',
    color: 'text-cyan-400',
  },
  {
    href: '/inventory/warehouses',
    icon: Building2,
    title: '倉庫管理',
    desc: '倉庫設定與庫存查詢',
    color: 'text-blue-400',
  },
  {
    href: '/inventory/transactions',
    icon: ArrowLeftRight,
    title: '庫存異動',
    desc: '入庫、出庫與調整記錄',
    color: 'text-amber-400',
  },
  {
    href: '/inventory/counts',
    icon: ClipboardList,
    title: '盤點管理',
    desc: '定期盤點與差異調整',
    color: 'text-emerald-400',
  },
];

export default function InventoryPage() {
  const { data: lowStockItems, isLoading } = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () => inventoryApi.items.lowStock(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">庫存管理</h2>
        <p className="text-muted-foreground text-sm mt-1">管理品項、倉庫、庫存異動與盤點作業</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="glass rounded-xl p-6 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg bg-current/10 ${link.color} mb-4`}>
                  <Icon size={22} className={link.color} />
                </div>
                <ArrowRight
                  size={16}
                  className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all"
                />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{link.title}</h3>
              <p className="text-sm text-muted-foreground">{link.desc}</p>
            </Link>
          );
        })}
      </div>

      {/* Low Stock Alert Section */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-amber-400" />
          <h3 className="font-semibold text-foreground">低於安全庫存</h3>
          {lowStockItems && lowStockItems.length > 0 && (
            <span className="ml-auto text-xs text-amber-400 font-medium">
              {lowStockItems.length} 個品項需補貨
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !lowStockItems || lowStockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">目前無低庫存警示</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['料號', '品名', '倉庫', '現有庫存', '安全庫存'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => {
                  const levels = item.stockLevels ?? [];
                  if (levels.length === 0) {
                    return (
                      <tr key={item.id} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{item.code}</td>
                        <td className="px-3 py-2.5">{item.name}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">—</td>
                        <td className="px-3 py-2.5 text-amber-400 font-medium">0</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{item.safetyStock}</td>
                      </tr>
                    );
                  }
                  return levels.map((sl) => (
                    <tr key={`${item.id}-${sl.id}`} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{item.code}</td>
                      <td className="px-3 py-2.5">{item.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{sl.warehouse.name}</td>
                      <td className="px-3 py-2.5 text-amber-400 font-medium">
                        {Number(sl.quantity).toLocaleString()} {item.unit}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {Number(item.safetyStock).toLocaleString()} {item.unit}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
