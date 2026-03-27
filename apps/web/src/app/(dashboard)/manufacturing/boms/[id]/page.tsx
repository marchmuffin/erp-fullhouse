'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { manufacturingApi } from '@/lib/api/manufacturing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/utils';

interface AddLineForm {
  componentId: string;
  quantity: string;
  unit: string;
  notes: string;
}

export default function BomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['bom-detail', id] });

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [lineForm, setLineForm] = useState<AddLineForm>({ componentId: '', quantity: '', unit: 'PCS', notes: '' });
  const [lineFormError, setLineFormError] = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const { data: bom, isLoading } = useQuery({
    queryKey: ['bom-detail', id],
    queryFn: () => manufacturingApi.boms.get(id),
  });

  const addLineMut = useMutation({
    mutationFn: () =>
      manufacturingApi.boms.addLine(id, {
        componentId: lineForm.componentId,
        quantity: Number(lineForm.quantity),
        unit: lineForm.unit,
        notes: lineForm.notes || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setLineDialogOpen(false);
      setLineForm({ componentId: '', quantity: '', unit: 'PCS', notes: '' });
      setLineFormError('');
    },
    onError: (err: Error) => setLineFormError(err.message),
  });

  const deactivateMut = useMutation({
    mutationFn: () => manufacturingApi.boms.update(id, { isActive: false }),
    onSuccess: () => {
      invalidate();
      setConfirmDeactivate(false);
    },
  });

  const handleAddLine = () => {
    if (!lineForm.componentId.trim()) { setLineFormError('請填入組件料號ID'); return; }
    if (!lineForm.quantity || isNaN(Number(lineForm.quantity)) || Number(lineForm.quantity) <= 0) {
      setLineFormError('請填入有效的數量');
      return;
    }
    if (!lineForm.unit.trim()) { setLineFormError('請填入單位'); return; }
    setLineFormError('');
    addLineMut.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!bom) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">
                {bom.item ? `${bom.item.code} · ${bom.item.name}` : bom.itemId}
              </h2>
              <span className="font-mono text-sm text-muted-foreground">v{bom.version}</span>
              <Badge variant={bom.isActive ? 'success' : 'secondary'}>
                {bom.isActive ? '啟用' : '停用'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">更新於 {formatDateTime(bom.updatedAt)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {bom.isActive && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLineDialogOpen(true)}
              >
                <Plus size={14} /> 新增組件
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setConfirmDeactivate(true)}
              >
                停用BOM
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {bom.description && (
        <div className="glass rounded-xl p-5">
          <p className="text-sm text-muted-foreground">{bom.description}</p>
        </div>
      )}

      {/* BOM Lines */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">組件清單</h3>
        {!bom.lines || bom.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">尚未加入任何組件</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['序號', '料號', '品名', '數量', '單位', '備註'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bom.lines.map((line) => (
                  <tr key={line.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2.5 text-muted-foreground">{line.lineNo}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {line.component?.code ?? line.componentId}
                    </td>
                    <td className="px-3 py-2.5">{line.component?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 font-medium">{Number(line.quantity).toLocaleString()}</td>
                    <td className="px-3 py-2.5">{line.unit}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{line.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Line Dialog */}
      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增組件</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">組件料號ID <span className="text-destructive">*</span></label>
              <Input
                placeholder="請輸入組件料號ID"
                value={lineForm.componentId}
                onChange={(e) => setLineForm({ ...lineForm, componentId: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">數量 <span className="text-destructive">*</span></label>
                <Input
                  type="number"
                  placeholder="0"
                  min="0"
                  step="any"
                  value={lineForm.quantity}
                  onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">單位 <span className="text-destructive">*</span></label>
                <Input
                  placeholder="PCS"
                  value={lineForm.unit}
                  onChange={(e) => setLineForm({ ...lineForm, unit: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">備註</label>
              <Input
                placeholder="備註（選填）"
                value={lineForm.notes}
                onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })}
              />
            </div>
            {lineFormError && <p className="text-sm text-destructive">{lineFormError}</p>}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={handleAddLine} disabled={addLineMut.isPending}>
              {addLineMut.isPending ? '新增中...' : '新增組件'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm Dialog */}
      <Dialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認停用BOM</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            停用後此BOM將無法用於新工單，確定要停用嗎？
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => deactivateMut.mutate()}
              disabled={deactivateMut.isPending}
            >
              {deactivateMut.isPending ? '停用中...' : '確認停用'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
