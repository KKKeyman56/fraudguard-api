'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  role?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function LayoutGridIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function FileTextIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ClipboardListIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}

function ChartBarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <LayoutGridIcon /> },
];

const toolNavItems: NavItem[] = [
  { href: '/dashboard/form-asn', label: 'Form ASN', icon: <FileTextIcon /> },
  { href: '/dashboard/absensi', label: 'Rekap Absensi', icon: <ClipboardListIcon /> },
  { href: '/dashboard/arsip-surat', label: 'Arsip Surat', icon: <ArchiveIcon /> },
  { href: '/dashboard/laporan', label: 'Laporan', icon: <ChartBarIcon /> },
];

const bottomNavItems: NavItem[] = [
  { href: '/dashboard/ai-assistant', label: 'AI Assistant', icon: <SparklesIcon /> },
  { href: '/dashboard/riwayat', label: 'Riwayat Download', icon: <DownloadIcon /> },
  { href: '/dashboard/membership', label: 'Membership', icon: <CreditCardIcon /> },
];

const adminNavItems: NavItem[] = [
  { href: '/dashboard/admin', label: 'Panel Admin', icon: <ShieldCheckIcon /> },
];

function NavLink({ href, label, icon }: NavItem) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
        isActive
          ? 'bg-brand-700 text-white shadow-sm'
          : 'text-blue-100 hover:bg-brand-800 hover:text-white'
      )}
    >
      <span className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-blue-300')}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

export default function Sidebar({ role }: SidebarProps) {
  return (
    <aside className="flex flex-col w-64 min-h-screen bg-brand-900 px-4 py-6 gap-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3">
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span className="text-xl font-bold text-white tracking-tight">ASNFlow</span>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-1">
        {mainNavItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Tools section */}
      <div className="flex flex-col gap-1">
        <p className="px-3 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
          Tools
        </p>
        {toolNavItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </div>

      {/* Bottom nav */}
      <div className="flex flex-col gap-1">
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </div>

      {/* Admin section */}
      {role === 'admin' && (
        <div className="flex flex-col gap-1">
          <p className="px-3 text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
            Admin
          </p>
          {adminNavItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer */}
      <div className="px-3 py-2 rounded-lg bg-brand-800">
        <p className="text-xs text-blue-300 text-center">&copy; {new Date().getFullYear()} ASNFlow</p>
      </div>
    </aside>
  );
}
