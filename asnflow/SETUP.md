# ASNFlow – Setup & Deployment Guide

## 1. Prasyarat

- Node.js 18+
- Akun Supabase (gratis di supabase.com)
- Akun OpenAI API
- Akun Midtrans (sandbox gratis di sandbox.midtrans.com)
- Akun Vercel

---

## 2. Setup Supabase

### a. Buat project baru di supabase.com

### b. Jalankan migrasi database

Di Supabase Dashboard → SQL Editor, copy-paste dan jalankan isi file:
```
supabase/migrations/001_initial.sql
```

### c. Aktifkan Email Auth

Supabase Dashboard → Authentication → Providers → Email → Enable

### d. Salin credentials

Dari Supabase Dashboard → Project Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 3. Setup OpenAI

1. Buka platform.openai.com
2. API Keys → Create new key
3. Salin ke `OPENAI_API_KEY`

---

## 4. Setup Midtrans

1. Buka sandbox.midtrans.com
2. Settings → Access Keys
3. Salin `Server Key` dan `Client Key`
4. Atur `MIDTRANS_IS_PRODUCTION=false` untuk testing

---

## 5. Install & Jalankan Lokal

```bash
cd asnflow
npm install
cp .env.example .env.local
# Isi semua variabel di .env.local
npm run dev
# Buka http://localhost:3000
```

---

## 6. Buat Akun Admin

Setelah register akun pertama, jalankan di Supabase SQL Editor:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'email-anda@example.com';
```

---

## 7. Deploy ke Vercel

### a. Push ke GitHub
```bash
git add .
git commit -m "feat: ASNFlow SaaS"
git push
```

### b. Import di Vercel
1. Buka vercel.com → New Project
2. Import repo dari GitHub
3. Set **Root Directory** ke `asnflow`
4. Tambahkan semua environment variables dari `.env.example`
5. Deploy

### c. Setup Midtrans Webhook
Di Midtrans Dashboard → Settings → Configuration:
- Payment Notification URL: `https://your-domain.vercel.app/api/payment/webhook`

### d. Update Supabase Auth URL
Di Supabase → Authentication → URL Configuration:
- Site URL: `https://your-domain.vercel.app`
- Redirect URLs: `https://your-domain.vercel.app/**`

---

## 8. Environment Variables Lengkap

| Variable | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (jangan expose ke client!) |
| `OPENAI_API_KEY` | API key OpenAI |
| `MIDTRANS_SERVER_KEY` | Server key Midtrans |
| `MIDTRANS_CLIENT_KEY` | Client key Midtrans |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Client key Midtrans (untuk Snap.js) |
| `MIDTRANS_IS_PRODUCTION` | `false` untuk sandbox, `true` untuk production |
| `NEXT_PUBLIC_APP_URL` | URL aplikasi (contoh: https://asnflow.vercel.app) |

---

## 9. Struktur Folder

```
asnflow/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login, Register, Reset Password
│   │   ├── (dashboard)/     # Dashboard, Tools, AI, Riwayat, Membership
│   │   ├── (admin)/         # Admin panel
│   │   └── api/             # API routes
│   ├── components/
│   │   ├── ui/              # Button, Input, Card, Badge
│   │   ├── layout/          # Sidebar, Header
│   │   ├── dashboard/       # StatsCards, DownloadHistory
│   │   └── tools/           # Form components per tool
│   ├── lib/
│   │   ├── supabase/        # Client & Server Supabase
│   │   ├── excel/           # ExcelJS generators
│   │   ├── ai/              # OpenAI integration
│   │   └── payment/         # Midtrans integration
│   └── types/               # TypeScript interfaces
└── supabase/
    └── migrations/          # SQL schema
```
