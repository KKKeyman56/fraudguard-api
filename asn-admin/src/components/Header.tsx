'use client';

import { useRouter } from 'next/navigation';
import { AUTH_COOKIE } from '@/lib/auth';
import Cookies from 'js-cookie';

interface HeaderProps {
  username?: string;
  role?: string;
}

export default function Header({ username = 'Admin', role = 'Administrator' }: HeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    Cookies.remove(AUTH_COOKIE);
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-blue-100 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-700">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-blue-500 leading-none">Sistem Informasi</p>
            <p className="text-sm font-bold text-blue-900 leading-tight">ASN Indonesia</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-gray-800">{username}</p>
            <p className="text-xs text-blue-500">{role}</p>
          </div>
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
            {username.charAt(0).toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
