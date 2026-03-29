'use client';

import { useQuery } from '@tanstack/react-query';
import { adminApi, type PlanDefinition } from '@/lib/api/admin';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Users, Package } from 'lucide-react';

const PLAN_COLORS: Record<string, string> = {
  starter:      'border-slate-500/30 bg-slate-500/5',
  professional: 'border-blue-500/30 bg-blue-500/5',
  enterprise:   'border-emerald-500/30 bg-emerald-500/5',
  custom:       'border-amber-500/30 bg-amber-500/5',
};

const PLAN_BADGE: Record<string, any> = {
  starter:      'secondary',
  professional: 'info',
  enterprise:   'success',
  custom:       'warning',
};

export default function PlansPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => adminApi.plans.list(),
  });

  const plans = data?.plans ?? [];
  const allModules = data?.allModules ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        載入中...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">方案管理</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          各方案的模組權限與用戶上限定義。個別租戶的模組可在租戶管理中自訂。
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((plan: PlanDefinition) => (
          <div
            key={plan.key}
            className={`rounded-xl border p-5 space-y-4 ${PLAN_COLORS[plan.key] ?? 'border-border bg-card'}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <Badge variant={PLAN_BADGE[plan.key] ?? 'secondary'} className="mb-2">
                  {plan.labelEn}
                </Badge>
                <h3 className="font-semibold text-foreground">{plan.label}</h3>
              </div>
            </div>

            {/* Limits */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users size={13} />
                {plan.maxUsers >= 999 ? '不限用戶' : `最多 ${plan.maxUsers} 位`}
              </span>
              <span className="flex items-center gap-1">
                <Package size={13} />
                {plan.modules.length} 個模組
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{plan.description}</p>

            {/* Modules */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">包含模組</p>
              {allModules.map((mod) => {
                const included = plan.modules.includes(mod.key) || plan.key === 'custom';
                return (
                  <div key={mod.key} className="flex items-center gap-2 text-xs">
                    <CheckCircle2
                      size={13}
                      className={included ? 'text-emerald-400' : 'text-muted-foreground/30'}
                    />
                    <span className={included ? 'text-foreground' : 'text-muted-foreground/50'}>
                      {mod.label}
                    </span>
                    {plan.key === 'custom' && included && (
                      <span className="text-amber-400 text-[10px]">自訂</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* All modules reference table */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">模組功能對照表</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-2 text-muted-foreground font-medium">模組</th>
                {plans.map((p) => (
                  <th key={p.key} className="text-center pb-2 text-muted-foreground font-medium px-3">
                    {p.labelEn}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allModules.map((mod) => (
                <tr key={mod.key} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 text-foreground">{mod.label}</td>
                  {plans.map((p) => (
                    <td key={p.key} className="text-center py-2 px-3">
                      {p.key === 'custom' ? (
                        <span className="text-amber-400 text-[10px]">自訂</span>
                      ) : p.modules.includes(mod.key) ? (
                        <CheckCircle2 size={13} className="text-emerald-400 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
