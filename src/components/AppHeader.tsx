import Link from 'next/link';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/my-timetable', label: 'My Timetable' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/admin/events', label: 'Admin' },
];

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-slate-900">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
            FN
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">FestivalNavigator</p>
            <p className="text-sm text-slate-700">홈으로 돌아가기</p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
