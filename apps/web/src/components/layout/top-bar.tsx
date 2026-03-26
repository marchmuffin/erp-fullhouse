'use client';

import { Bell, Search, Globe } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': '儀表板',
  '/procurement': '採購管理',
  '/sales': '銷售管理',
  '/inventory': '庫存管理',
  '/manufacturing': '生產管理',
  '/finance': '財務管理',
  '/hr': '人力資源',
  '/crm': '客戶關係管理',
  '/quality': '品質管理',
  '/bi': '商業智能',
  '/bpm': '流程管理',
  '/pos': 'POS 銷售',
  '/settings': '系統設定',
};

export function TopBar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const pageTitle = PAGE_TITLES[pathname] ||
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ||
    'ERP 全家桶';

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Search size={14} />
          <span className="hidden md:inline">搜尋...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-background border border-border text-muted-foreground font-mono">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
        </button>

        {/* Language toggle */}
        <button className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Globe size={18} />
        </button>

        {/* User avatar */}
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary text-sm font-semibold">
                {user.displayName?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
