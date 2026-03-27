'use client';

import Link from 'next/link';
import { Layers, ClipboardList, Activity, Package, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { manufacturingApi } from '@/lib/api/manufacturing';

const QUICK_LINKS = [
  {
    href: '/manufacturing/boms',
    icon: Layers,
    title: 'BOM管理',
    desc: '物料清單與組成結構',
    color: 'text-purple-400',
  },
  {
    href: '/manufacturing/work-orders',
    icon: ClipboardList,
    title: '工單管理',
    desc: '生產工單排程與追蹤',
    color: 'text-blue-400',
  },
  {
    href: '/manufacturing/work-orders?status=in_progress',
    icon: Activity,
    title: '生產進度',
    desc: '進行中工單即時狀態',
    color: 'text-emerald-400',
  },
  {
    href: '/manufacturing/work-orders?status=released',
    icon: Package,
    title: '用料發料',
    desc: '待發料工單清單',
    color: 'text-amber-400',
  },
];

export default function ManufacturingPage() {
  const { data: bomsData } = useQuery({
    queryKey: ['mfg-stats-boms'],
    queryFn: () => manufacturingApi.boms.list({ isActive: true, perPage: 1 }),
  });

  const { data: allWoData } = useQuery({
    queryKey: ['mfg-stats-wo-open'],
    queryFn: () => manufacturingApi.workOrders.list({ perPage: 1 }),
  });

  const { data: inProgressData } = useQuery({
    queryKey: ['mfg-stats-wo-inprogress'],
    queryFn: () => manufacturingApi.workOrders.list({ status: 'in_progress', perPage: 1 }),
  });

  const { data: completedData } = useQuery({
    queryKey: ['mfg-stats-wo-completed'],
    queryFn: () => manufacturingApi.workOrders.list({ status: 'completed', perPage: 1 }),
  });

  const stats = [
    { label: '啟用中BOM', value: bomsData?.meta?.total ?? '—', color: 'text-purple-400' },
    { label: '開放工單', value: allWoData?.meta?.total ?? '—', color: 'text-blue-400' },
    { label: '生產中', value: inProgressData?.meta?.total ?? '—', color: 'text-emerald-400' },
    { label: '本月完成', value: completedData?.meta?.total ?? '—', color: 'text-amber-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">製造管理</h2>
        <p className="text-muted-foreground text-sm mt-1">管理物料清單、生產工單與製程追蹤</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-5 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{String(stat.value)}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
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
