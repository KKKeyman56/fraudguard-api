'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Card, { CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Membership } from '@/types';
import { createClient } from '@/lib/supabase/client';

declare global {
  interface Window { snap: { pay: (token: string, opts: object) => void } }
}

export default function MembershipPage() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('memberships').select('*').eq('user_id', user.id).single()
        .then(({ data }) => { setMembership(data); setLoading(false); });
    });
    // Load Midtrans Snap.js
    const script = document.createElement('script');
    script.src = process.env.MIDTRANS_IS_PRODUCTION === 'true'
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '');
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const res = await fetch('/api/payment/create', { method: 'POST' });
      const { token } = await res.json();
      if (!token) throw new Error('Token tidak tersedia.');
      window.snap.pay(token, {
        onSuccess: () => { toast.success('Pembayaran berhasil! Akun Anda telah diupgrade ke Pro.'); window.location.reload(); },
        onPending: () => toast('Pembayaran pending. Selesaikan pembayaran Anda.'),
        onError: () => toast.error('Pembayaran gagal.'),
        onClose: () => { setUpgradeLoading(false); },
      });
    } catch {
      toast.error('Gagal memulai pembayaran.');
      setUpgradeLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const isPro = membership?.plan === 'pro';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Membership</h1>
        <p className="text-gray-500 text-sm mt-1">Kelola langganan dan upgrade plan Anda</p>
      </div>

      {/* Current status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">Status Langganan Anda</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {isPro && membership?.expires_at ? `Aktif hingga ${formatDate(membership.expires_at)}` : 'Plan Gratis'}
              </p>
            </div>
            <Badge variant={isPro ? 'success' : 'default'}>
              {isPro ? 'Pro' : 'Free'}
            </Badge>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{isPro ? '∞' : '5'}</p>
              <p className="text-xs text-gray-500">Download/bulan</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{isPro ? '4' : '4'}</p>
              <p className="text-xs text-gray-500">Template</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{isPro ? 'Ya' : 'Tidak'}</p>
              <p className="text-xs text-gray-500">AI Assistant</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free */}
        <Card className={`relative ${!isPro ? 'ring-2 ring-brand-500' : ''}`}>
          {!isPro && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full">Plan Anda</span>
            </div>
          )}
          <CardBody className="pt-8">
            <p className="text-lg font-bold text-gray-900">Free</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">Rp 0 <span className="text-base font-normal text-gray-400">/bln</span></p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600">
              {['5 download per bulan', 'Form ASN, Absensi, Arsip, Laporan', 'Format Excel profesional'].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
              <li className="flex items-center gap-2 text-gray-400">
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                AI Assistant
              </li>
            </ul>
          </CardBody>
        </Card>

        {/* Pro */}
        <Card className={`relative bg-brand-900 border-brand-800 ${isPro ? 'ring-2 ring-brand-400' : ''}`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
              {isPro ? 'Plan Anda' : 'Paling Populer'}
            </span>
          </div>
          <CardBody className="pt-8">
            <p className="text-lg font-bold text-white">Pro</p>
            <p className="text-3xl font-bold text-white mt-2">
              {formatCurrency(49000)} <span className="text-base font-normal text-brand-300">/bln</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-brand-100">
              {['Download tidak terbatas', 'Semua template tersedia', 'AI Assistant (GPT-4)', 'Update template otomatis', 'Prioritas support'].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            {!isPro && (
              <Button onClick={handleUpgrade} loading={upgradeLoading} className="w-full mt-6 bg-white text-brand-800 hover:bg-brand-50">
                Upgrade ke Pro
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
