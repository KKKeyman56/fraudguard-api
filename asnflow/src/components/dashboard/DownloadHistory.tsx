import type { Download } from '@/types';
import { TOOL_LABELS, formatDate } from '@/lib/utils';

interface DownloadHistoryProps {
  downloads: Download[];
}

function FileIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-600">Belum ada riwayat download</p>
      <p className="text-xs text-gray-400 mt-1">Download pertama Anda akan muncul di sini</p>
    </div>
  );
}

function ToolTypeBadge({ toolType }: { toolType: string }) {
  const colorMap: Record<string, string> = {
    'form-asn': 'bg-brand-100 text-brand-700',
    'absensi': 'bg-green-100 text-green-700',
    'arsip-surat': 'bg-orange-100 text-orange-700',
    'laporan': 'bg-purple-100 text-purple-700',
    'ai-generated': 'bg-yellow-100 text-yellow-700',
  };
  const colorClass = colorMap[toolType] ?? 'bg-gray-100 text-gray-700';
  const label = TOOL_LABELS[toolType] ?? toolType;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}

export default function DownloadHistory({ downloads }: DownloadHistoryProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Riwayat Download Terbaru</h2>
      </div>

      {downloads.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nama File
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Jenis
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tanggal
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {downloads.map((download) => (
                <tr key={download.id} className="hover:bg-gray-50 transition-colors">
                  {/* Nama File */}
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <FileIcon />
                      <span className="text-sm text-gray-800 font-medium truncate max-w-[220px]">
                        {download.file_name}
                      </span>
                    </div>
                  </td>

                  {/* Jenis */}
                  <td className="px-6 py-3.5">
                    <ToolTypeBadge toolType={download.tool_type} />
                  </td>

                  {/* Tanggal */}
                  <td className="px-6 py-3.5">
                    <span className="text-sm text-gray-500">
                      {formatDate(download.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
