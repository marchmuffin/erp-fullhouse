'use client';

import { useState } from 'react';
import { Download, HardDrive, Info } from 'lucide-react';
import { adminApi } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';

export default function AdminSystemPage() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [backupError, setBackupError] = useState('');

  async function handleDownloadBackup() {
    setBackupLoading(true);
    setBackupStatus('idle');
    setBackupError('');
    try {
      const { data, filename } = await adminApi.backup.download();
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus('success');
    } catch (e: any) {
      setBackupStatus('error');
      setBackupError(e.message ?? '下載失敗');
    } finally {
      setBackupLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">系統管理</h2>
        <p className="text-sm text-muted-foreground mt-0.5">系統維護與管理工具</p>
      </div>

      {/* Database Backup Card */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <HardDrive size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">資料庫備份</h3>
            <p className="text-sm text-muted-foreground mt-1">
              匯出完整資料庫備份檔案 (.sql)。備份包含所有租戶資料、用戶資料及系統設定。
            </p>
            <div className="flex items-center gap-3 mt-4">
              <Button onClick={handleDownloadBackup} disabled={backupLoading}>
                <Download size={14} />
                {backupLoading ? '備份中...' : '下載備份'}
              </Button>
              {backupStatus === 'success' && (
                <span className="text-sm text-emerald-400 animate-in fade-in">備份已下載</span>
              )}
              {backupStatus === 'error' && (
                <span className="text-sm text-destructive">{backupError}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* System Info Card */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center flex-shrink-0">
            <Info size={18} className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground">系統資訊</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">版本</p>
                <p className="text-sm font-medium text-foreground">1.0.0</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">環境</p>
                <p className="text-sm font-medium text-foreground">Production</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">資料庫</p>
                <p className="text-sm font-medium text-foreground">PostgreSQL</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">框架</p>
                <p className="text-sm font-medium text-foreground">NestJS + Next.js</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
