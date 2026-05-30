import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Card, { CardBody, CardHeader } from '@/components/ui/Card';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const [
    { count: totalUsers },
    { count: totalDownloads },
    { data: proUsers },
    { data: recentDownloads },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('downloads').select('*', { count: 'exact', head: true }),
    supabase.from('memberships').select('user_id', { count: 'exact' }).eq('plan', 'pro').eq('status', 'active'),
    supabase.from('downloads').select('id, tool_type, file_name, created_at, profiles(email)').order('created_at', { ascending: false }).limit(20),
  ]);

  const stats = [
    { label: 'Total Pengguna', value: totalUsers ?? 0, icon: '👥', color: 'bg-blue-50 text-blue-700' },
    { label: 'Total Download', value: totalDownloads ?? 0, icon: '📄', color: 'bg-green-50 text-green-700' },
    { label: 'Pengguna Pro', value: proUsers?.length ?? 0, icon: '⭐', color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Pendapatan Est.', value: `Rp ${((proUsers?.length ?? 0) * 49000).toLocaleString('id-ID')}`, icon: '💰', color: 'bg-purple-50 text-purple-700' },
  ];

  const TOOL_LABELS: Record<string, string> = {
    'form-asn': 'Form ASN', 'absensi': 'Absensi', 'arsip-surat': 'Arsip Surat',
    'laporan': 'Laporan', 'ai-generated': 'AI Generated',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel Admin</h1>
        <p className="text-gray-500 text-sm mt-1">Statistik dan manajemen platform ASNFlow</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody className="p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3 ${s.color}`}>{s.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><p className="font-semibold text-gray-800">Download Terbaru</p></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', 'Pengguna', 'Tool', 'File', 'Tanggal'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentDownloads?.map((d, i) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-gray-700">{(d.profiles as unknown as { email: string } | null)?.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {TOOL_LABELS[d.tool_type] ?? d.tool_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs truncate max-w-48">{d.file_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(d.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
