'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingCart, Package, TrendingUp,
  Factory, DollarSign, Users, Headphones, CheckCircle,
  BarChart3, GitBranch, ShoppingBag, Settings, ChevronLeft,
  ChevronRight, LogOut, UserCog, Building2, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

interface NavItem {
  label: string;
  labelEn: string;
  href: string;
  icon: React.ElementType;
  module?: string;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: '儀表板', labelEn: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: '採購管理', labelEn: 'Procurement', href: '/procurement', icon: ShoppingCart, module: 'procurement' },
  { label: '銷售管理', labelEn: 'Sales', href: '/sales', icon: TrendingUp, module: 'sales' },
  { label: '庫存管理', labelEn: 'Inventory', href: '/inventory', icon: Package, module: 'inventory' },
  { label: '生產管理', labelEn: 'Manufacturing', href: '/manufacturing', icon: Factory, module: 'manufacturing' },
  { label: '財務管理', labelEn: 'Finance', href: '/finance', icon: DollarSign, module: 'finance' },
  { label: '人力資源', labelEn: 'HR', href: '/hr', icon: Users, module: 'hr' },
  { label: '客戶關係', labelEn: 'CRM', href: '/crm', icon: Headphones, module: 'crm' },
  { label: '品質管理', labelEn: 'Quality', href: '/quality', icon: CheckCircle, module: 'quality' },
  { label: '商業智能', labelEn: 'BI', href: '/bi', icon: BarChart3, module: 'bi' },
  { label: '流程管理', labelEn: 'BPM', href: '/bpm', icon: GitBranch, module: 'bpm' },
  { label: 'POS 銷售', labelEn: 'POS', href: '/pos', icon: ShoppingBag, module: 'pos' },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <span className="text-primary font-bold">E</span>
        </div>
        {!collapsed && (
          <span className="ml-3 font-bold text-gradient truncate">ERP 全家桶</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                isActive
                  ? 'bg-primary/15 text-primary border border-primary/20'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                size={18}
                className={cn(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Admin section — visible to admins/superadmin */}
      {(user?.isSuperAdmin || user?.permissions?.includes('user:view')) && (
        <div className="px-2 pt-2 space-y-1">
          {!collapsed && (
            <div className="px-3 pt-3 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">管理後台</p>
            </div>
          )}
          <Link href="/admin/users" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
            pathname.startsWith('/admin/users') ? 'bg-primary/15 text-primary border border-primary/20' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
          )} title={collapsed ? '用戶管理' : undefined}>
            <UserCog size={18} className={cn('flex-shrink-0', pathname.startsWith('/admin/users') ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
            {!collapsed && <span className="truncate">用戶管理</span>}
          </Link>
          {user?.isSuperAdmin && (
            <>
              <Link href="/admin/tenants" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                pathname.startsWith('/admin/tenants') ? 'bg-primary/15 text-primary border border-primary/20' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
              )} title={collapsed ? '租戶管理' : undefined}>
                <Building2 size={18} className={cn('flex-shrink-0', pathname.startsWith('/admin/tenants') ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                {!collapsed && <span className="truncate">租戶管理</span>}
              </Link>
              <Link href="/admin/system" className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                pathname.startsWith('/admin/system') ? 'bg-primary/15 text-primary border border-primary/20' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
              )} title={collapsed ? '系統管理' : undefined}>
                <Database size={18} className={cn('flex-shrink-0', pathname.startsWith('/admin/system') ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                {!collapsed && <span className="truncate">系統管理</span>}
              </Link>
            </>
          )}
        </div>
      )}

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
          )}
        >
          <Settings size={18} className="flex-shrink-0 text-muted-foreground" />
          {!collapsed && <span>系統設定</span>}
        </Link>

        {/* User info */}
        {!collapsed && user && (
          <div className="px-3 py-2 rounded-lg bg-sidebar-accent/50">
            <p className="text-xs font-medium text-foreground truncate">{user.displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>登出</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors shadow-sm z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </div>
  );
}
