import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="card max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Genzz AI</p>
        <p className="text-sm uppercase tracking-[0.2em] text-violet-300">404</p>
        <h1 className="mt-4 text-3xl font-bold text-white">Page not found</h1>
        <p className="mt-3 text-slate-300">The page you are looking for does not exist.</p>
        <Link href="/dashboard" className="btn-primary mt-6">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
