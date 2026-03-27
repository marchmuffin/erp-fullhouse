'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { procurementApi } from '@/lib/api/procurement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const lineSchema = z.object({
  lineNo: z.number(),
  itemCode: z.string().min(1, '必填'),
  itemName: z.string().min(1, '必填'),
  spec: z.string().optional(),
  unit: z.string().min(1, '必填'),
  quantity: z.coerce.number().min(0.0001),
  unitPrice: z.coerce.number().min(0),
  notes: z.string().optional(),
});

const schema = z.object({
  poNo: z.string().min(1).max(30),
  supplierId: z.string().min(1, '請選擇供應商'),
  prId: z.string().optional(),
  orderDate: z.string().min(1),
  expectedDate: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prId = searchParams.get('prId');
  const [error, setError] = useState<string | null>(null);

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-select'],
    queryFn: () => procurementApi.suppliers.list({ perPage: 100 }),
  });

  const { data: prData } = useQuery({
    queryKey: ['pr-for-po', prId],
    queryFn: () => procurementApi.requisitions.get(prId!),
    enabled: !!prId,
  });

  const { register, control, handleSubmit, watch, setValue } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      orderDate: new Date().toISOString().split('T')[0],
      currency: 'TWD',
      prId: prId ?? undefined,
      lines: [{ lineNo: 1, itemCode: '', itemName: '', unit: 'PCS', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');

  useEffect(() => {
    const d = new Date();
    setValue('poNo', `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`);
  }, [setValue]);

  // Pre-fill lines from PR
  useEffect(() => {
    if (prData?.lines) {
      replace(prData.lines.map((l, i) => ({ lineNo: i + 1, itemCode: l.itemCode, itemName: l.itemName, spec: l.spec, unit: l.unit, quantity: Number(l.quantity), unitPrice: 0 })));
    }
  }, [prData, replace]);

  const subtotal = lines?.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0) ?? 0;
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const createMut = useMutation({
    mutationFn: (d: any) => procurementApi.orders.create(d),
    onSuccess: (po) => router.push(`/procurement/orders/${po.id}`),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft size={18} /></Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">新增採購訂單</h2>
          {prId && prData && <p className="text-sm text-muted-foreground">源自申請單：{prData.prNo}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit((d) => { setError(null); createMut.mutate(d); })} className="space-y-6">
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground text-sm">訂單基本資訊</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><label className="text-sm font-medium">採購單號 *</label><Input {...register('poNo')} /></div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">供應商 *</label>
              <select className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...register('supplierId')}>
                <option value="">-- 選擇供應商 --</option>
                {suppliersData?.data.map((s) => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><label className="text-sm font-medium">訂單日期 *</label><Input type="date" {...register('orderDate')} /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">預計到貨日</label><Input type="date" {...register('expectedDate')} /></div>
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">採購品項</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ lineNo: fields.length + 1, itemCode: '', itemName: '', unit: 'PCS', quantity: 1, unitPrice: 0 })}>
              <Plus size={14} /> 新增品項
            </Button>
          </div>
          {fields.map((field, idx) => {
            const amt = (Number(lines?.[idx]?.quantity) || 0) * (Number(lines?.[idx]?.unitPrice) || 0);
            return (
              <div key={field.id} className="rounded-lg border border-border/50 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground">品項 {idx + 1}</span>
                  {fields.length > 1 && <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1"><label className="text-xs text-muted-foreground">料號 *</label><Input placeholder="RAW-001" {...register(`lines.${idx}.itemCode`)} /></div>
                  <div className="col-span-1 sm:col-span-2 space-y-1"><label className="text-xs text-muted-foreground">品名 *</label><Input placeholder="物料名稱" {...register(`lines.${idx}.itemName`)} /></div>
                  <div className="space-y-1"><label className="text-xs text-muted-foreground">單位</label><Input placeholder="PCS" {...register(`lines.${idx}.unit`)} /></div>
                  <div className="space-y-1"><label className="text-xs text-muted-foreground">數量 *</label><Input type="number" step="0.0001" {...register(`lines.${idx}.quantity`)} /></div>
                  <div className="space-y-1"><label className="text-xs text-muted-foreground">單價</label><Input type="number" step="0.01" {...register(`lines.${idx}.unitPrice`)} /></div>
                  <div className="space-y-1"><label className="text-xs text-muted-foreground">小計</label><div className="flex h-9 items-center px-3 rounded-md border border-border/50 bg-muted/30 text-sm font-medium">{amt.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</div></div>
                </div>
              </div>
            );
          })}
          <div className="border-t border-border pt-4">
            <div className="flex justify-end text-sm space-y-1">
              <div className="text-right space-y-1">
                <div className="flex gap-8 justify-between text-muted-foreground"><span>小計</span><span>TWD {subtotal.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</span></div>
                <div className="flex gap-8 justify-between text-muted-foreground"><span>稅額 (5%)</span><span>TWD {tax.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</span></div>
                <div className="flex gap-8 justify-between font-semibold text-foreground text-base border-t border-border pt-2"><span>合計</span><span>TWD {total.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</span></div>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
          <Button type="submit" disabled={createMut.isPending}>{createMut.isPending && <Loader2 size={14} className="animate-spin" />}建立採購單</Button>
        </div>
      </form>
    </div>
  );
}
