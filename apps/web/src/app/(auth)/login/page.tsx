import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Login',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-20" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">E</span>
            </div>
            <span className="text-2xl font-bold text-gradient">ERP 全家桶</span>
          </div>
          <p className="text-muted-foreground text-sm">Enterprise Resource Planning Platform</p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-xl p-8 shadow-2xl">
          <h1 className="text-xl font-semibold text-foreground mb-6">登入系統</h1>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} ERP 全家桶. All rights reserved.
        </p>
      </div>
    </div>
  );
}
