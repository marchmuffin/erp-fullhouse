'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { salesApi, type Customer, type CreateCustomerPayload } from '@/lib/api/sales';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const GRADE_LABELS: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'destructive' }> = {
  A: { label: 'A 級', variant: 'success' },
  B: { label: 'B 級', variant: 'info' },
  C: { label: 'C 級', variant: 'warning' },
  D: { label: 'D 級', variant: 'destructive' },
};

const createCustomerSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  creditLimit: z.coerce.number().min(0).optional(),
  paymentTerms: z.coerce.number().min(0).optional(),
  grade: z.enum(['A', 'B', 'C', 'D']).optional(),
  currency: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type CreateForm = z.infer<typeof createCustomerSchema>;

const COLUMNS: Column<Customer>[] = [
  { key: 'code', header: '客戶代碼', width: 'w-32' },
  { key: 'name', header: '客戶名稱' },
  {
    key: 'grade',
    header: '等級',
    width: 'w-20',
    render: (row) => {
      const g = GRADE_LABELS[row.grade] ?? { label: row.grade, variant: 'outline' as const };
      return <Badge variant={g.variant as any}>{g.label}</Badge>;
    },
  },
  {
    key: 'creditLimit',
    header: '信用額度',
    width: 'w-36',
    render: (row) =>
      `NT$ ${Number(row.creditLimit).toLocaleString()}`,
  },
  {
    key: 'paymentTerms',
    header: '付款條件',
    width: 'w-28',
    render: (row) => `Net ${row.paymentTerms}`,
  },
  { key: 'contactPhone', header: '聯絡電話', width: 'w-36' },
  {
    key: 'isActive',
    header: '狀態',
    width: 'w-20',
    render: (row) => (
      <Badge variant={row.isActive ? 'success' : 'secondary'}>
        {row.isActive ? '啟用' : '停用'}
      </Badge>
    ),
  },
];

export default function CustomersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => salesApi.customers.list({ page, perPage: 20, search: search || undefined }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCustomerPayload) => salesApi.customers.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowCreate(false);
      reset();
    },
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: { grade: 'C', paymentTerms: 30, currency: 'TWD' },
  });

  const onSubmit = (data: CreateForm) => createMutation.mutate(data as CreateCustomerPayload);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">客戶管理</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {data?.meta.total ?? 0} 位客戶
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> 新增客戶
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋客戶代碼、名稱..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { setSearch(searchInput); setPage(1); }
            }}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/sales/customers/${row.id}`)}
        emptyMessage="尚無客戶資料，請點擊「新增客戶」建立"
      />

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新增客戶</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">客戶代碼 *</label>
                <Input placeholder="CUST001" {...register('code')} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">等級</label>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register('grade')}
                >
                  <option value="A">A 級</option>
                  <option value="B">B 級</option>
                  <option value="C">C 級</option>
                  <option value="D">D 級</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">客戶名稱 *</label>
              <Input placeholder="ABC Trading Co." {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">聯絡人</label>
                <Input placeholder="王大明" {...register('contactName')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">聯絡電話</label>
                <Input placeholder="+886-2-12345678" {...register('contactPhone')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">信用額度</label>
                <Input type="number" placeholder="0" {...register('creditLimit')} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">付款條件 (天)</label>
                <Input type="number" placeholder="30" {...register('paymentTerms')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                placeholder="備註..."
                {...register('notes')}
              />
            </div>
            {createMutation.error && (
              <p className="text-sm text-destructive">{(createMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                {createMutation.isPending ? '儲存中...' : '建立客戶'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
