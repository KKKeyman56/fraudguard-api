import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SIASN – Sistem Informasi ASN Indonesia',
  description: 'Portal administrasi Aparatur Sipil Negara Republik Indonesia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
