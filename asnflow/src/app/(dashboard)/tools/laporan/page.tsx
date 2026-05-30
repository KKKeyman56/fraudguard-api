'use client';

import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import type { LaporanKegiatan } from '@/types';

const BULAN_OPTIONS = [
  { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' }, { value: '04', label: 'April' },
  { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' }, { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - 2 + i));

const EMPTY_KEGIATAN: LaporanKegiatan = {
  namaKegiatan: '',
  tanggal: '',
  tempat: '',
  peserta: '',
  pelaksana: '',
  hasil: '',
  keterangan: '',
};

interface InfoFields {
  instansi: string;
  unitKerja: string;
  bulan: string;
  tahun: string;
}

export default function LaporanPage() {
  const [info, setInfo] = useState<InfoFields>({
    instansi: '',
    unitKerja: '',
    bulan: String(new Date().getMonth() + 1).padStart(2, '0'),
    tahun: String(CURRENT_YEAR),
  });
  const [kegiatan, setKegiatan] = useState<LaporanKegiatan[]>([{ ...EMPTY_KEGIATAN }]);
  const [loading, setLoading] = useState(false);

  function handleInfoChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setInfo((prev) => ({ ...prev, [name]: value }));
  }

  function handleKegiatanChange(index: number, field: keyof LaporanKegiatan, value: string) {
    setKegiatan((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addKegiatan() {
    setKegiatan((prev) => [...prev, { ...EMPTY_KEGIATAN }]);
  }

  function removeKegiatan(index: number) {
    if (kegiatan.length === 1) {
      toast.error('Minimal harus ada satu kegiatan.');
      return;
    }
    setKegiatan((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();

    if (!info.instansi.trim() || !info.unitKerja.trim() || !info.bulan || !info.tahun) {
      toast.error('Harap lengkapi semua informasi laporan.');
      return;
    }

    const hasEmpty = kegiatan.some(
      (k) => !k.namaKegiatan.trim() || !k.tanggal || !k.tempat.trim() || !k.pelaksana.trim() || !k.hasil.trim()
    );
    if (hasEmpty) {
      toast.error('Harap lengkapi nama kegiatan, tanggal, tempat, pelaksana, dan hasil untuk setiap baris.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Sedang membuat file Excel...');

    try {
      const res = await fetch('/api/excel/laporan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...info, kegiatan }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Gagal membuat file.', { id: toastId });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fileName = match?.[1] ?? `Laporan_${info.bulan}_${info.tahun}.xlsx`;

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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Toaster position="top-right" />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Laporan Bulanan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat laporan kegiatan bulanan unit kerja dalam format Excel standar.
        </p>
      </div>

      <form onSubmit={handleDownload} className="space-y-6">
        {/* Info Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 mb-4">
            Informasi Laporan
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Instansi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="instansi"
                value={info.instansi}
                onChange={handleInfoChange}
                placeholder="Contoh: Dinas Pendidikan Kota Bandung"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Unit Kerja <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="unitKerja"
                value={info.unitKerja}
                onChange={handleInfoChange}
                placeholder="Contoh: Bidang Kepegawaian"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Bulan <span className="text-red-500">*</span>
              </label>
              <select
                name="bulan"
                value={info.bulan}
                onChange={handleInfoChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {BULAN_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tahun <span className="text-red-500">*</span>
              </label>
              <select
                name="tahun"
                value={info.tahun}
                onChange={handleInfoChange}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Kegiatan Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              Daftar Kegiatan
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({kegiatan.length} kegiatan)
              </span>
            </h2>
            <button
              type="button"
              onClick={addKegiatan}
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Kegiatan
            </button>
          </div>

          <div className="space-y-4">
            {kegiatan.map((k, idx) => (
              <div key={idx} className="relative rounded-lg border border-slate-200 p-4 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">
                    Kegiatan #{idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeKegiatan(idx)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Nama Kegiatan <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={k.namaKegiatan}
                      onChange={(e) => handleKegiatanChange(idx, 'namaKegiatan', e.target.value)}
                      placeholder="Nama kegiatan"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tanggal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={k.tanggal}
                      onChange={(e) => handleKegiatanChange(idx, 'tanggal', e.target.value)}
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tempat <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={k.tempat}
                      onChange={(e) => handleKegiatanChange(idx, 'tempat', e.target.value)}
                      placeholder="Lokasi kegiatan"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Peserta
                    </label>
                    <input
                      type="text"
                      value={k.peserta}
                      onChange={(e) => handleKegiatanChange(idx, 'peserta', e.target.value)}
                      placeholder="Jumlah / deskripsi peserta"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Pelaksana <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={k.pelaksana}
                      onChange={(e) => handleKegiatanChange(idx, 'pelaksana', e.target.value)}
                      placeholder="Penanggung jawab"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Hasil <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={k.hasil}
                      onChange={(e) => handleKegiatanChange(idx, 'hasil', e.target.value)}
                      placeholder="Hasil atau capaian kegiatan"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Keterangan
                    </label>
                    <input
                      type="text"
                      value={k.keterangan ?? ''}
                      onChange={(e) => handleKegiatanChange(idx, 'keterangan', e.target.value)}
                      placeholder="Catatan tambahan (opsional)"
                      className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        </div>
      </form>
    </div>
  );
}
