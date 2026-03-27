'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { bpmApi } from '@/lib/api/bpm';
import type { WorkflowDefinition } from '@/lib/api/bpm';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const MODULE_VARIANT: Record<
  string,
  'success' | 'warning' | 'info' | 'secondary' | 'outline' | 'destructive'
> = {
  sales: 'success',
  procurement: 'warning',
  hr: 'info' as any,
  finance: 'secondary',
  manufacturing: 'outline',
  quality: 'destructive',
};

const MODULE_LABEL: Record<string, string> = {
  sales: '銷售',
  procurement: '採購',
  hr: '人資',
  finance: '財務',
  manufacturing: '製造',
  quality: '品質',
};

const DOC_TYPE_LABEL: Record<string, string> = {
  so: '銷售訂單',
  po: '採購訂單',
  pr: '請購單',
  leave: '請假單',
  payroll: '薪資單',
  wo: '工單',
  inspection: '檢驗單',
};

const createSchema = z.object({
  code: z.string().min(1, '請輸入流程代碼').max(50),
  name: z.string().min(1, '請輸入流程名稱').max(200),
  module: z.string().min(1, '請選擇模組'),
  docType: z.string().min(1, '請輸入文件類型'),
  steps: z.coerce.number().int().min(1).max(5).optional(),
  description: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

const COLUMNS: Column<WorkflowDefinition>[] = [
  { key: 'code', header: '流程代碼', width: 'w-36' },
  { key: 'name', header: '流程名稱', width: 'w-48' },
  {
    key: 'module',
    header: '模組',
    width: 'w-24',
    render: (r) => (
      <Badge variant={(MODULE_VARIANT[r.module] ?? 'secondary') as any}>
        {MODULE_LABEL[r.module] ?? r.module}
      </Badge>
    ),
  },
  {
    key: 'docType',
    header: '文件類型',
    width: 'w-28',
    render: (r) => (
      <span className="text-sm">{DOC_TYPE_LABEL[r.docType] ?? r.docType}</span>
    ),
  },
  {
    key: 'steps',
    header: '審核步驟數',
    width: 'w-24',
    render: (r) => (
      <span className="font-mono text-sm">{r.steps}</span>
    ),
  },
  {
    key: 'isActive',
    header: '狀態',
    width: 'w-20',
    render: (r) => (
      <Badge variant={r.isActive ? 'success' : 'secondary'}>
        {r.isActive ? '啟用' : '停用'}
      </Badge>
    ),
  },
  {
    key: 'description',
    header: '說明',
    render: (r) => (
      <span className="text-sm text-muted-foreground truncate max-w-xs block">
        {r.description ?? '--'}
      </span>
    ),
  },
];

export default function DefinitionsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['bpm-definitions', page],
    queryFn: () => bpmApi.definitions.list({ page, perPage: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateForm) =>
      bpmApi.definitions.create({ ...d, steps: d.steps ?? 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bpm-definitions'] });
      qc.invalidateQueries({ queryKey: ['bpm-stats'] });
      setShowCreate(false);
      reset();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { steps: 1 },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">流程定義</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {data?.meta.total ?? 0} 個流程定義
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ['bpm-definitions'] })}
          >
            <RefreshCw size={14} />
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} /> 新增流程定義
          </Button>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        emptyMessage="尚無流程定義，請先新增"
      />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增流程定義</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((d) => createMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">流程代碼 *</label>
                <Input placeholder="WF-PO-001" {...register('code')} />
                {errors.code && (
                  <p className="text-xs text-destructive">{errors.code.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">審核步驟數</label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  placeholder="1"
                  {...register('steps')}
                />
                {errors.steps && (
                  <p className="text-xs text-destructive">{errors.steps.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">流程名稱 *</label>
              <Input placeholder="採購單審核流程" {...register('name')} />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">模組 *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  {...register('module')}
                >
                  <option value="">請選擇...</option>
                  <option value="sales">銷售 Sales</option>
                  <option value="procurement">採購 Procurement</option>
                  <option value="hr">人資 HR</option>
                  <option value="finance">財務 Finance</option>
                  <option value="manufacturing">製造 Manufacturing</option>
                  <option value="quality">品質 Quality</option>
                </select>
                {errors.module && (
                  <p className="text-xs text-destructive">{errors.module.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">文件類型 *</label>
                <Input placeholder="po / pr / leave..." {...register('docType')} />
                {errors.docType && (
                  <p className="text-xs text-destructive">{errors.docType.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">說明</label>
              <Input placeholder="流程說明（選填）" {...register('description')} />
            </div>

            {createMutation.error && (
              <p className="text-sm text-destructive">
                {(createMutation.error as Error).message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  reset();
                }}
              >
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? '建立中...' : '建立流程'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
