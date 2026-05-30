import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Download, ToolType } from '@/types';

const TOOL_LABELS: Record<ToolType, string> = {
  'form-asn': 'Formulir ASN',
  'absensi': 'Rekap Absensi',
  'arsip-surat': 'Arsip Surat',
  'laporan': 'Laporan Bulanan',
  'ai-generated': 'AI Assistant',
};

const TOOL_COLORS: Record<ToolType, string> = {
  'form-asn': 'bg-blue-100 text-blue-700',
  'absensi': 'bg-green-100 text-green-700',
  'arsip-surat': 'bg-yellow-100 text-yellow-700',
  'laporan': 'bg-purple-100 text-purple-700',
  'ai-generated': 'bg-indigo-100 text-indigo-700',
};

const BULAN_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = BULAN_NAMES[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

interface SearchParams {
  tool?: string;
}

export default async function RiwayatPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const params = await searchParams;
  const filterTool = params.tool as ToolType | undefined;

  let query = supabase
    .from('downloads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (filterTool && Object.keys(TOOL_LABELS).includes(filterTool)) {
    query = query.eq('tool_type', filterTool);
  }

  const { data: downloads } = await query;
  const allDownloads = (downloads ?? []) as Download[];

  // Count per tool for filter badges
  const { data: allCounts } = await supabase
    .from('downloads')
    .select('tool_type')
    .eq('user_id', user.id);

  const countByTool = (allCounts ?? []).reduce<Record<string, number>>((acc, d) => {
    acc[d.tool_type] = (acc[d.tool_type] ?? 0) + 1;
    return acc;
  }, {});

  const totalDownloads = allCounts?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Riwayat Download</h1>
        <p className="mt-1 text-sm text-slate-500">
          Semua file yang pernah Anda unduh melalui ASNFlow.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.entries(TOOL_LABELS) as [ToolType, string][]).map(([key, label]) => (
          <div key={key} className="bg-white rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-2xl font-bold text-slate-800">{countByTool[key] ?? 0}</p>
            <p className="text-xs text-slate-500 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 mr-1">Filter:</span>
        <a
          href="/riwayat"
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !filterTool
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Semua ({totalDownloads})
        </a>
        {(Object.entries(TOOL_LABELS) as [ToolType, string][]).map(([key, label]) => (
          <a
            key={key}
            href={`/riwayat?tool=${key}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterTool === key
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {label} ({countByTool[key] ?? 0})
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {allDownloads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">📂</div>
            <p className="text-base font-semibold text-slate-600">
              {filterTool ? `Belum ada riwayat untuk ${TOOL_LABELS[filterTool]}` : 'Belum ada riwayat download'}
            </p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs">
              {filterTool
                ? 'Coba gunakan tool tersebut untuk membuat dokumen pertama Anda.'
                : 'Mulai dengan menggunakan salah satu tool di menu navigasi.'}
            </p>
            {filterTool && (
              <a
                href="/riwayat"
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                ← Lihat semua riwayat
              </a>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-12">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Nama File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-40">Jenis Tool</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-44">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allDownloads.map((d, idx) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs text-slate-700 font-medium break-all">
                          {d.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        TOOL_COLORS[d.tool_type] ?? 'bg-slate-100 text-slate-600'
                      }`}>
                        {TOOL_LABELS[d.tool_type] ?? d.tool_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(d.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {allDownloads.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                <p className="text-xs text-slate-400">
                  Menampilkan {allDownloads.length} entri
                  {filterTool ? ` untuk ${TOOL_LABELS[filterTool]}` : ''}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
