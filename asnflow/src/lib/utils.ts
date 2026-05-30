import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string, locale = 'id-ID'): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatDateShort(dateStr: string, locale = 'id-ID'): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);
}

export const TOOL_LABELS: Record<string, string> = {
  'form-asn': 'Formulir Data ASN',
  'absensi': 'Rekap Absensi',
  'arsip-surat': 'Arsip Surat',
  'laporan': 'Laporan Bulanan',
  'ai-generated': 'AI Generated',
};

export const FREE_DOWNLOAD_LIMIT = 5;

export function getRemainingDownloads(used: number, plan: string): number {
  if (plan === 'pro') return Infinity;
  return Math.max(0, FREE_DOWNLOAD_LIMIT - used);
}
