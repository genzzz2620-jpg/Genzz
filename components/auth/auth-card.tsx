'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type AuthCardProps = {
  mode: 'login' | 'register';
};

export function AuthCard({ mode }: AuthCardProps) {
  const isLogin = mode === 'login';
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showDevelopmentDemo = isLogin && process.env.NODE_ENV !== 'production';

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (!isLogin) {
        if (!form.name.trim()) {
          throw new Error('Name is required.');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
          throw new Error('Enter a valid email address.');
        }

        if (!form.password || form.password.length < 10 || form.password.length > 72 || new TextEncoder().encode(form.password).length > 72) {
          throw new Error('Password must be 10–72 characters and at most 72 UTF-8 bytes.');
        }

        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            confirmPassword: form.confirmPassword,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to create account.');
        }
      }

      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error('Invalid email or password.');
      }

      router.push(isLogin ? '/dashboard' : '/welcome');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/30">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-violet-300">Genzz AI</p>
          <p className="mt-1 text-xs text-slate-400">Prepare Smarter. Interview Better.</p>
          <h1 className="mt-2 text-3xl font-bold text-white">{isLogin ? 'Welcome back' : 'Create account'}</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {!isLogin && (
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                placeholder="Jane Interviewer"
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                required
              />
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => handleChange('email', event.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              minLength={isLogin ? undefined : 10}
              maxLength={isLogin ? 128 : 72}
              placeholder={isLogin ? '••••••••' : '10–72 characters'}
              value={form.password}
              onChange={(event) => handleChange('password', event.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                minLength={10}
                maxLength={72}
                placeholder="Confirm password"
                value={form.confirmPassword}
                onChange={(event) => handleChange('confirmPassword', event.target.value)}
                required
              />
            </div>
          )}

          {error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button type="submit" className="btn-primary mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : isLogin ? 'Login' : 'Create account'}
          </button>
        </form>

        {showDevelopmentDemo && (
          <div className="mt-5 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-violet-200">Development demo account</p>
              <span className="rounded-full border border-violet-400/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-violet-200">Demo only</span>
            </div>
            <p className="mt-2 text-xs text-slate-300">demo@genzz.ai · GenzzDemo@123</p>
            <button type="button" className="btn-secondary mt-3 w-full text-xs" onClick={() => setForm((current) => ({ ...current, email: 'demo@genzz.ai', password: 'GenzzDemo@123' }))}>
              Fill demo credentials
            </button>
            <p className="mt-2 text-[11px] leading-4 text-slate-500">Available only in development after running <code>npm run demo:seed</code>.</p>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-slate-300">
          {isLogin ? 'New here?' : 'Already have an account?'}{' '}
          <Link href={isLogin ? '/register' : '/login'} className="font-medium text-violet-300 hover:text-violet-200">
            {isLogin ? 'Create an account' : 'Login'}
          </Link>
        </div>
      </div>
    </main>
  );
}
