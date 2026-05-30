'use client';

import { useState, FormEvent } from 'react';
import { AsnFormData } from '@/types';

const INSTANSI_LIST = [
  'Kementerian Dalam Negeri',
  'Kementerian Keuangan',
  'Kementerian Pendidikan dan Kebudayaan',
  'Kementerian Kesehatan',
  'Kementerian Hukum dan HAM',
  'Badan Kepegawaian Negara',
  'Badan Pusat Statistik',
  'Lainnya',
];

export default function AsnForm() {
  const [form, setForm] = useState<AsnFormData>({
    nama: '',
    nip: '',
    tanggal: '',
    instansi: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('Gagal membuat file Excel.');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Data_ASN_${form.nip || 'export'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  const isValid = form.nama && form.nip && form.tanggal && form.instansi;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Status banners */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          File Excel berhasil diunduh!
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nama */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="nama">
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <input
            id="nama"
            name="nama"
            type="text"
            value={form.nama}
            onChange={handleChange}
            placeholder="Contoh: Budi Santoso, S.Kom"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* NIP */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="nip">
            NIP <span className="text-red-500">*</span>
          </label>
          <input
            id="nip"
            name="nip"
            type="text"
            value={form.nip}
            onChange={handleChange}
            placeholder="18 digit NIP"
            maxLength={18}
            pattern="\d{18}"
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          <p className="text-xs text-gray-400 mt-1">{form.nip.length}/18 digit</p>
        </div>

        {/* Tanggal */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="tanggal">
            Tanggal <span className="text-red-500">*</span>
          </label>
          <input
            id="tanggal"
            name="tanggal"
            type="date"
            value={form.tanggal}
            onChange={handleChange}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        {/* Instansi */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="instansi">
            Instansi <span className="text-red-500">*</span>
          </label>
          <select
            id="instansi"
            name="instansi"
            value={form.instansi}
            onChange={handleChange}
            required
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
          >
            <option value="">-- Pilih Instansi --</option>
            {INSTANSI_LIST.map((inst) => (
              <option key={inst} value={inst}>{inst}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Preview */}
      {isValid && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">
            Pratinjau Data
          </p>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            {[
              ['Nama', form.nama],
              ['NIP', form.nip],
              ['Tanggal', new Date(form.tanggal).toLocaleDateString('id-ID', { dateStyle: 'long' })],
              ['Instansi', form.instansi],
            ].map(([label, value]) => (
              <div key={label} className="contents">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800 truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !isValid}
        className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Membuat File...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Excel (.xlsx)
          </>
        )}
      </button>
    </form>
  );
}
