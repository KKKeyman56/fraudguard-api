import type { DashboardStats } from '@/types';
import { FREE_DOWNLOAD_LIMIT } from '@/lib/utils';

interface StatsCardsProps {
  stats: DashboardStats;
}

function DownloadTotalIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function DownloadMonthIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function QuotaIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function MembershipIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: React.ReactNode;
  footer?: React.ReactNode;
}

function StatCard({ icon, iconBg, iconColor, label, value, footer }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      </div>
      {footer && <div>{footer}</div>}
    </div>
  );
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const isPro = stats.membershipPlan === 'pro';

  // Quota calculation
  const usedThisMonth = stats.downloadsThisMonth;
  const limit = isPro ? null : FREE_DOWNLOAD_LIMIT;
  const remaining = isPro ? Infinity : Math.max(0, FREE_DOWNLOAD_LIMIT - usedThisMonth);
  const quotaPercent = limit ? Math.min(100, Math.round((usedThisMonth / limit) * 100)) : 0;

  const quotaBarColor =
    quotaPercent >= 90 ? 'bg-red-500' :
    quotaPercent >= 60 ? 'bg-yellow-500' :
    'bg-brand-500';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Total Download */}
      <StatCard
        icon={<DownloadTotalIcon />}
        iconBg="bg-brand-50"
        iconColor="text-brand-600"
        label="Total Download"
        value={stats.totalDownloads.toLocaleString('id-ID')}
      />

      {/* Download Bulan Ini */}
      <StatCard
        icon={<DownloadMonthIcon />}
        iconBg="bg-green-50"
        iconColor="text-green-600"
        label="Download Bulan Ini"
        value={stats.downloadsThisMonth.toLocaleString('id-ID')}
      />

      {/* Sisa Kuota */}
      <StatCard
        icon={<QuotaIcon />}
        iconBg="bg-orange-50"
        iconColor="text-orange-500"
        label="Sisa Kuota"
        value={
          isPro ? (
            <span className="text-brand-600">Unlimited</span>
          ) : (
            `${remaining} / ${FREE_DOWNLOAD_LIMIT}`
          )
        }
        footer={
          !isPro ? (
            <div className="flex flex-col gap-1.5">
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${quotaBarColor}`}
                  style={{ width: `${quotaPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">{quotaPercent}% terpakai bulan ini</p>
            </div>
          ) : null
        }
      />

      {/* Plan Membership */}
      <StatCard
        icon={<MembershipIcon />}
        iconBg={isPro ? 'bg-purple-50' : 'bg-gray-50'}
        iconColor={isPro ? 'text-purple-600' : 'text-gray-500'}
        label="Plan Membership"
        value={
          <div className="flex items-center gap-2">
            <span className="capitalize">{stats.membershipPlan}</span>
            {isPro && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                PRO
              </span>
            )}
          </div>
        }
        footer={
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
              stats.membershipStatus === 'active'
                ? 'bg-green-100 text-green-700'
                : stats.membershipStatus === 'expired'
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {stats.membershipStatus === 'active'
              ? 'Aktif'
              : stats.membershipStatus === 'expired'
              ? 'Kadaluarsa'
              : 'Dibatalkan'}
          </span>
        }
      />
    </div>
  );
}
