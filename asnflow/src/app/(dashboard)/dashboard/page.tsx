import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import StatsCards from '@/components/dashboard/StatsCards';
import DownloadHistory from '@/components/dashboard/DownloadHistory';
import type { Download, Membership, Profile } from '@/types';

const TOOL_CARDS = [
  {
    title: 'Formulir Data ASN',
    description: 'Buat formulir data pegawai ASN dengan format standar.',
    icon: '📋',
    href: '/tools/form-asn',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    iconBg: 'bg-blue-100',
  },
  {
    title: 'Rekap Absensi',
    description: 'Buat rekap absensi bulanan seluruh pegawai unit kerja.',
    icon: '📅',
    href: '/tools/absensi',
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
    iconBg: 'bg-green-100',
  },
  {
    title: 'Arsip Surat',
    description: 'Kelola dan ekspor arsip surat masuk & keluar.',
    icon: '📬',
    href: '/tools/arsip-surat',
    color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
    iconBg: 'bg-yellow-100',
  },
  {
    title: 'Laporan Bulanan',
    description: 'Buat laporan kegiatan bulanan unit kerja.',
    icon: '📊',
    href: '/tools/laporan',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    iconBg: 'bg-purple-100',
  },
  {
    title: 'AI Assistant',
    description: 'Generate dokumen Excel otomatis menggunakan AI.',
    icon: '🤖',
    href: '/ai-assistant',
    color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
    iconBg: 'bg-indigo-100',
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileResult, membershipResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('memberships').select('*').eq('user_id', user.id).single(),
  ]);

  const profile = profileResult.data as Profile | null;
  const membership = membershipResult.data as Membership | null;

  const { data: downloadCountRaw } = await supabase.rpc('get_monthly_download_count', {
    p_user_id: user.id,
  });
  const downloadsThisMonth: number = downloadCountRaw ?? 0;

  const { data: recentDownloads } = await supabase
    .from('downloads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const downloads = (recentDownloads ?? []) as Download[];
  const downloadsLimit = membership?.plan === 'pro' ? Infinity : 5;

  const displayName = profile?.full_name
    ? profile.full_name.split(' ')[0]
    : user.email?.split('@')[0] ?? 'Pengguna';

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Selamat datang, {displayName}! 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola dokumen ASN Anda dengan mudah menggunakan ASNFlow.
        </p>
      </div>

      {/* Upgrade Banner for Free Users */}
      {membership?.plan === 'free' && downloadsThisMonth >= 4 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-amber-500 text-xl">⚠️</span>
            <div>
              <p className="text-sm font-medium text-amber-800">
                {downloadsThisMonth >= 5
                  ? 'Kuota download bulan ini sudah habis!'
                  : `Sisa kuota download: ${5 - downloadsThisMonth} lagi.`}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Upgrade ke Pro untuk download tak terbatas.
              </p>
            </div>
          </div>
          <Link
            href="/membership"
            className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Upgrade Sekarang
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <StatsCards stats={{
        totalDownloads: downloads.length,
        downloadsThisMonth,
        downloadsLimit,
        membershipPlan: membership?.plan ?? 'free',
        membershipStatus: membership?.status ?? 'active',
        recentDownloads: downloads,
      }} />

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Akses Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOL_CARDS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className={`group flex items-start gap-4 rounded-xl border p-5 transition-all duration-150 ${tool.color}`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-2xl ${tool.iconBg}`}>
                {tool.icon}
              </div>
              <div>
                <p className="font-semibold text-slate-800 group-hover:text-slate-900">
                  {tool.title}
                </p>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Downloads */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Download Terakhir</h2>
          <Link
            href="/riwayat"
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Lihat semua →
          </Link>
        </div>
        <DownloadHistory downloads={downloads} />
      </div>
    </div>
  );
}
