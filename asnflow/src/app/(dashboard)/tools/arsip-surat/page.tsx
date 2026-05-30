'use client';

import { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { ArsipSurat, SuratJenis } from '@/types';

interface SuratForm {
  nomor_surat: string;
  tanggal: string;
  pengirim: string;
  tujuan: string;
  perihal: string;
  jenis: SuratJenis;
  keterangan: string;
}

const EMPTY_FORM: SuratForm = {
  nomor_surat: '',
  tanggal: '',
  pengirim: '',
  tujuan: '',
  perihal: '',
  jenis: 'masuk',
  keterangan: '',
};

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

function formatTanggal(dateStr: string): string {
  if (!dateStr) return '-';
  const bulanNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${bulanNames[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ArsipSuratPage() {
  const [activeTab, setActiveTab] = useState<'tambah' | 'lihat'>('tambah');
  const [form, setForm] = useState<SuratForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [suratList, setSuratList] = useState<ArsipSurat[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filterJenis, setFilterJenis] = useState<'semua' | SuratJenis>('semua');
  const [exportInfo, setExportInfo] = useState({
    instansi: '',
    unitKerja: '',
    bulan: String(new Date().getMonth() + 1).padStart(2, '0'),
    tahun: String(CURRENT_YEAR),
  });
  const [exporting, setExporting] = useState(false);

  const supabase = createClient();

  const fetchSurat = useCallback(async () => {
    setLoadingList(true);
    const { data, error } = await supabase
      .from('arsip_surat')
      .select('*')
      .order('tanggal', { ascending: false });
    if (error) {
      toast.error('Gagal memuat data surat.');
    } else {
      setSuratList((data ?? []) as ArsipSurat[]);
    }
    setLoadingList(false);
  }, [supabase]);

  useEffect(() => {
    if (activeTab === 'lihat') {
      fetchSurat();
    }
  }, [activeTab, fetchSurat]);

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nomor_surat.trim() || !form.tanggal || !form.pengirim.trim() || !form.tujuan.trim() || !form.perihal.trim()) {
      toast.error('Harap lengkapi semua field yang wajib diisi.');
      return;
    }

    setSaving(true);
    const toastId = toast.loading('Menyimpan surat...');

    const { error } = await supabase.from('arsip_surat').insert({
      nomor_surat: form.nomor_surat.trim(),
      tanggal: form.tanggal,
      pengirim: form.pengirim.trim(),
      tujuan: form.tujuan.trim(),
      perihal: form.perihal.trim(),
      jenis: form.jenis,
      keterangan: form.keterangan.trim() || null,
    });

    if (error) {
      toast.error('Gagal menyimpan surat. Coba lagi.', { id: toastId });
    } else {
      toast.success('Surat berhasil disimpan!', { id: toastId });
      setForm(EMPTY_FORM);
    }
    setSaving(false);
  }

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    if (!exportInfo.instansi.trim() || !exportInfo.unitKerja.trim()) {
      toast.error('Harap isi Instansi dan Unit Kerja untuk ekspor.');
      return;
    }

    setExporting(true);
    const toastId = toast.loading('Membuat file Excel...');

    try {
      const { data } = await supabase
        .from('arsip_surat')
        .select('*')
        .order('tanggal', { ascending: true });

      const items = (data ?? []).map((s: ArsipSurat) => ({
        nomor_surat: s.nomor_surat,
        tanggal: s.tanggal,
        pengirim: s.pengirim,
        tujuan: s.tujuan,
        perihal: s.perihal,
        jenis: s.jenis,
        keterangan: s.keterangan,
      }));

      const bulanLabel = BULAN_OPTIONS.find((b) => b.value === exportInfo.bulan)?.label ?? exportInfo.bulan;
      const periode = `${bulanLabel} ${exportInfo.tahun}`;

      const res = await fetch('/api/excel/arsip-surat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...exportInfo, periode, items }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Gagal mengekspor.', { id: toastId });
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="?([^"]+)"?/);
      const fileName = match?.[1] ?? `ArsipSurat_${exportInfo.bulan}_${exportInfo.tahun}.xlsx`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success('File berhasil diunduh!', { id: toastId });
    } catch {
      toast.error('Terjadi kesalahan jaringan.', { id: toastId });
    } finally {
      setExporting(false);
    }
  }

  const filteredSurat = filterJenis === 'semua'
    ? suratList
    : suratList.filter((s) => s.jenis === filterJenis);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Toaster position="top-right" />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Arsip Surat</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola arsip surat masuk dan keluar unit kerja Anda.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {[
          { id: 'tambah', label: 'Tambah Surat' },
          { id: 'lihat', label: 'Lihat Arsip' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as 'tambah' | 'lihat')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tambah Tab */}
      {activeTab === 'tambah' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Nomor Surat */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nomor Surat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nomor_surat"
                  value={form.nomor_surat}
                  onChange={handleFormChange}
                  placeholder="Contoh: 001/DPK/I/2025"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Pengirim */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pengirim <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="pengirim"
                  value={form.pengirim}
                  onChange={handleFormChange}
                  placeholder="Nama pengirim / instansi pengirim"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tujuan */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tujuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="tujuan"
                  value={form.tujuan}
                  onChange={handleFormChange}
                  placeholder="Tujuan surat"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Perihal */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Perihal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="perihal"
                  value={form.perihal}
                  onChange={handleFormChange}
                  placeholder="Perihal / isi singkat surat"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Jenis */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Jenis Surat <span className="text-red-500">*</span>
                </label>
                <select
                  name="jenis"
                  value={form.jenis}
                  onChange={handleFormChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="masuk">Surat Masuk</option>
                  <option value="keluar">Surat Keluar</option>
                </select>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Keterangan
                </label>
                <input
                  type="text"
                  name="keterangan"
                  value={form.keterangan}
                  onChange={handleFormChange}
                  placeholder="Keterangan tambahan (opsional)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Simpan Surat
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lihat Arsip Tab */}
      {activeTab === 'lihat' && (
        <div className="space-y-4">
          {/* Export Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Ekspor ke Excel</h3>
            <form onSubmit={handleExport} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Instansi</label>
                <input
                  type="text"
                  value={exportInfo.instansi}
                  onChange={(e) => setExportInfo((p) => ({ ...p, instansi: e.target.value }))}
                  placeholder="Nama instansi"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Unit Kerja</label>
                <input
                  type="text"
                  value={exportInfo.unitKerja}
                  onChange={(e) => setExportInfo((p) => ({ ...p, unitKerja: e.target.value }))}
                  placeholder="Unit kerja"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bulan</label>
                <select
                  value={exportInfo.bulan}
                  onChange={(e) => setExportInfo((p) => ({ ...p, bulan: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {BULAN_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tahun</label>
                <select
                  value={exportInfo.tahun}
                  onChange={(e) => setExportInfo((p) => ({ ...p, tahun: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={exporting || suratList.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Mengekspor...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Ekspor Excel
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Filter:</span>
            {(['semua', 'masuk', 'keluar'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilterJenis(f)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterJenis === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f === 'semua' ? 'Semua' : f === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingList ? (
              <div className="flex items-center justify-center py-16">
                <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : filteredSurat.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">📬</div>
                <p className="text-sm font-medium text-slate-600">Belum ada arsip surat</p>
                <p className="text-xs text-slate-400 mt-1">
                  Tambah surat melalui tab &quot;Tambah Surat&quot;.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['No', 'Nomor Surat', 'Tanggal', 'Pengirim', 'Tujuan', 'Perihal', 'Jenis', 'Keterangan'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSurat.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2.5 text-xs text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-700">{s.nomor_surat}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{formatTanggal(s.tanggal)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-700">{s.pengirim}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-700">{s.tujuan}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[200px] truncate">{s.perihal}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.jenis === 'masuk'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {s.jenis === 'masuk' ? 'Masuk' : 'Keluar'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{s.keterangan ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
