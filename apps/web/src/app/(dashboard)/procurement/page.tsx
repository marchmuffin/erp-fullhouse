import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ClipboardList, ShoppingCart, PackageCheck, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Procurement' };

const QUICK_LINKS = [
  { href: '/procurement/suppliers', icon: Building2, title: '供應商管理', desc: '管理供應商基本資料、往來條件與評級', color: 'text-blue-400' },
  { href: '/procurement/requisitions', icon: ClipboardList, title: '採購申請單', desc: '建立採購需求，提交主管審核', color: 'text-amber-400' },
  { href: '/procurement/orders', icon: ShoppingCart, title: '採購訂單', desc: '向供應商下單，管理訂單狀態與收貨', color: 'text-emerald-400' },
  { href: '/procurement/orders?status=approved', icon: PackageCheck, title: '待收貨', desc: '已核准等待收貨入庫的採購訂單', color: 'text-purple-400' },
];

export default function ProcurementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">採購管理</h2>
        <p className="text-muted-foreground text-sm mt-1">管理供應商、採購申請單與採購訂單全流程</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="glass rounded-xl p-6 hover:border-primary/30 transition-all group">
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg bg-current/10 ${link.color} mb-4`}>
                  <Icon size={22} className={link.color} />
                </div>
                <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
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
