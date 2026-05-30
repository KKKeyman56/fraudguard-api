import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ASNFlow – Otomasi Administrasi ASN Indonesia', template: '%s | ASNFlow' },
  description: 'Platform SaaS untuk mengotomasi pekerjaan administrasi Aparatur Sipil Negara Indonesia.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}
