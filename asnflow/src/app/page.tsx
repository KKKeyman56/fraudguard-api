import Link from 'next/link';

// ── Icons (inline SVG to keep this a pure Server Component) ──────────────────

function IconDocument() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function IconArchive() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-blue-100 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md group-hover:shadow-blue-300 transition-shadow">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="text-xl font-bold text-gray-900">
            ASN<span className="text-blue-600">Flow</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <a href="#fitur" className="hover:text-blue-600 transition-colors">Fitur</a>
          <a href="#ai-assistant" className="hover:text-blue-600 transition-colors">AI Assistant</a>
          <a href="#harga" className="hover:text-blue-600 transition-colors">Harga</a>
        </div>

        {/* CTA buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-3 py-1.5"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm hover:shadow-md"
          >
            Daftar Gratis
          </Link>
        </div>
      </nav>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 via-white to-white overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-blue-200">
          <IconSparkles />
          Didukung Kecerdasan Buatan
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Otomasi Administrasi{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-500">
            ASN Indonesia
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Hemat waktu dan tenaga dalam pengelolaan dokumen ASN. Buat form, rekap absensi,
          arsipkan surat, dan buat laporan bulanan — cukup dalam hitungan detik.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-lg hover:shadow-blue-200 hover:shadow-xl text-base"
          >
            Mulai Gratis Sekarang
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <a
            href="#fitur"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-blue-50 text-gray-700 font-semibold px-8 py-3.5 rounded-xl transition-all border border-gray-200 hover:border-blue-300 text-base"
          >
            Lihat Fitur
          </a>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-sm text-gray-400">
          Dipercaya oleh <span className="font-semibold text-gray-600">2.000+</span> ASN di seluruh Indonesia
        </p>

        {/* Hero mockup */}
        <div className="mt-14 relative mx-auto max-w-3xl">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-4 bg-gray-200 rounded-full h-5 flex items-center px-3">
                <span className="text-xs text-gray-400">app.asnflow.id/dashboard</span>
              </div>
            </div>
            {/* Dashboard preview */}
            <div className="p-6 bg-gradient-to-br from-blue-50 to-white min-h-40">
              <div className="grid grid-cols-4 gap-3 mb-4">
                {['Form ASN', 'Absensi', 'Arsip Surat', 'Laporan'].map((label, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 shadow-sm border border-blue-50 text-center">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 mx-auto mb-2" />
                    <p className="text-xs font-medium text-gray-600">{label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">A</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">AI Assistant</span>
                  <span className="ml-auto text-xs text-green-500 font-medium">● Online</span>
                </div>
                <div className="bg-blue-50 rounded-lg p-2.5 text-xs text-blue-800">
                  "Buatkan surat izin dinas untuk Budi Santoso tanggal 15 Juni 2025"
                </div>
              </div>
            </div>
          </div>
          {/* Glow effect */}
          <div className="absolute -inset-4 bg-blue-400/10 rounded-3xl blur-2xl -z-10" />
        </div>
      </div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

const features = [
  {
    icon: <IconDocument />,
    title: 'Form ASN',
    description:
      'Buat dan kelola formulir kepegawaian secara digital. Dari SKP hingga pengajuan cuti, semua tersedia dalam satu tempat.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: <IconCalendar />,
    title: 'Rekap Absensi',
    description:
      'Rekap kehadiran pegawai otomatis setiap bulan. Ekspor ke Excel dengan satu klik, siap untuk laporan BKN.',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    icon: <IconArchive />,
    title: 'Arsip Surat',
    description:
      'Kelola surat masuk dan keluar dengan mudah. Pencarian cepat berdasarkan nomor, tanggal, atau perihal surat.',
    color: 'bg-sky-100 text-sky-600',
  },
  {
    icon: <IconChart />,
    title: 'Laporan Bulanan',
    description:
      'Generate laporan kinerja bulanan secara otomatis. Visualisasi data yang jelas untuk mendukung pengambilan keputusan.',
    color: 'bg-cyan-100 text-cyan-600',
  },
];

function Features() {
  return (
    <section id="fitur" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="text-blue-600 text-sm font-semibold uppercase tracking-wider">Fitur Unggulan</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900">
            Semua yang Anda Butuhkan
          </h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto text-lg">
            Satu platform lengkap untuk semua kebutuhan administrasi ASN Anda.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-14 h-14 rounded-2xl ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── AI Assistant ──────────────────────────────────────────────────────────────

const examplePrompts = [
  'Buatkan surat tugas untuk Ir. Hendra, tanggal 20 Juni 2025',
  'Rekap absensi bulan Mei untuk seluruh pegawai',
  'Buat laporan kinerja triwulan II 2025',
  'Arsipkan surat masuk nomor 123/X/2025',
];

function AIAssistant() {
  return (
    <section id="ai-assistant" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-600 to-blue-700">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <IconSparkles />
              Didukung AI
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-4">
              Cukup Ketik Perintah, AI Buatkan Dokumennya
            </h2>
            <p className="text-blue-100 text-lg leading-relaxed mb-8">
              Tidak perlu lagi membuka template satu per satu. Cukup tulis apa yang Anda butuhkan
              dalam bahasa Indonesia sehari-hari, dan AI kami akan membuatkan dokumen yang siap cetak.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-white text-blue-600 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
            >
              Coba AI Assistant
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>

          {/* Right: chat mockup */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 border border-white/20">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/20">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <IconSparkles />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">ASNFlow AI</p>
                <p className="text-blue-200 text-xs">● Siap membantu</p>
              </div>
            </div>
            <div className="space-y-3">
              {examplePrompts.map((prompt, i) => (
                <div
                  key={i}
                  className="bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 cursor-pointer transition-colors border border-white/10 text-sm text-white/90"
                >
                  "{prompt}"
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 bg-white/10 rounded-xl px-4 py-2.5 text-sm text-white/50 border border-white/20">
                Ketik perintah Anda...
              </div>
              <button className="w-10 h-10 bg-white rounded-xl flex items-center justify-center hover:bg-blue-50 transition-colors shadow">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────

const freeFeatures = [
  '5 dokumen per bulan',
  'Form ASN dasar',
  'Rekap absensi (maks. 10 pegawai)',
  'Arsip surat (maks. 20 surat)',
  'Support via email',
];

const proFeatures = [
  'Dokumen tidak terbatas',
  'Semua fitur Form ASN',
  'Rekap absensi tidak terbatas',
  'Arsip surat tidak terbatas',
  'AI Assistant penuh',
  'Laporan bulanan otomatis',
  'Ekspor Excel & PDF',
  'Priority support',
];

function Pricing() {
  return (
    <section id="harga" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="text-blue-600 text-sm font-semibold uppercase tracking-wider">Harga</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900">
            Pilih Paket yang Tepat
          </h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto text-lg">
            Mulai gratis, upgrade kapan saja. Tidak ada biaya tersembunyi.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free */}
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm flex flex-col">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-1">Gratis</h3>
              <p className="text-gray-500 text-sm">Untuk individu yang baru mulai</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-gray-900">Rp 0</span>
              <span className="text-gray-400 text-sm ml-1">/ bulan</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {freeFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center mt-0.5">
                    <IconCheck />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Mulai Gratis
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-gradient-to-b from-blue-600 to-blue-700 rounded-2xl p-8 border border-blue-500 shadow-xl flex flex-col relative overflow-hidden">
            {/* Popular badge */}
            <div className="absolute top-4 right-4">
              <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/30">
                Populer
              </span>
            </div>
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-1">Pro</h3>
              <p className="text-blue-200 text-sm">Untuk instansi dan tim ASN</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-extrabold text-white">Rp 49.000</span>
              <span className="text-blue-200 text-sm ml-1">/ bulan</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {proFeatures.map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-blue-50">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center mt-0.5">
                    <IconCheck />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block w-full text-center bg-white hover:bg-blue-50 text-blue-600 font-semibold px-6 py-3 rounded-xl transition-colors shadow-lg"
            >
              Mulai Pro Sekarang
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-gray-400 mt-8">
          Pembayaran aman via Midtrans. Dapat dibatalkan kapan saja.
        </p>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-white">
                ASN<span className="text-blue-400">Flow</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-xs">
              Platform SaaS untuk mengotomasi pekerjaan administrasi Aparatur Sipil Negara Indonesia.
            </p>
          </div>

          {/* Produk */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Produk</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#fitur" className="hover:text-white transition-colors">Fitur</a></li>
              <li><a href="#harga" className="hover:text-white transition-colors">Harga</a></li>
              <li><a href="#ai-assistant" className="hover:text-white transition-colors">AI Assistant</a></li>
            </ul>
          </div>

          {/* Akun */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3">Akun</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/login" className="hover:text-white transition-colors">Masuk</Link></li>
              <li><Link href="/register" className="hover:text-white transition-colors">Daftar</Link></li>
              <li><Link href="/reset-password" className="hover:text-white transition-colors">Lupa Password</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs">
            &copy; {new Date().getFullYear()} ASNFlow. Hak cipta dilindungi.
          </p>
          <p className="text-xs">
            Dibuat dengan <span className="text-red-400">♥</span> untuk ASN Indonesia
          </p>
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <AIAssistant />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
