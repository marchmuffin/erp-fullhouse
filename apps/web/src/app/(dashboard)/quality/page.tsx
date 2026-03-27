import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardCheck, AlertTriangle, BarChart3, BookOpen, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'Quality Control' };

const QUICK_LINKS = [
  {
    href: '/quality/inspections',
    icon: ClipboardCheck,
    title: '檢驗單管理',
    desc: '建立與追蹤進料、製程、出貨檢驗單，記錄檢驗結果',
    color: 'text-blue-400',
  },
  {
    href: '/quality/ncrs',
    icon: AlertTriangle,
    title: '品質異常管理',
    desc: '記錄不符合事項、追蹤改善措施與關閉狀態',
    color: 'text-amber-400',
  },
  {
    href: '/quality/reports',
    icon: BarChart3,
    title: '統計報表',
    desc: '品質趨勢、合格率統計與異常分析報表（即將推出）',
    color: 'text-emerald-400',
  },
  {
    href: '/quality/standards',
    icon: BookOpen,
    title: '標準規格',
    desc: '管理品質標準、檢驗規格與允收準則（即將推出）',
    color: 'text-purple-400',
  },
];

export default function QualityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">品質管制</h2>
        <p className="text-muted-foreground text-sm mt-1">管理檢驗作業、品質異常與品質統計全流程</p>
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
