'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PlayCircle, CheckCircle2, Save } from 'lucide-react';
import { inventoryApi } from '@/lib/api/inventory';
import type { StockCountLine } from '@/lib/api/inventory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate, formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; variant: any }> = {
  draft: { label: '草稿', variant: 'secondary' },
  in_progress: { label: '盤點中', variant: 'warning' },
  completed: { label: '已完成', variant: 'success' },
  cancelled: { label: '已取消', variant: 'outline' },
};

function LineRow({
  line,
  countId,
  readOnly,
}: {
  line: StockCountLine;
  countId: string;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const [editValue, setEditValue] = useState<string>(
    line.countedQty !== undefined && line.countedQty !== null
      ? String(line.countedQty)
      : '',
  );
  const [dirty, setDirty] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (countedQty: number) =>
      inventoryApi.counts.updateLine(countId, line.id, { countedQty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-count', countId] });
      setDirty(false);
    },
  });

  const variance =
    editValue !== '' && !isNaN(Number(editValue))
      ? Number(editValue) - Number(line.systemQty)
      : line.variance;

  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
        {line.item?.code ?? '—'}
      </td>
      <td className="px-3 py-2.5">{line.item?.name ?? '—'}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{line.item?.unit ?? '—'}</td>
      <td className="px-3 py-2.5 font-medium">{Number(line.systemQty).toLocaleString()}</td>
      <td className="px-3 py-2.5">
        {readOnly ? (
          <span>{line.countedQty !== undefined && line.countedQty !== null ? Number(line.countedQty).toLocaleString() : '—'}</span>
        ) : (
          <Input
            type="number"
            step="0.001"
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setDirty(true);
            }}
            className="h-7 w-28 text-sm"
            placeholder="輸入數量"
          />
        )}
      </td>
      <td className="px-3 py-2.5">
        {variance !== undefined && variance !== null ? (
          <span
            className={cn(
              'font-medium',
              variance > 0 ? 'text-emerald-400' : variance < 0 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {variance > 0 ? '+' : ''}{Number(variance).toLocaleString()}
          </span>
        ) : (
          '—'
        )}
      </td>
      {!readOnly && (
        <td className="px-3 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={!dirty || updateMutation.isPending || editValue === ''}
            onClick={() => {
              if (editValue !== '' && !isNaN(Number(editValue))) {
                updateMutation.mutate(Number(editValue));
              }
            }}
          >
            <Save size={12} className="mr-1" />
            {updateMutation.isPending ? '...' : '儲存'}
          </Button>
        </td>
      )}
    </tr>
  );
}

export default function CountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory-count', id] });

  const { data: count, isLoading } = useQuery({
    queryKey: ['inventory-count', id],
    queryFn: () => inventoryApi.counts.get(id),
  });

  const completeMutation = useMutation({
    mutationFn: () => inventoryApi.counts.complete(id),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!count) return null;

  const statusCfg = STATUS_CONFIG[count.status] ?? { label: count.status, variant: 'outline' };
  const lines = count.lines ?? [];
  const isReadOnly = count.status === 'completed' || count.status === 'cancelled';
  const isInProgress = count.status === 'in_progress';

  // Summary calculations
  const linesWithVariance = lines.filter(
    (l) => l.variance !== undefined && l.variance !== null && l.variance !== 0,
  );
  const totalVariance = lines.reduce((sum, l) => sum + Number(l.variance ?? 0), 0);
  const countedLines = lines.filter(
    (l) => l.countedQty !== undefined && l.countedQty !== null,
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{count.countNo}</h2>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {count.warehouse?.name && `${count.warehouse.name} · `}
              盤點日期：{formatDate(count.countDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {count.status === 'draft' && (
            <Button size="sm" variant="outline" onClick={() => router.refresh()}>
              <PlayCircle size={14} /> 開始盤點
            </Button>
          )}
          {isInProgress && (
            <Button
              size="sm"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              <CheckCircle2 size={14} /> 完成盤點
            </Button>
          )}
        </div>
      </div>

      {/* Count Info */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">盤點資訊</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">倉庫</dt>
            <dd>{count.warehouse ? `${count.warehouse.code} — ${count.warehouse.name}` : '—'}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">盤點日期</dt>
            <dd>{formatDate(count.countDate)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground text-xs">建立時間</dt>
            <dd>{formatDateTime(count.createdAt)}</dd>
          </div>
          {count.completedAt && (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground text-xs">完成時間</dt>
              <dd>{formatDateTime(count.completedAt)}</dd>
            </div>
          )}
          {count.notes && (
            <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-3">
              <dt className="text-muted-foreground text-xs">備註</dt>
              <dd>{count.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Lines Table */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">盤點明細</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">尚無盤點明細</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['料號', '品名', '單位', '系統庫存', '實盤數量', '差異', ...(isReadOnly ? [] : [''])].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <LineRow
                    key={line.id}
                    line={line}
                    countId={id}
                    readOnly={isReadOnly}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {lines.length > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">盤點摘要</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{lines.length}</p>
              <p className="text-xs text-muted-foreground mt-1">總品項數</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{countedLines.length}</p>
              <p className="text-xs text-muted-foreground mt-1">已盤點</p>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  'text-2xl font-bold',
                  linesWithVariance.length > 0 ? 'text-amber-400' : 'text-foreground',
                )}
              >
                {linesWithVariance.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">有差異品項</p>
            </div>
            <div className="text-center">
              <p
                className={cn(
                  'text-2xl font-bold',
                  totalVariance > 0
                    ? 'text-emerald-400'
                    : totalVariance < 0
                    ? 'text-destructive'
                    : 'text-foreground',
                )}
              >
                {totalVariance > 0 ? '+' : ''}{Number(totalVariance).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">總差異數量</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
