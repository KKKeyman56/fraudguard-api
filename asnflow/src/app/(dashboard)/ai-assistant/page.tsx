'use client';

import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import Card, { CardBody, CardHeader } from '@/components/ui/Card';

const SUGGESTIONS = [
  'Buat laporan kegiatan rapat koordinasi bulan Mei 2025',
  'Buat rekap absensi pegawai unit keuangan bulan Juni',
  'Buat formulir data ASN untuk jabatan Kepala Seksi',
  'Buat arsip surat masuk dari Kementerian Dalam Negeri',
];

interface Message {
  role: 'user' | 'ai';
  content: string;
  downloadUrl?: string;
  fileName?: string;
  toolType?: string;
}

export default function AIAssistantPage() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (text = prompt) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Gagal generate dokumen.');
      }

      const blob = await res.blob();
      const summary = decodeURIComponent(res.headers.get('X-AI-Summary') ?? 'Dokumen berhasil dibuat.');
      const toolType = res.headers.get('X-AI-Tool-Type') ?? '';
      const fileName = `AI_${toolType}_${Date.now()}.xlsx`;
      const url = URL.createObjectURL(blob);

      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: summary, downloadUrl: url, fileName, toolType },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan.';
      toast.error(msg);
      setMessages((prev) => [...prev, { role: 'ai', content: `Maaf, ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    toast.success('File berhasil diunduh!');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Assistant</h1>
        <p className="text-gray-500 text-sm mt-1">
          Ketik perintah dalam bahasa Indonesia, AI akan otomatis membuat dan mengisi dokumen Excel.
        </p>
      </div>

      {/* How it works */}
      <Card>
        <CardBody className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-brand-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Cara kerja AI Assistant</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Ketik perintah seperti "Buat laporan kegiatan rapat bulan Mei" — AI akan memilih template yang tepat,
                mengisi data secara otomatis, dan menghasilkan file Excel siap unduh.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Chat messages */}
      {messages.length > 0 && (
        <Card>
          <CardBody className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold">AI</div>
                )}
                <div className={`max-w-sm rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-brand-700 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  <p>{msg.content}</p>
                  {msg.downloadUrl && (
                    <button
                      onClick={() => handleDownload(msg.downloadUrl!, msg.fileName!)}
                      className="mt-2 flex items-center gap-1.5 bg-white text-brand-700 font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors w-full justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download {msg.fileName}
                    </button>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0 text-gray-600 text-xs font-bold">U</div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 bg-brand-700 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold">AI</div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Suggestions */}
      {messages.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSubmit(s)}
              className="text-left p-4 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-brand-400 hover:bg-brand-50 transition-colors"
            >
              <span className="text-brand-600 mr-2">✦</span>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <Card>
        <CardBody className="p-3">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="Ketik perintah Anda... (Enter untuk kirim)"
              rows={2}
              className="flex-1 resize-none px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            <Button onClick={() => handleSubmit()} loading={loading} disabled={!prompt.trim()} size="lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
