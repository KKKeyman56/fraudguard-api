'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/ui/Button';

interface HeaderUser {
  email: string;
  full_name?: string;
  role?: string;
}

interface HeaderProps {
  user: HeaderUser;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/form-asn': 'Form ASN',
  '/dashboard/absensi': 'Rekap Absensi',
  '/dashboard/arsip-surat': 'Arsip Surat',
  '/dashboard/laporan': 'Laporan',
  '/dashboard/ai-assistant': 'AI Assistant',
  '/dashboard/riwayat': 'Riwayat Download',
  '/dashboard/membership': 'Membership',
  '/dashboard/admin': 'Panel Admin',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  // Match dynamic sub-routes to their parent
  for (const [key, label] of Object.entries(PAGE_TITLES)) {
    if (key !== '/dashboard' && pathname.startsWith(key)) return label;
  }
  return 'ASNFlow';
}

function getInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'U';
}

function getRoleLabel(role?: string): string {
  if (role === 'admin') return 'Administrator';
  return 'Pengguna';
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const pageTitle = getPageTitle(pathname);
  const initials = getInitials(user.full_name, user.email);
  const displayName = user.full_name || user.email;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
      </div>

      {/* Right side: user info + logout */}
      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">{initials}</span>
          </div>

          {/* Name and role */}
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-sm font-semibold text-gray-800 truncate max-w-[160px]">
              {displayName}
            </span>
            <span className="text-xs text-gray-500">{getRoleLabel(user.role)}</span>
          </div>
        </div>

        {/* Logout button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-gray-500 hover:text-red-600 hover:bg-red-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Keluar</span>
        </Button>
      </div>
    </header>
  );
}
