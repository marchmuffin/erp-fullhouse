'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { salesApi, type CreateSalesOrderPayload } from '@/lib/api/sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const lineSchema = z.object({
  lineNo: z.number(),
  itemCode: z.string().min(1, '必填'),
  itemName: z.string().min(1, '必填'),
  spec: z.string().optional(),
  unit: z.string().min(1, '必填'),
  quantity: z.coerce.number().min(0.0001, '數量必須大於 0'),
  unitPrice: z.coerce.number().min(0, '單價不可為負'),
  discount: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const schema = z.object({
  orderNo: z.string().min(1, '必填').max(30),
  customerId: z.string().min(1, '請選擇客戶'),
  orderDate: z.string().min(1, '必填'),
  requestedDate: z.string().optional(),
  shippingAddress: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, '至少需要一個品項'),
});

type FormData = z.infer<typeof schema>;

export default function NewSalesOrderPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const { data: customersData } = useQuery({
    queryKey: ['customers-select'],
    queryFn: () => salesApi.customers.list({ perPage: 100, isActive: true }),
  });

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      orderDate: new Date().toISOString().split('T')[0],
      currency: 'TWD',
      lines: [{ lineNo: 1, itemCode: '', itemName: '', unit: 'PCS', quantity: 1, unitPrice: 0, discount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = watch('lines');

  // Auto-generate order number
  useEffect(() => {
    const today = new Date();
    const yymm = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    setValue('orderNo', `SO-${yymm}-${String(Math.floor(Math.random() * 9000) + 1000)}`);
  }, [setValue]);

  // Calculate totals
  const subtotal = lines?.reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    const disc = Number(line.discount) || 0;
    return sum + qty * price * (1 - disc / 100);
  }, 0) ?? 0;
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const createMutation = useMutation({
    mutationFn: (data: CreateSalesOrderPayload) => salesApi.orders.create(data),
    onSuccess: (order) => router.push(`/sales/orders/${order.id}`),
    onError: (err: Error) => setError(err.message),
  });

  const onSubmit = (data: FormData) => {
    setError(null);
    createMutation.mutate(data as CreateSalesOrderPayload);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">新增銷售訂單</h2>
          <p className="text-sm text-muted-foreground">填寫訂單資訊與品項</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Order Info Card */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground text-sm">訂單基本資訊</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">訂單編號 *</label>
              <Input {...register('orderNo')} />
              {errors.orderNo && <p className="text-xs text-destructive">{errors.orderNo.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">客戶 *</label>
              <select
                className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('customerId')}
              >
                <option value="">-- 選擇客戶 --</option>
                {customersData?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
              {errors.customerId && <p className="text-xs text-destructive">{errors.customerId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">訂單日期 *</label>
              <Input type="date" {...register('orderDate')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">要求交期</label>
              <Input type="date" {...register('requestedDate')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">備註</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="訂單備註..."
              {...register('notes')}
            />
          </div>
        </div>

        {/* Lines Card */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">訂單品項</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  lineNo: fields.length + 1,
                  itemCode: '',
                  itemName: '',
                  unit: 'PCS',
                  quantity: 1,
                  unitPrice: 0,
                  discount: 0,
                })
              }
            >
              <Plus size={14} /> 新增品項
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => {
              const qty = Number(lines?.[idx]?.quantity) || 0;
              const price = Number(lines?.[idx]?.unitPrice) || 0;
              const disc = Number(lines?.[idx]?.discount) || 0;
              const lineAmt = qty * price * (1 - disc / 100);

              return (
                <div key={field.id} className="rounded-lg border border-border/50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">品項 {idx + 1}</span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">料號 *</label>
                      <Input placeholder="ITEM-001" {...register(`lines.${idx}.itemCode`)} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 space-y-1">
                      <label className="text-xs text-muted-foreground">品名 *</label>
                      <Input placeholder="品名描述" {...register(`lines.${idx}.itemName`)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">單位</label>
                      <Input placeholder="PCS" {...register(`lines.${idx}.unit`)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">數量 *</label>
                      <Input type="number" step="0.0001" {...register(`lines.${idx}.quantity`)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">單價</label>
                      <Input type="number" step="0.01" {...register(`lines.${idx}.unitPrice`)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">折扣 (%)</label>
                      <Input type="number" step="0.01" min="0" max="100" {...register(`lines.${idx}.discount`)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">小計</label>
                      <div className="flex h-9 items-center px-3 rounded-md border border-border/50 bg-muted/30 text-sm font-medium text-foreground">
                        {lineAmt.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-2">
            <div className="flex justify-end gap-8 text-sm">
              <div className="text-right space-y-1">
                <div className="flex gap-8 justify-between text-muted-foreground">
                  <span>小計</span>
                  <span>TWD {subtotal.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex gap-8 justify-between text-muted-foreground">
                  <span>稅額 (5%)</span>
                  <span>TWD {tax.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex gap-8 justify-between font-semibold text-foreground text-base border-t border-border pt-2">
                  <span>合計</span>
                  <span>TWD {total.toLocaleString('zh-TW', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            建立訂單
          </Button>
        </div>
      </form>
    </div>
  );
}
