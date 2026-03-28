'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Users, TrendingUp, Calendar, UserCheck, Ticket, ArrowRight } from 'lucide-react';
import { crmApi } from '@/lib/api/crm';

const QUICK_LINKS = [
  {
    href: '/crm/leads',
    icon: Users,
    title: '潛在客戶',
    desc: '管理潛在客戶，追蹤開發進度',
    color: 'text-blue-400',
  },
  {
    href: '/crm/opportunities',
    icon: TrendingUp,
    title: '銷售機會',
    desc: '追蹤商機階段，管理銷售漏斗',
    color: 'text-emerald-400',
  },
  {
    href: '/crm/activities',
    icon: Calendar,
    title: '活動記錄',
    desc: '電話、Email、會議、任務管理',
    color: 'text-amber-400',
  },
  {
    href: '/sales/customers',
    icon: UserCheck,
    title: '客戶管理',
    desc: '已成交客戶資料與往來記錄',
    color: 'text-purple-400',
  },
  {
    href: '/crm/tickets',
    icon: Ticket,
    title: '客服工單',
    desc: '投訴、詢問、維修、退貨工單管理',
    color: 'text-rose-400',
  },
];

export default function CrmPage() {
  const { data: leadsData } = useQuery({
    queryKey: ['crm-stats-leads'],
    queryFn: () => crmApi.leads.list({ page: 1, perPage: 1, status: 'new' }),
  });

  const { data: oppsData } = useQuery({
    queryKey: ['crm-stats-opps'],
    queryFn: () => crmApi.opportunities.list({ page: 1, perPage: 100 }),
  });

  const newLeads = leadsData?.meta.total ?? 0;

  const openOpps = oppsData?.data?.filter(
    (o) => o.stage !== 'closed_won' && o.stage !== 'closed_lost',
  ) ?? [];

  const totalPipeline = openOpps.reduce((sum, o) => sum + Number(o.value ?? 0), 0);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const allOpps = oppsData?.data ?? [];
  const closedWon = allOpps.filter(
    (o) => o.stage === 'closed_won' && new Date(o.updatedAt) >= thisMonth,
  ).length;
  const closedLost = allOpps.filter(
    (o) => o.stage === 'closed_lost' && new Date(o.updatedAt) >= thisMonth,
  ).length;
  const winRate =
    closedWon + closedLost > 0
      ? Math.round((closedWon / (closedWon + closedLost)) * 100)
      : 0;

  const STATS = [
    { label: '新潛在客戶', value: newLeads, unit: '筆' },
    { label: '進行中商機', value: openOpps.length, unit: '筆' },
    {
      label: '潛在管道總值',
      value: `TWD ${totalPipeline.toLocaleString()}`,
      unit: '',
    },
    { label: '本月成交率', value: `${winRate}%`, unit: '' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">客戶關係管理</h2>
        <p className="text-muted-foreground text-sm mt-1">
          管理潛在客戶開發、商機追蹤與客戶互動全流程
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-5">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground">
              {stat.value}
              {stat.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{stat.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Quick links */}
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
