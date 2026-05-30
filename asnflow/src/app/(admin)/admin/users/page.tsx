import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Card, { CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');

  const { data: users } = await supabase
    .from('profiles')
    .select('*, memberships(plan, status, expires_at)')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manajemen Pengguna</h1>
        <p className="text-gray-500 text-sm mt-1">{users?.length ?? 0} pengguna terdaftar</p>
      </div>

      <Card>
        <CardHeader>
          <p className="font-semibold text-gray-800">Daftar Pengguna</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', 'Email', 'Nama', 'Role', 'Plan', 'Status', 'Bergabung'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users?.map((u, i) => {
                const membership = (u.memberships as { plan: string; status: string; expires_at: string | null }[])?.[0];
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 text-gray-800 font-medium">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'admin' ? 'danger' : 'default'}>
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={membership?.plan === 'pro' ? 'success' : 'default'}>
                        {membership?.plan ?? 'free'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={membership?.status === 'active' ? 'success' : 'warning'}>
                        {membership?.status ?? 'active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
