'use client';

import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import type { FormASNData } from '@/types';

const GOLONGAN_OPTIONS = [
  'I-a', 'I-b', 'I-c', 'I-d',
  'II-a', 'II-b', 'II-c', 'II-d',
  'III-a', 'III-b', 'III-c', 'III-d',
  'IV-a', 'IV-b', 'IV-c', 'IV-d', 'IV-e',
];

const BULAN_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function formatTanggal(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getDate()} ${BULAN_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

const EMPTY_FORM: FormASNData = {
  nama: '',
  nip: '',
  jabatan: '',
  golongan: '',
  unitKerja: '',
  instansi: '',
  tanggal: '',
};

export default function FormASNPage() {
  const [form, setForm] = useState<FormASNData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormASNData, string>>>({});

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormASNData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormASNData, string>> = {};
    if (!form.nama.trim()) newErrors.nama = 'Nama lengkap wajib diisi.';
    if (!form.nip.trim()) newErrors.nip = 'NIP wajib diisi.';
    else if (!/^\d{18}$/.test(form.nip)) newErrors.nip = 'NIP harus terdiri dari 18 digit angka.';
    if (!form.jabatan.trim()) newErrors.jabatan = 'Jabatan wajib diisi.';
    if (!form.golongan) newErrors.golongan = 'Golongan wajib dipilih.';
    if (!form.unitKerja.trim()) newErrors.unitKerja = 'Unit Kerja wajib diisi.';
    if (!form.instansi.trim()) newErrors.instansi = 'Instansi wajib diisi.';
    if (!form.tanggal) newErrors.tanggal = 'Tanggal wajib diisi.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast.error('Harap lengkapi semua field yang wajib diisi.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Sedang membuat file Excel...');

    try {
      const res = await fetch('/api/excel/form-asn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Gagal membuat file. Coba lagi.', { id: toastId });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fileName = match?.[1] ?? `FormASN_${form.nip}.xlsx`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success('File berhasil diunduh!', { id: toastId });
    } catch {
      toast.error('Terjadi kesalahan jaringan. Coba lagi.', { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  const isFormFilled = form.nama || form.nip || form.jabatan || form.golongan || form.unitKerja || form.instansi || form.tanggal;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Toaster position="top-right" />

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Formulir Data ASN</h1>
        <p className="mt-1 text-sm text-slate-500">
          Isi data di bawah untuk membuat formulir data ASN dalam format Excel standar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleDownload} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
            Data Pegawai
          </h2>

          {/* Nama Lengkap */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nama"
              value={form.nama}
              onChange={handleChange}
              placeholder="Contoh: Budi Santoso, S.Kom"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.nama ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            />
            {errors.nama && <p className="mt-1 text-xs text-red-500">{errors.nama}</p>}
          </div>

          {/* NIP */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              NIP <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(18 digit)</span>
            </label>
            <input
              type="text"
              name="nip"
              value={form.nip}
              onChange={handleChange}
              placeholder="198001012005011001"
              maxLength={18}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.nip ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errors.nip
                ? <p className="text-xs text-red-500">{errors.nip}</p>
                : <span />}
              <span className="text-xs text-slate-400">{form.nip.length}/18</span>
            </div>
          </div>

          {/* Jabatan */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Jabatan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="jabatan"
              value={form.jabatan}
              onChange={handleChange}
              placeholder="Contoh: Analis Kebijakan Muda"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.jabatan ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            />
            {errors.jabatan && <p className="mt-1 text-xs text-red-500">{errors.jabatan}</p>}
          </div>

          {/* Golongan */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Golongan <span className="text-red-500">*</span>
            </label>
            <select
              name="golongan"
              value={form.golongan}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.golongan ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            >
              <option value="">-- Pilih Golongan --</option>
              {GOLONGAN_OPTIONS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            {errors.golongan && <p className="mt-1 text-xs text-red-500">{errors.golongan}</p>}
          </div>

          {/* Unit Kerja */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Unit Kerja <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="unitKerja"
              value={form.unitKerja}
              onChange={handleChange}
              placeholder="Contoh: Bidang Kepegawaian"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.unitKerja ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            />
            {errors.unitKerja && <p className="mt-1 text-xs text-red-500">{errors.unitKerja}</p>}
          </div>

          {/* Instansi */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Instansi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="instansi"
              value={form.instansi}
              onChange={handleChange}
              placeholder="Contoh: Dinas Pendidikan Kota Bandung"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.instansi ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            />
            {errors.instansi && <p className="mt-1 text-xs text-red-500">{errors.instansi}</p>}
          </div>

          {/* Tanggal */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tanggal <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="tanggal"
              value={form.tanggal}
              onChange={handleChange}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.tanggal ? 'border-red-400 focus:ring-red-400' : 'border-slate-300'
              }`}
            />
            {errors.tanggal && <p className="mt-1 text-xs text-red-500">{errors.tanggal}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Membuat File...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Excel
              </>
            )}
          </button>
        </form>

        {/* Preview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 mb-4">
            Pratinjau Data
          </h2>
          {isFormFilled ? (
            <dl className="space-y-3">
              {[
                { label: 'Nama Lengkap', value: form.nama },
                { label: 'NIP', value: form.nip, mono: true },
                { label: 'Jabatan', value: form.jabatan },
                { label: 'Golongan', value: form.golongan },
                { label: 'Unit Kerja', value: form.unitKerja },
                { label: 'Instansi', value: form.instansi },
                { label: 'Tanggal', value: formatTanggal(form.tanggal) },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-28 shrink-0 text-xs font-medium text-slate-500 mt-0.5">{label}</dt>
                  <dd className={`flex-1 text-sm text-slate-800 ${mono ? 'font-mono' : ''} ${!value ? 'text-slate-300 italic' : ''}`}>
                    {value || 'Belum diisi'}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm text-slate-400">
                Pratinjau akan muncul setelah Anda mulai mengisi formulir.
              </p>
            </div>
          )}

          {/* Info box */}
          <div className="mt-6 rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-xs text-blue-700 font-medium">Informasi</p>
            <p className="text-xs text-blue-600 mt-1">
              File Excel akan terunduh otomatis setelah tombol Download diklik.
              Setiap download akan tercatat dalam riwayat akun Anda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
