import Link from 'next/link';

const stats = [
  { label: 'Total ASN Terdaftar', value: '4,572,921', icon: '👥', color: 'bg-blue-50 text-blue-700' },
  { label: 'Instansi Terhubung', value: '630', icon: '🏛️', color: 'bg-indigo-50 text-indigo-700' },
  { label: 'File Diexport Hari Ini', value: '128', icon: '📄', color: 'bg-green-50 text-green-700' },
  { label: 'Pengguna Aktif', value: '24', icon: '🔵', color: 'bg-sky-50 text-sky-700' },
];

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Selamat datang di Sistem Informasi Aparatur Sipil Negara
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3 ${s.color}`}>
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard/generate"
            className="flex items-center gap-4 p-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl transition-colors group"
          >
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Generate Excel</p>
              <p className="text-blue-200 text-sm">Buat & unduh file .xlsx</p>
            </div>
          </Link>

          <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-700">Laporan Bulanan</p>
              <p className="text-gray-400 text-sm">Segera tersedia</p>
            </div>
          </div>
        </div>
      </div>

      {/* Template preview */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-1">Pratinjau Template Excel</h2>
        <p className="text-gray-500 text-sm mb-5">
          Format resmi yang akan dihasilkan saat Anda mengunduh data ASN
        </p>

        <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
          {/* Header rows */}
          <div className="bg-blue-900 text-white text-center py-2 font-bold tracking-wide">
            PEMERINTAH REPUBLIK INDONESIA
          </div>
          <div className="bg-blue-800 text-blue-100 text-center py-1.5">
            SISTEM INFORMASI APARATUR SIPIL NEGARA (SIASN)
          </div>
          <div className="bg-blue-700 text-white text-center py-2 font-semibold">
            FORMULIR DATA APARATUR SIPIL NEGARA
          </div>

          {/* Data fields */}
          <div className="divide-y divide-blue-50">
            {[
              ['Nama Lengkap', '________________'],
              ['NIP', '________________'],
              ['Tanggal', '________________'],
              ['Instansi', '________________'],
            ].map(([label, val]) => (
              <div key={label} className="flex">
                <div className="w-1/3 bg-blue-50 px-4 py-2 font-semibold text-blue-800 border-r border-blue-100">
                  {label}
                </div>
                <div className="flex-1 px-4 py-2 text-gray-400">{val}</div>
              </div>
            ))}
          </div>

          {/* Table header */}
          <div className="grid grid-cols-5 bg-blue-700 text-white text-center py-2 font-semibold mt-2">
            {['No', 'Nama Lengkap', 'NIP', 'Tanggal', 'Instansi'].map((h) => (
              <div key={h} className="px-1">{h}</div>
            ))}
          </div>
          <div className="grid grid-cols-5 text-center py-2 text-gray-400 bg-white border-b border-gray-100">
            {['1', '—', '—', '—', '—'].map((v, i) => (
              <div key={i} className="px-1">{v}</div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-right px-6 py-3 text-gray-400 bg-gray-50">
            Jakarta, — &nbsp;&nbsp;&nbsp; Pejabat yang Berwenang
          </div>
        </div>
      </div>
    </div>
  );
}
