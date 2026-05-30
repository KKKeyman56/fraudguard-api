export type UserRole = 'user' | 'admin';
export type MembershipPlan = 'free' | 'pro';
export type MembershipStatus = 'active' | 'expired' | 'cancelled';
export type ToolType = 'form-asn' | 'absensi' | 'arsip-surat' | 'laporan' | 'ai-generated';
export type SuratJenis = 'masuk' | 'keluar';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  plan: MembershipPlan;
  status: MembershipStatus;
  midtrans_order_id: string | null;
  started_at: string;
  expires_at: string | null;
  created_at: string;
}

export interface Download {
  id: string;
  user_id: string;
  tool_type: ToolType;
  file_name: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ArsipSurat {
  id: string;
  user_id: string;
  nomor_surat: string;
  tanggal: string;
  pengirim: string;
  tujuan: string;
  perihal: string;
  jenis: SuratJenis;
  keterangan: string | null;
  created_at: string;
}

// Excel form types
export interface FormASNData {
  nama: string;
  nip: string;
  jabatan: string;
  golongan: string;
  unitKerja: string;
  instansi: string;
  tanggal: string;
}

export interface PegawaiAbsensi {
  nama: string;
  nip: string;
  jabatan: string;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
}

export interface AbsensiData {
  instansi: string;
  unitKerja: string;
  bulan: string;
  tahun: string;
  pegawai: PegawaiAbsensi[];
}

export interface LaporanKegiatan {
  namaKegiatan: string;
  tanggal: string;
  tempat: string;
  peserta: string;
  pelaksana: string;
  hasil: string;
  keterangan?: string;
}

export interface LaporanData {
  instansi: string;
  unitKerja: string;
  bulan: string;
  tahun: string;
  kegiatan: LaporanKegiatan[];
}

export interface ArsipSuratExportData {
  instansi: string;
  unitKerja: string;
  periode: string;
  items: Omit<ArsipSurat, 'id' | 'user_id' | 'created_at'>[];
}

export interface AIGenerateRequest {
  prompt: string;
  toolType?: ToolType;
}

export interface AIGenerateResponse {
  toolType: ToolType;
  data: FormASNData | AbsensiData | LaporanData | ArsipSuratExportData;
  summary: string;
}

export interface DashboardStats {
  totalDownloads: number;
  downloadsThisMonth: number;
  downloadsLimit: number;
  membershipPlan: MembershipPlan;
  membershipStatus: MembershipStatus;
  recentDownloads: Download[];
}
