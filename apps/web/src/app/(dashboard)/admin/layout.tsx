'use client';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  const router = useRouter();

  useEffect(() => {
    // Allow super admins and users with user:view permission
    if (user && !user.isSuperAdmin && !user.permissions?.includes('user:view')) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  return <>{children}</>;
}
