import type { Metadata } from 'next';
import Link from 'next/link';
import { Users, CalendarDays, Clock, DollarSign, Star, ArrowRight } from 'lucide-react';

export const metadata: Metadata = { title: 'HR 人力資源' };

const QUICK_LINKS = [
  {
    href: '/hr/employees',
    icon: Users,
    title: '員工管理',
    desc: '管理員工資料、職位、薪資與狀態',
    color: 'text-blue-400',
  },
  {
    href: '/hr/leave',
    icon: CalendarDays,
    title: '假單管理',
    desc: '申請與審核員工請假單',
    color: 'text-emerald-400',
  },
  {
    href: '/hr/attendance',
    icon: Clock,
    title: '出勤管理',
    desc: '記錄員工上下班打卡與出勤狀況',
    color: 'text-amber-400',
  },
  {
    href: '/hr/payroll',
    icon: DollarSign,
    title: '薪資管理',
    desc: '建立、審核與發放薪資單',
    color: 'text-purple-400',
  },
  {
    href: '/hr/performance',
    icon: Star,
    title: '績效考核',
    desc: '建立與追蹤員工年度及專案績效考核',
    color: 'text-amber-400',
  },
];

export default function HrPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">人力資源管理</h2>
        <p className="text-muted-foreground text-sm mt-1">管理員工、假單、出勤與薪資作業</p>
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
