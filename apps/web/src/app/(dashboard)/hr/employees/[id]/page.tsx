'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, Building2, Calendar, DollarSign } from 'lucide-react';
import { hrApi } from '@/lib/api/hr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  active: { label: '在職', variant: 'success' },
  on_leave: { label: '請假中', variant: 'warning' },
  terminated: { label: '已離職', variant: 'secondary' },
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: '特休',
  sick: '病假',
  personal: '事假',
  unpaid: '無薪假',
};

const LEAVE_STATUS_MAP: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  pending: { label: '待審核', variant: 'warning' },
  approved: { label: '已核准', variant: 'success' },
  rejected: { label: '已拒絕', variant: 'destructive' },
  cancelled: { label: '已取消', variant: 'secondary' },
};

const ATTENDANCE_STATUS_MAP: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' | 'info' }> = {
  present: { label: '出勤', variant: 'success' },
  absent: { label: '缺勤', variant: 'destructive' },
  late: { label: '遲到', variant: 'warning' },
  half_day: { label: '半天', variant: 'info' },
  on_leave: { label: '請假', variant: 'secondary' },
};

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => hrApi.employees.get(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground text-sm">載入中...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground text-sm">員工不存在</div>
      </div>
    );
  }

  const status = STATUS_MAP[employee.status] ?? { label: employee.status, variant: 'secondary' as const };
  const recentAttendances = (employee.attendances ?? []).slice(0, 14);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft size={14} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">
              {employee.lastName}{employee.firstName}
            </h2>
            <Badge variant={status.variant as any}>{status.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{employee.empNo}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <User size={16} className="text-blue-400" /> 基本資料
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-foreground">{employee.email || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">電話</span>
              <span className="text-foreground">{employee.phone || '-'}</span>
            </div>
          </div>
        </div>

        {/* Work Info */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 size={16} className="text-emerald-400" /> 職務資料
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">部門</span>
              <span className="text-foreground">{employee.department || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">職位</span>
              <span className="text-foreground">{employee.position || '-'}</span>
            </div>
          </div>
        </div>

        {/* Hire Info */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar size={16} className="text-amber-400" /> 任職資訊
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">入職日期</span>
              <span className="text-foreground">
                {new Date(employee.hireDate).toLocaleDateString('zh-TW')}
              </span>
            </div>
            {employee.terminateDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">離職日期</span>
                <span className="text-foreground">
                  {new Date(employee.terminateDate).toLocaleDateString('zh-TW')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Salary Info */}
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <DollarSign size={16} className="text-purple-400" /> 薪資資訊
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">薪資</span>
              <span className="text-foreground">
                NT$ {Number(employee.salary).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">薪資類型</span>
              <span className="text-foreground">
                {employee.salaryType === 'monthly' ? '月薪' : '時薪'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Leave Requests */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">近期假單</h3>
        {(employee.leaveRequests ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無假單紀錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">假別</th>
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">開始日期</th>
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">結束日期</th>
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">天數</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {(employee.leaveRequests ?? []).map((leave) => {
                  const ls = LEAVE_STATUS_MAP[leave.status] ?? { label: leave.status, variant: 'secondary' as const };
                  return (
                    <tr key={leave.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-foreground">
                        {LEAVE_TYPE_LABELS[leave.leaveType] ?? leave.leaveType}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {new Date(leave.startDate).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {new Date(leave.endDate).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="py-2 pr-4 text-foreground">{Number(leave.days)} 天</td>
                      <td className="py-2">
                        <Badge variant={ls.variant as any}>{ls.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Attendance */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">近 14 天出勤紀錄</h3>
        {recentAttendances.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚無出勤紀錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">日期</th>
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">上班時間</th>
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">下班時間</th>
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium">工時</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {recentAttendances.map((att) => {
                  const as_ = ATTENDANCE_STATUS_MAP[att.status] ?? { label: att.status, variant: 'secondary' as const };
                  return (
                    <tr key={att.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-foreground">
                        {new Date(att.date).toLocaleDateString('zh-TW')}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {att.checkIn ? new Date(att.checkIn).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {att.checkOut ? new Date(att.checkOut).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="py-2 pr-4 text-foreground">
                        {att.hoursWorked != null ? `${Number(att.hoursWorked).toFixed(1)} hr` : '-'}
                      </td>
                      <td className="py-2">
                        <Badge variant={as_.variant as any}>{as_.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
