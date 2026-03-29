import type { Metadata } from 'next';
import Link from 'next/link';
import { Users, FileText, TrendingUp, Truck, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Sales' };

const QUICK_LINKS = [
  {
    href: '/sales/customers',
    icon: Users,
    title: '客戶管理',
    desc: '管理客戶資料、信用額度、付款條件',
    color: 'text-blue-400',
  },
  {
    href: '/sales/orders',
    icon: FileText,
    title: '銷售訂單',
    desc: '建立、審核、追蹤銷售訂單全流程',
    color: 'text-emerald-400',
  },
  {
    href: '/sales/orders?status=pending_approval',
    icon: TrendingUp,
    title: '待審核訂單',
    desc: '查看所有等待審核的銷售訂單',
    color: 'text-amber-400',
  },
  {
    href: '/sales/delivery',
    icon: Truck,
    title: '出貨管理',
    desc: '管理已核准訂單的出貨與交貨記錄',
    color: 'text-purple-400',
  },
];

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">銷售管理</h2>
        <p className="text-muted-foreground text-sm mt-1">管理客戶、銷售訂單與出貨作業</p>
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
    </div>
  );
}
