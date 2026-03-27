'use client';

import Link from 'next/link';
import { BookOpen, FileText, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { financeApi } from '@/lib/api/finance';
import { formatCurrency } from '@/lib/utils';

const QUICK_LINKS = [
  {
    href: '/finance/accounts',
    icon: BookOpen,
    title: '會計科目',
    desc: '科目表管理',
    color: 'text-indigo-400',
  },
  {
    href: '/finance/journal',
    icon: FileText,
    title: '日記帳',
    desc: '傳票輸入與過帳',
    color: 'text-blue-400',
  },
  {
    href: '/finance/invoices?type=ar',
    icon: TrendingUp,
    title: '應收帳款',
    desc: '客戶發票與收款',
    color: 'text-emerald-400',
  },
  {
    href: '/finance/invoices?type=ap',
    icon: TrendingDown,
    title: '應付帳款',
    desc: '供應商帳單與付款',
    color: 'text-red-400',
  },
];

export default function FinancePage() {
  const { data: accounts } = useQuery({
    queryKey: ['finance-accounts-summary'],
    queryFn: () => financeApi.accounts.list({ perPage: 1 }),
  });

  const { data: draftJournals } = useQuery({
    queryKey: ['finance-journal-draft-count'],
    queryFn: () => financeApi.journal.list({ status: 'draft', perPage: 1 }),
  });

  const { data: arInvoices } = useQuery({
    queryKey: ['finance-ar-summary'],
    queryFn: () => financeApi.invoices.list({ type: 'ar', perPage: 500 }),
  });

  const { data: apInvoices } = useQuery({
    queryKey: ['finance-ap-summary'],
    queryFn: () => financeApi.invoices.list({ type: 'ap', perPage: 500 }),
  });

  const outstandingAR = (arInvoices?.data ?? []).reduce((sum, inv) => {
    if (['issued', 'partial', 'overdue'].includes(inv.status)) {
      return sum + (Number(inv.totalAmount) - Number(inv.paidAmount));
    }
    return sum;
  }, 0);

  const outstandingAP = (apInvoices?.data ?? []).reduce((sum, inv) => {
    if (['issued', 'partial', 'overdue'].includes(inv.status)) {
      return sum + (Number(inv.totalAmount) - Number(inv.paidAmount));
    }
    return sum;
  }, 0);

  const stats = [
    { label: '會計科目數', value: accounts?.meta.total ?? '—', unit: '個' },
    { label: '未過帳傳票', value: draftJournals?.meta.total ?? '—', unit: '筆' },
    { label: '應收未收', value: formatCurrency(outstandingAR), unit: '' },
    { label: '應付未付', value: formatCurrency(outstandingAP), unit: '' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">財務管理</h2>
        <p className="text-muted-foreground text-sm mt-1">會計科目、日記帳傳票、應收應付帳款全流程管理</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-xl font-bold text-foreground">
              {stat.value}{stat.unit && <span className="text-sm font-normal text-muted-foreground ml-1">{stat.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {QUICK_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="glass rounded-xl p-6 hover:border-primary/30 transition-all group">
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
