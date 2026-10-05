import { Search } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/notification-bell';

export function Topbar() {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-400 md:min-w-[260px]">
        <Search className="h-4 w-4" />
        <span className="text-sm">Search sessions...</span>
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600/20 text-xs font-bold text-violet-300">
            MU
          </div>
          <div className="hidden text-sm text-slate-200 md:block">Mock User</div>
        </div>
      </div>
    </header>
  );
}
