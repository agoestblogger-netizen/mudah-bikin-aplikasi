'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AppProjectState, ChatMessage } from '@/types/app';
import { Bot, Send, User, Sparkles, RefreshCw, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { BriefKebutuhanCard, parseBriefKebutuhan } from './BriefKebutuhanCard';
import { loadModelSettings } from '@/lib/modelConfig';
import { extractAppTitleFromChat } from '@/lib/extractAppTitle';


interface ChatPanelProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
}

const BRAINSTORMING_LOADING_TEXTS = [
  'Sedang mikirin ide kamu...',
  'Lagi nyimak, bentar ya...',
  'Oke, saya proses dulu...',
  'Bentar ya, lagi saya rangkai tanggapannya...'
];

function getContextualLoadingText(query: string, hasCode: boolean, hasBrief: boolean): string {
  const lower = query.toLowerCase().trim();

  const hasExplicitQuestion = query.includes('?') || /(^|\b)(apakah|apa\s+kamu\s+paham|paham\s+kah|paham\s+gak|paham\s+kan|ngerti\s+gak|ngerti\s+kan|bisa\s+kah|gimana\s+menurutmu|bagaimana\s+menurutmu|menurut\s+kamu|kenapa|mengapa|bagaimana\s+cara|tolong\s+jelaskan|apa\s+maksud|apakah\s+bisa|jelaskan)($|\b)/i.test(lower);
  const isExecutionApproval = /(^|\b)(ok|oke|sip|setuju|lanjut|lanjutkan|siap|deal|sudah sesuai|sesuai|buatkan|buatkan sekarang|bikin sekarang|gas|kerjakan|terapkan|eksekusi|ganti sekarang|ubah sekarang|update sekarang)($|\b)/i.test(lower);
  const isSignificantRevision = (
    hasExplicitQuestion ||
    /(ganti|ubah|rombak|bikin|buat)\s+(sistem\s+login|mekanisme\s+role|role\s+switcher|arsitektur|seluruh\s+role|struktur\s+utama)/i.test(lower) ||
    /(tambah|kurang|hapus|ganti)\s+role/i.test(lower) ||
    /(sistem\s+login\s+sungguhan|login\s+asli|multi\s+role\s+baru|rombak\s+total)/i.test(lower) ||
    (query.length > 220 && (lower.includes('role') || lower.includes('halaman') || lower.includes('fitur')))
  );

  // Jika sudah ada kode aplikasi (tahap revisi/patch)
  if (hasCode) {
    if (isSignificantRevision && !isExecutionApproval) {
      return 'AI sedang menyiapkan penjelasan & konfirmasi...';
    }
    if (lower.includes('tambah') || lower.includes('ganti') || lower.includes('ubah') || lower.includes('revisi') || lower.includes('warna') || lower.includes('tombol') || isExecutionApproval) {
      return 'AI sedang menerapkan revisi...';
    }
    return 'AI sedang memperbarui aplikasi...';
  }

  // Jika terkait perbaikan kendala / error
  if (lower.includes('error') || lower.includes('bug') || lower.includes('rusak') || lower.includes('kendala') || lower.includes('kenapa')) {
    return 'AI sedang menganalisa kendala...';
  }

  // Jika terkait backend / spreadsheet
  if (lower.includes('backend') || lower.includes('spreadsheet') || lower.includes('sheet') || lower.includes('gas') || lower.includes('database')) {
    return 'AI sedang menyiapkan backend...';
  }

  // Hanya jika SUDAH ADA Brief Kebutuhan dan pengguna mengonfirmasi persetujuan untuk mulai generate mockup
  if (hasBrief && isExecutionApproval) {
    return 'AI sedang membangun aplikasi...';
  }

  // Tahap diskusi / brainstorming awal santai (rotasi acak)
  const randomIndex = Math.floor(Math.random() * BRAINSTORMING_LOADING_TEXTS.length);
  return BRAINSTORMING_LOADING_TEXTS[randomIndex];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  projectState,
  onUpdateState,
  isGenerating,
  setIsGenerating
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(projectState.chatMessages);
  const [input, setInput] = useState('');
  const [railExpanded, setRailExpanded] = useState(false);
  const [loadingText, setLoadingText] = useState('Sedang mikirin ide kamu...');
  // streamingText: teks ghost bubble yang sedang di-stream (null = tidak streaming)
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll ke bawah saat pesan baru tiba
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, streamingText]);

  // Sinkronisasi pesan jika state luar berubah (misal reset project)
  useEffect(() => {
    setMessages(projectState.chatMessages);
  }, [projectState.chatMessages]);

  // Auto-resize textarea mengikuti isi baris teks
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter tanpa Shift: kirim pesan
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    // Shift+Enter: baris baru alami (tidak dicegat)
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isGenerating) return;

    const hasBrief = messages.some(m => m.text.includes('Brief Kebutuhan') || m.text.includes('Nama App:'));
    // Tentukan teks status loading kontekstual
    const contextualText = getContextualLoadingText(query, Boolean(projectState.canvasCode?.html), hasBrief);
    setLoadingText(contextualText);

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsGenerating(true);
    setStreamingText(null);

    try {
      // Tentukan stage percakapan secara dinamis
      let currentStage = 'TAHAP_1_PEMBUKAAN';
      if (projectState.canvasCode.html) {
        currentStage = 'TAHAP_5_PATCH';
      }

      const modelSettings = loadModelSettings();
      const payload: Record<string, unknown> = {
        prompt: query,
        chatHistory: updatedMessages,
        stage: currentStage,
        currentCode: projectState.canvasCode.html
      };
      payload.userProvider = modelSettings.provider;
      if (modelSettings.token) {
        payload.userApiKey = modelSettings.token;
        payload.userModel = modelSettings.model;
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorMsg = 'Terjadi kesalahan pada server saat memproses permintaan.';
        if (res.status === 504) {
          errorMsg = '⏱️ Batas waktu server tercapai (Timeout 504). Proses generate/revisi memakan waktu lebih dari 60 detik. Silakan coba kembali atau sederhanakan instruksi.';
        } else if (res.status === 429) {
          errorMsg = '⏳ Batas kuota request tercapai. Mohon tunggu beberapa detik sebelum mencoba kembali.';
        } else {
          try {
            const errData = await res.json();
            if (errData.error) errorMsg = `⚠️ ${errData.error}`;
          } catch (_) {}
        }

        const errorAiMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'AI',
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };
        const finalMessages = [...updatedMessages, errorAiMsg];
        setMessages(finalMessages);
        onUpdateState({ chatMessages: finalMessages });
        return;
      }

      const contentType = res.headers.get('Content-Type') || '';

      // =====================================================================
      // PATH A: SSE STREAMING (Ideation mode — text/event-stream)
      // Token muncul satu per satu di ghost bubble, tanpa menunggu full response
      // =====================================================================
      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let finalReplyText = '';
        let finalCode: any = null;

        // Mulai tampilkan ghost bubble segera (kosong dulu)
        setStreamingText('');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += dec.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') continue;
            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'chunk' && parsed.text) {
                accumulated += parsed.text;
                setStreamingText(accumulated);
              } else if (parsed.type === 'done') {
                finalReplyText = parsed.replyText || accumulated;
                finalCode = parsed.code || null;
              }
            } catch (_) {}
          }
        }

        // Selesai streaming: ghost bubble → pesan permanen
        setStreamingText(null);

        const aiMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'AI',
          text: finalReplyText || accumulated,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        const finalMessages = [...updatedMessages, aiMsg];
        setMessages(finalMessages);

        const stateUpdates: Partial<AppProjectState> = { chatMessages: finalMessages };
        stateUpdates.title = extractAppTitleFromChat(finalMessages) ?? (query.length < 30 ? query : projectState.title);
        if (finalCode) {
          let h = '', c = '', j = '';
          if (typeof finalCode === 'string') { h = finalCode; }
          else if (typeof finalCode === 'object') { h = finalCode.html || ''; c = finalCode.css || ''; j = finalCode.js || ''; }
          stateUpdates.canvasCode = { html: h, css: c, js: j };
        }
        onUpdateState(stateUpdates);
        return;
      }

      // =====================================================================
      // PATH B: BATCH JSON (Generate kode / Tahap 2-6 — application/json)
      // Tidak berubah dari implementasi sebelumnya
      // =====================================================================
      const data = await res.json();
      const aiReply = data.replyText || (data.success ? '✨ Perubahan berhasil diproses.' : '⚠️ Permintaan tidak dapat diproses.');

      const aiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      const stateUpdates: Partial<AppProjectState> = {
        chatMessages: finalMessages
      };
      stateUpdates.title = extractAppTitleFromChat(finalMessages) ?? (query.length < 30 ? query : projectState.title);

      // Jika AI menghasilkan / memperbarui kode mockup HTML
      if (data.code) {
        let h = '', c = '', j = '';
        if (typeof data.code === 'string') {
          h = data.code;
        } else if (typeof data.code === 'object') {
          h = data.code.html || '';
          c = data.code.css || '';
          j = data.code.js || '';
        }
        stateUpdates.canvasCode = { html: h, css: c, js: j };
      }

      onUpdateState(stateUpdates);
    } catch (err: any) {
      console.error('Error in chat generation:', err);
      const networkErrorMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: `⚠️ Gagal terhubung ke server (${err.message || 'Network error'}). Silakan periksa koneksi internet Anda dan coba lagi.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...updatedMessages, networkErrorMsg];
      setMessages(finalMessages);
      onUpdateState({ chatMessages: finalMessages });
    } finally {
      setStreamingText(null);
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-100px)] grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
      {/* Sidebar Kiri: hanya badge/icon, konten judul dipindah ke atas canvas kiri */}
      <aside
        className={`col-start-1 row-start-1 row-span-2 flex flex-col border-r border-slate-800/80 bg-slate-950/80 p-2 overflow-hidden transition-[width] duration-300 ease-out ${
          railExpanded ? 'w-48' : 'w-[68px]'
        }`}
      >
        <button
          onClick={() => setRailExpanded(v => !v)}
          className={`h-10 rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-white transition-all flex items-center ${
            railExpanded ? 'w-full justify-between px-3' : 'w-full justify-center'
          }`}
          title={railExpanded ? 'Ciutkan panel chat' : 'Perluas panel chat'}
          aria-label={railExpanded ? 'Ciutkan panel chat' : 'Perluas panel chat'}
        >
          {railExpanded && <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Panel Chat</span>}
          {railExpanded ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
        </button>

        <div className="mt-3 flex flex-col gap-2 items-center">
          <div
            className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/25 bg-indigo-500/10 text-indigo-200 shadow-[inset_3px_0_0_0_rgba(99,102,241,0.7)]"
            title="Percakapan AI"
          >
            <Bot className="w-5 h-5" />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
          </div>

          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-300"
            title="AI Generator Aktif"
          >
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="mt-auto px-1 pb-1 text-center">
          <span className="font-semibold uppercase text-slate-600 text-[8px] tracking-[0.12em]">AI</span>
        </div>
      </aside>

      {/* Main Chat Column */}
      <div className="col-start-2 row-start-1 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Header dipindah ke atas canvas kiri */}
        <div className="shrink-0 px-6 pt-5 pb-4 border-b border-slate-800/70 bg-slate-950/25">
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-400/30 bg-indigo-500/15 text-indigo-300">
                <Bot className="w-4 h-4" />
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white leading-tight">Percakapan AI</h2>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Deskripsikan ide aplikasi, minta penambahan fitur, atau laporkan kendala.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300 px-4 py-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-[11px] font-medium">AI Generator Aktif</span>
            </div>
          </div>
        </div>

        {/* Message History Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m) => {
          const briefData = m.sender === 'AI' ? parseBriefKebutuhan(m.text) : null;

          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${
                m.sender === 'USER' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  m.sender === 'USER'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-slate-800 border border-slate-700 text-slate-300'
                }`}
              >
                {m.sender === 'USER' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-indigo-400" />}
              </div>

              {briefData ? (
                <div className="flex-1 max-w-[95%]">
                  <BriefKebutuhanCard data={briefData} />
                  <span className="text-[10px] block text-right pt-1 opacity-60">
                    {m.timestamp}
                  </span>
                </div>
              ) : (
                <div
                  className={`max-w-[82%] rounded-2xl p-4 space-y-2 text-xs leading-relaxed ${
                    m.sender === 'USER'
                      ? 'bg-indigo-600 text-white shadow-md rounded-tr-none'
                      : 'bg-slate-950 border border-slate-800/80 text-slate-200 shadow-inner rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  
                  {/* Opsi Saran Cepat (jika ada pada sapaan awal) */}
                  {m.suggestedOptions && m.suggestedOptions.length > 0 && messages.length <= 1 && (
                    <div className="pt-3 border-t border-slate-800/60 flex flex-wrap gap-2">
                      {m.suggestedOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(opt)}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all text-left"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className={`text-[10px] block text-right pt-1 opacity-60`}>
                    {m.timestamp}
                  </span>
                </div>
              )}
            </div>
          );
        })}


        {/* Ghost Bubble — SSE Streaming (Ideation Mode) */}
        {streamingText !== null && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
            <div className="max-w-[82%] bg-slate-950 border border-indigo-500/30 rounded-2xl rounded-tl-none p-4 text-xs text-slate-200 shadow-inner leading-relaxed">
              <p className="whitespace-pre-wrap">
                {streamingText}
                <span className="inline-block w-1.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse rounded-sm align-middle" />
              </p>
            </div>
          </div>
        )}

        {/* Loading Spinner — Batch Pipeline (Generate Kode) */}
        {isGenerating && streamingText === null && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-xs text-slate-300 flex items-center gap-2 shadow-inner">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>{loadingText}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />

        </div>
      </div>

      {/* Input Area */}
      <div className="col-start-2 row-start-2 p-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500 transition-all shadow-inner"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            placeholder="Ketik instruksi aplikasi Anda di sini... (Enter untuk kirim, Shift+Enter untuk baris baru)"
            className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none disabled:opacity-50 resize-none max-h-40 min-h-[36px] overflow-y-auto leading-relaxed scrollbar-thin"
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-30 shadow-md shrink-0 mb-0.5"
            aria-label="Kirim Pesan"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
