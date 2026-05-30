'use client';

import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import type { PegawaiAbsensi } from '@/types';

const BULAN_OPTIONS = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - 2 + i));

const EMPTY_PEGAWAI: PegawaiAbsensi = {
  nama: '',
  nip: '',
  jabatan: '',
  hadir: 0,
  sakit: 0,
  izin: 0,
  alpha: 0,
};

interface InfoFields {
  instansi: string;
  unitKerja: string;
  bulan: string;
  tahun: string;
}

export default function AbsensiPage() {
  const [info, setInfo] = useState<InfoFields>({
    instansi: '',
    unitKerja: '',
    bulan: String(new Date().getMonth() + 1).padStart(2, '0'),
    tahun: String(CURRENT_YEAR),
  });
  const [pegawai, setPegawai] = useState<PegawaiAbsensi[]>([{ ...EMPTY_PEGAWAI }]);
  const [loading, setLoading] = useState(false);

  function handleInfoChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setInfo((prev) => ({ ...prev, [name]: value }));
  }

  function handlePegawaiChange(
    index: number,
    field: keyof PegawaiAbsensi,
    value: string | number
  ) {
    setPegawai((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: typeof EMPTY_PEGAWAI[field] === 'number' ? Number(value) : value,
      };
      return updated;
    });
  }

  function addPegawai() {
    setPegawai((prev) => [...prev, { ...EMPTY_PEGAWAI }]);
  }

  function removePegawai(index: number) {
    if (pegawai.length === 1) {
      toast.error('Minimal harus ada satu pegawai.');
      return;
    }
    setPegawai((prev) => prev.filter((_, i) => i !== index));
  }

  const totals = pegawai.reduce(
    (acc, p) => ({
      hadir: acc.hadir + (p.hadir || 0),
      sakit: acc.sakit + (p.sakit || 0),
      izin: acc.izin + (p.izin || 0),
      alpha: acc.alpha + (p.alpha || 0),
    }),
    { hadir: 0, sakit: 0, izin: 0, alpha: 0 }
  );

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();

    if (!info.instansi.trim() || !info.unitKerja.trim() || !info.bulan || !info.tahun) {
      toast.error('Harap lengkapi semua informasi unit kerja.');
      return;
    }

    const hasEmpty = pegawai.some((p) => !p.nama.trim() || !p.nip.trim() || !p.jabatan.trim());
    if (hasEmpty) {
      toast.error('Harap lengkapi nama, NIP, dan jabatan semua pegawai.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Sedang membuat file Excel...');

    try {
      const res = await fetch('/api/excel/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...info, pegawai }),
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
      const fileName = match?.[1] ?? `Absensi_${info.bulan}_${info.tahun}.xlsx`;

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
    <div className="max-w-6xl mx-auto space-y-6">
      <Toaster position="top-right" />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rekap Absensi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Buat rekap absensi bulanan pegawai dalam format Excel standar.
        </p>
      </div>

      <form onSubmit={handleDownload} className="space-y-6">
        {/* Info Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3 mb-4">
            Informasi Unit Kerja
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

        {/* Employee Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              Daftar Pegawai
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({pegawai.length} pegawai)
              </span>
            </h2>
            <button
              type="button"
              onClick={addPegawai}
              className="flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Pegawai
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 rounded-tl-lg w-8">No</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 min-w-[160px]">Nama</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 min-w-[140px]">NIP</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 min-w-[140px]">Jabatan</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-16">Hadir</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-16">Sakit</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-16">Izin</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 text-center w-16">Alpha</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-500 rounded-tr-lg w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pegawai.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-xs text-slate-400 text-center">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={p.nama}
                        onChange={(e) => handlePegawaiChange(idx, 'nama', e.target.value)}
                        placeholder="Nama pegawai"
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={p.nip}
                        onChange={(e) => handlePegawaiChange(idx, 'nip', e.target.value)}
                        placeholder="NIP"
                        maxLength={18}
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 placeholder-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={p.jabatan}
                        onChange={(e) => handlePegawaiChange(idx, 'jabatan', e.target.value)}
                        placeholder="Jabatan"
                        className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                    {(['hadir', 'sakit', 'izin', 'alpha'] as const).map((field) => (
                      <td key={field} className="px-2 py-1.5">
                        <input
                          type="number"
                          min={0}
                          max={31}
                          value={p[field]}
                          onChange={(e) => handlePegawaiChange(idx, field, e.target.value)}
                          className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => removePegawai(idx)}
                        className="rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Hapus baris"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
            {[
              { label: 'Total Hadir', value: totals.hadir, color: 'text-green-600 bg-green-50' },
              { label: 'Total Sakit', value: totals.sakit, color: 'text-yellow-600 bg-yellow-50' },
              { label: 'Total Izin', value: totals.izin, color: 'text-blue-600 bg-blue-50' },
              { label: 'Total Alpha', value: totals.alpha, color: 'text-red-600 bg-red-50' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-lg p-3 text-center ${color.split(' ')[1]}`}>
                <p className={`text-2xl font-bold ${color.split(' ')[0]}`}>{value}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
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
