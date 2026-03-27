'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MonitorPlay, BarChart2, ArrowRight, ShoppingBag,
  TrendingUp, Receipt, Clock, X,
} from 'lucide-react';
import { posApi } from '@/lib/api/pos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const openSchema = z.object({
  cashierName: z.string().min(1, '請輸入收銀員姓名').max(100),
  openingCash: z.coerce.number().min(0).optional(),
});

function formatCurrency(n: number | string) {
  return `NT$ ${Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0 })}`;
}

function formatDateTime(s: string) {
  return new Date(s).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' });
}

export default function PosPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['pos-active-session'],
    queryFn: posApi.sessions.active,
    retry: false,
  });

  // Today stats
  const { data: todaySessions } = useQuery({
    queryKey: ['pos-sessions-today'],
    queryFn: () => posApi.sessions.list({ perPage: 100 }),
  });

  const { data: todayOrders } = useQuery({
    queryKey: ['pos-orders-today'],
    queryFn: () => posApi.orders.list({ perPage: 1 }),
  });

  const openMutation = useMutation({
    mutationFn: (d: z.infer<typeof openSchema>) => posApi.sessions.open(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-active-session'] });
      qc.invalidateQueries({ queryKey: ['pos-sessions-today'] });
      setShowOpen(false);
      reset();
    },
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      posApi.sessions.close(session!.id, {
        closingCash: closingCash ? Number(closingCash) : undefined,
        notes: closeNotes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-active-session'] });
      qc.invalidateQueries({ queryKey: ['pos-sessions-today'] });
      setShowClose(false);
      setClosingCash('');
      setCloseNotes('');
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof openSchema>>({
    resolver: zodResolver(openSchema),
    defaultValues: { openingCash: 0 },
  });

  const todayData = todaySessions?.data ?? [];
  const totalSessions = todaySessions?.meta?.total ?? 0;
  const totalOrders = todayOrders?.meta?.total ?? 0;
  const totalRevenue = todayData.reduce((sum, s) => sum + Number(s.totalSales), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">POS 收銀系統</h2>
        <p className="text-muted-foreground text-sm mt-1">管理收銀班次與銷售交易</p>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => session ? router.push('/pos/terminal') : setShowOpen(true)}
          className="glass rounded-xl p-6 hover:border-primary/30 transition-all group text-left"
        >
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-emerald-400/10 mb-4">
              <MonitorPlay size={22} className="text-emerald-400" />
            </div>
            <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">開始收銀</h3>
          <p className="text-sm text-muted-foreground">
            {session ? '前往收銀台，繼續目前班次' : '開新班次，啟動收銀台'}
          </p>
        </button>

        <Link href="/pos/sessions" className="glass rounded-xl p-6 hover:border-primary/30 transition-all group">
          <div className="flex items-start justify-between">
            <div className="p-2 rounded-lg bg-blue-400/10 mb-4">
              <BarChart2 size={22} className="text-blue-400" />
            </div>
            <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">今日銷售報表</h3>
          <p className="text-sm text-muted-foreground">查看所有班次與交易紀錄</p>
        </Link>
      </div>

      {/* Active Session Panel */}
      {session && (
        <div className="glass rounded-xl p-6 border border-emerald-500/30">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div>
                <h3 className="font-semibold text-foreground">目前班次</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {session.sessionNo} · {session.cashierName} · 開班 {formatDateTime(session.openedAt)}
                </p>
              </div>
            </div>
            <Badge variant="success">進行中</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-background/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">銷售總額</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(session.totalSales)}</p>
            </div>
            <div className="bg-background/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">訂單數</p>
              <p className="text-xl font-bold text-foreground">{session.totalOrders}</p>
            </div>
            <div className="bg-background/40 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">開班備用金</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(session.openingCash)}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => router.push('/pos/terminal')} className="flex-1">
              <MonitorPlay size={16} /> 前往收銀台
            </Button>
            <Button variant="outline" onClick={() => setShowClose(true)}>
              <X size={16} /> 結束班次
            </Button>
          </div>
        </div>
      )}

      {/* Today Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Clock, label: '今日班次', value: String(totalSessions), color: 'text-amber-400' },
          { icon: ShoppingBag, label: '今日訂單', value: String(totalOrders), color: 'text-blue-400' },
          { icon: TrendingUp, label: '今日營收', value: formatCurrency(totalRevenue), color: 'text-emerald-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass rounded-xl p-5 flex items-center gap-4">
            <div className={`p-2.5 rounded-lg bg-current/10 ${color}`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Open Session Dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>開新班次</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit((d) => openMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">收銀員姓名 *</label>
              <Input placeholder="王小明" {...register('cashierName')} />
              {errors.cashierName && <p className="text-xs text-destructive">{errors.cashierName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">開班備用金 (NT$)</label>
              <Input type="number" min={0} placeholder="5000" {...register('openingCash')} />
            </div>
            {openMutation.error && (
              <p className="text-sm text-destructive">{(openMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowOpen(false)}>取消</Button>
              <Button type="submit" disabled={openMutation.isPending}>
                {openMutation.isPending ? '開班中...' : '開始班次'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close Session Dialog */}
      <Dialog open={showClose} onOpenChange={setShowClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>結束班次</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">結班現金 (NT$)</label>
              <Input
                type="number" min={0} placeholder="4800"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input
                placeholder="班次備註..."
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>
            {closeMutation.error && (
              <p className="text-sm text-destructive">{(closeMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowClose(false)}>取消</Button>
              <Button
                variant="destructive"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
              >
                {closeMutation.isPending ? '結班中...' : '確認結班'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
