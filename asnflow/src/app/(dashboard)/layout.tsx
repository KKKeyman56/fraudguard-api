import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden md:flex md:flex-col md:w-60 md:fixed md:inset-y-0">
        <Sidebar role={profile?.role} />
      </div>
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <Header user={{ email: user.email ?? '', full_name: profile?.full_name, role: profile?.role }} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
