import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/login/actions';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/prospects', label: 'Prospects' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/settings', label: 'Settings' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white sm:flex">
        <div className="px-4 py-5">
          <span className="text-lg font-semibold text-slate-900">Outreach Engine</span>
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <form action={signOut}>
            <button className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-800" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:hidden">
          <span className="text-base font-semibold">Outreach Engine</span>
          <nav className="flex gap-3 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="text-slate-600">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
