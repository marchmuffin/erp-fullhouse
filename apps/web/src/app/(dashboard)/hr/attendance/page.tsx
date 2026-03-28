'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { hrApi, type Attendance } from '@/lib/api/hr';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { formatDate } from '@/lib/utils';

const STATUS_MAP: Record<string, { label: string; variant: any }> = {
  present: { label: '出勤', variant: 'success' },
  absent: { label: '缺勤', variant: 'destructive' },
  late: { label: '遲到', variant: 'warning' },
  half_day: { label: '半天', variant: 'info' },
  on_leave: { label: '請假', variant: 'secondary' },
};

const checkInSchema = z.object({
  employeeId: z.string().min(1, '必填'),
});
const checkOutSchema = z.object({
  employeeId: z.string().min(1, '必填'),
});

type CheckForm = z.infer<typeof checkInSchema>;

function formatTime(dateStr?: string) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

const COLUMNS: Column<Attendance>[] = [
  {
    key: 'employeeId', header: '員工', width: 'w-36',
    render: (r: any) => r.employee
      ? <span>{r.employee.empNo} {r.employee.lastName}{r.employee.firstName}</span>
      : r.employeeId,
  },
  {
    key: 'date', header: '日期', width: 'w-28',
    render: (r) => formatDate(r.date),
  },
  {
    key: 'checkIn', header: '上班打卡', width: 'w-28',
    render: (r) => formatTime(r.checkIn),
  },
  {
    key: 'checkOut', header: '下班打卡', width: 'w-28',
    render: (r) => formatTime(r.checkOut),
  },
  {
    key: 'hoursWorked', header: '工時', width: 'w-20',
    render: (r) => r.hoursWorked != null ? `${r.hoursWorked}h` : '-',
  },
  {
    key: 'status', header: '狀態', width: 'w-24',
    render: (r) => {
      const m = STATUS_MAP[r.status] ?? { label: r.status, variant: 'secondary' };
      return <Badge variant={m.variant}>{m.label}</Badge>;
    },
  },
];

export default function AttendancePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const today = new Date().toISOString().split('T')[0];
  const [dateFilter, setDateFilter] = useState(today);
  const [employeeIdFilter, setEmployeeIdFilter] = useState('');
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hr-attendance', page, dateFilter, employeeIdFilter],
    queryFn: () =>
      hrApi.attendance.list({
        page,
        perPage: 20,
        fromDate: dateFilter || undefined,
        toDate: dateFilter || undefined,
        employeeId: employeeIdFilter || undefined,
      }),
  });

  const checkInMutation = useMutation({
    mutationFn: (employeeId: string) => hrApi.attendance.checkIn(employeeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-attendance'] });
      setShowCheckIn(false);
      resetCheckIn();
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (employeeId: string) => hrApi.attendance.checkOut(employeeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-attendance'] });
      setShowCheckOut(false);
      resetCheckOut();
    },
  });

  const {
    register: registerCheckIn,
    handleSubmit: handleCheckIn,
    reset: resetCheckIn,
    formState: { errors: checkInErrors },
  } = useForm<CheckForm>({ resolver: zodResolver(checkInSchema) });

  const {
    register: registerCheckOut,
    handleSubmit: handleCheckOut,
    reset: resetCheckOut,
    formState: { errors: checkOutErrors },
  } = useForm<CheckForm>({ resolver: zodResolver(checkOutSchema) });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">出勤紀錄</h2>
          <p className="text-sm text-muted-foreground mt-0.5">共 {data?.meta?.total ?? 0} 筆</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ['hr-attendance'] })}>
            <RefreshCw size={14} />
          </Button>
          <Button variant="outline" onClick={() => setShowCheckIn(true)}>
            打卡上班
          </Button>
          <Button onClick={() => setShowCheckOut(true)}>
            打卡下班
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">日期</label>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">員工ID</label>
          <div className="flex gap-2">
            <Input
              placeholder="搜尋員工ID..."
              value={employeeIdInput}
              onChange={(e) => setEmployeeIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { setEmployeeIdFilter(employeeIdInput); setPage(1); }
              }}
              className="w-48"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEmployeeIdFilter(employeeIdInput); setPage(1); }}
            >
              搜尋
            </Button>
          </div>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={(data?.data as any) ?? []}
        meta={data?.meta}
        loading={isLoading}
        onPageChange={setPage}
        emptyMessage="尚無出勤紀錄"
      />

      {/* Check-in Dialog */}
      <Dialog open={showCheckIn} onOpenChange={setShowCheckIn}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>打卡上班</DialogTitle></DialogHeader>
          <form onSubmit={handleCheckIn((d) => checkInMutation.mutate(d.employeeId))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">員工ID *</label>
              <Input placeholder="emp-uuid" {...registerCheckIn('employeeId')} />
              {checkInErrors.employeeId && (
                <p className="text-xs text-destructive">{checkInErrors.employeeId.message}</p>
              )}
            </div>
            {checkInMutation.error && (
              <p className="text-sm text-destructive">{(checkInMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCheckIn(false)}>取消</Button>
              <Button type="submit" disabled={checkInMutation.isPending}>
                {checkInMutation.isPending ? '打卡中...' : '確認上班'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Check-out Dialog */}
      <Dialog open={showCheckOut} onOpenChange={setShowCheckOut}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>打卡下班</DialogTitle></DialogHeader>
          <form onSubmit={handleCheckOut((d) => checkOutMutation.mutate(d.employeeId))} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">員工ID *</label>
              <Input placeholder="emp-uuid" {...registerCheckOut('employeeId')} />
              {checkOutErrors.employeeId && (
                <p className="text-xs text-destructive">{checkOutErrors.employeeId.message}</p>
              )}
            </div>
            {checkOutMutation.error && (
              <p className="text-sm text-destructive">{(checkOutMutation.error as Error).message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCheckOut(false)}>取消</Button>
              <Button type="submit" disabled={checkOutMutation.isPending}>
                {checkOutMutation.isPending ? '打卡中...' : '確認下班'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
