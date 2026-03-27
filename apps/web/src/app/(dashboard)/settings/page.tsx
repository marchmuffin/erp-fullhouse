'use client';

import { useState } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'profile' | 'system' | 'notifications';

// ---------------------------------------------------------------------------
// Toggle switch wrapper (Radix)
// ---------------------------------------------------------------------------

interface SwitchProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function Switch({ id, checked, onCheckedChange }: SwitchProps) {
  return (
    <RadixSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <RadixSwitch.Thumb
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </RadixSwitch.Root>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Profile
// ---------------------------------------------------------------------------

function ProfileTab() {
  const user = useAuthStore((s) => s.user);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [language, setLanguage]       = useState(user?.locale ?? 'zh-TW');
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [pwSaved, setPwSaved]       = useState(false);
  const [pwError, setPwError]       = useState('');

  function handleSaveProfile() {
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  }

  function handleChangePassword() {
    setPwError('');
    if (!currentPw || !newPw || !confirmPw) {
      setPwError('請填寫所有密碼欄位');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('新密碼與確認密碼不符');
      return;
    }
    if (newPw.length < 8) {
      setPwError('新密碼至少需要 8 個字元');
      return;
    }
    setPwSaved(true);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setTimeout(() => setPwSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="glass rounded-xl p-6 space-y-5">
        <h3 className="text-base font-semibold text-foreground">基本資料</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="displayName" className="text-sm text-muted-foreground">顯示名稱</label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="顯示名稱"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm text-muted-foreground">電子郵件</label>
            <Input
              id="email"
              type="email"
              value={user?.email ?? ''}
              readOnly
              disabled
              className="cursor-not-allowed"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="language" className="text-sm text-muted-foreground">語言</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex h-9 w-full sm:w-48 rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="zh-TW">繁體中文 (zh-TW)</option>
            <option value="en">English (en)</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSaveProfile}>儲存變更</Button>
          {profileSaved && (
            <span className="text-sm text-emerald-400 animate-in fade-in">已儲存</span>
          )}
        </div>
      </div>

      {/* Change password */}
      <div className="glass rounded-xl p-6 space-y-5">
        <h3 className="text-base font-semibold text-foreground">變更密碼</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="currentPw" className="text-sm text-muted-foreground">目前密碼</label>
            <Input
              id="currentPw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="newPw" className="text-sm text-muted-foreground">新密碼</label>
            <Input
              id="newPw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirmPw" className="text-sm text-muted-foreground">確認新密碼</label>
            <Input
              id="confirmPw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        {pwError && <p className="text-sm text-destructive">{pwError}</p>}

        <div className="flex items-center gap-3 pt-1">
          <Button variant="outline" onClick={handleChangePassword}>變更密碼</Button>
          {pwSaved && (
            <span className="text-sm text-emerald-400 animate-in fade-in">密碼已更新</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: System
// ---------------------------------------------------------------------------

function SystemTab() {
  const user = useAuthStore((s) => s.user);
  const [darkMode, setDarkMode] = useState(true);
  const [language, setLanguage] = useState(user?.locale ?? 'zh-TW');

  return (
    <div className="space-y-6">
      {/* Tenant info */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">租戶資訊</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">租戶名稱</p>
            <p className="text-sm font-medium text-foreground">
              {user?.tenantName ?? '—'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">方案</p>
            <p className="text-sm font-medium text-foreground">Professional</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">狀態</p>
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/40 bg-emerald-400/10 w-fit">
              啟用中
            </Badge>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">試用到期日</p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}
            </p>
          </div>
        </div>
      </div>

      {/* Theme */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">外觀主題</h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">深色模式</p>
            <p className="text-xs text-muted-foreground mt-0.5">使用深色介面配色</p>
          </div>
          <Switch
            id="darkMode"
            checked={darkMode}
            onCheckedChange={setDarkMode}
          />
        </div>
      </div>

      {/* Language */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">語言設定</h3>

        <div className="space-y-1.5">
          <label htmlFor="sysLanguage" className="text-sm text-muted-foreground">系統語言</label>
          <select
            id="sysLanguage"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex h-9 w-full sm:w-48 rounded-md border border-border bg-input px-3 py-1 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <option value="zh-TW">繁體中文 (zh-TW)</option>
            <option value="en">English (en)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Notifications
// ---------------------------------------------------------------------------

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationSetting[] = [
  { id: 'po_approval',    label: '採購訂單核准通知',   description: '當採購訂單完成核准流程時通知您',         enabled: true },
  { id: 'so_status',      label: '銷售訂單狀態更新',   description: '當銷售訂單狀態變更時通知您',             enabled: true },
  { id: 'low_stock',      label: '庫存低水位警示',     description: '當品項庫存低於安全水位時發出警示',       enabled: true },
  { id: 'leave_approval', label: '假單審核通知',       description: '當有請假申請需要您審核時通知您',         enabled: true },
  { id: 'maintenance',    label: '系統維護通知',       description: '在系統維護作業前預先通知您',             enabled: true },
];

function NotificationsTab() {
  const [settings, setSettings] = useState<NotificationSetting[]>(INITIAL_NOTIFICATIONS);
  const [saved, setSaved] = useState(false);

  function toggle(id: string, checked: boolean) {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: checked } : s)),
    );
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6 space-y-5">
        <h3 className="text-base font-semibold text-foreground">通知偏好設定</h3>

        <div className="space-y-4">
          {settings.map((setting) => (
            <div
              key={setting.id}
              className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
            >
              <div className="flex-1 min-w-0 pr-4">
                <label
                  htmlFor={`notif-${setting.id}`}
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  {setting.label}
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
              </div>
              <Switch
                id={`notif-${setting.id}`}
                checked={setting.enabled}
                onCheckedChange={(checked) => toggle(setting.id, checked)}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Button onClick={handleSave}>儲存通知設定</Button>
          {saved && (
            <span className="text-sm text-emerald-400 animate-in fade-in">已儲存</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile',       label: '個人資料' },
  { id: 'system',        label: '系統設定' },
  { id: 'notifications', label: '通知設定' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">設定</h2>
        <p className="text-muted-foreground text-sm mt-1">管理您的帳號偏好與系統設定</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 p-1 glass rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile'       && <ProfileTab />}
      {activeTab === 'system'        && <SystemTab />}
      {activeTab === 'notifications' && <NotificationsTab />}
    </div>
  );
}
