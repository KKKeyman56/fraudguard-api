import AsnForm from '@/components/AsnForm';

export default function GeneratePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Generate Excel</h1>
        <p className="text-gray-500 text-sm mt-1">
          Isi formulir di bawah ini untuk menghasilkan dan mengunduh file Excel data ASN
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100">
          <div className="w-10 h-10 rounded-lg bg-blue-700 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-800">Formulir Data ASN</p>
            <p className="text-xs text-gray-400">Lengkapi semua field yang bertanda *</p>
          </div>
        </div>

        <AsnForm />
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p className="text-sm text-blue-700">
          File Excel yang dihasilkan sesuai format resmi SIASN dan dapat langsung digunakan
          untuk keperluan administrasi kepegawaian.
        </p>
      </div>
    </div>
  );
}
