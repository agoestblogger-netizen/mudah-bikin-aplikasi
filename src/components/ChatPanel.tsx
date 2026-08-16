'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AppProjectState, ChatMessage } from '@/types/app';
import { Bot, Send, User, Sparkles, RefreshCw } from 'lucide-react';

interface ChatPanelProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  projectState,
  onUpdateState,
  isGenerating,
  setIsGenerating
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(projectState.chatMessages);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll ke bawah saat pesan baru tiba
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Sinkronisasi pesan jika state luar berubah (misal reset project)
  useEffect(() => {
    setMessages(projectState.chatMessages);
  }, [projectState.chatMessages]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsGenerating(true);

    try {
      // Tentukan stage percakapan secara dinamis
      let currentStage = 'TAHAP_1_PEMBUKAAN';
      if (projectState.canvasCode.html) {
        currentStage = 'TAHAP_5_PATCH';
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          chatHistory: updatedMessages,
          stage: currentStage,
          currentCode: projectState.canvasCode.html
        })
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
        stateUpdates.title = query.length < 30 ? query : projectState.title;
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
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">Percakapan AI</h2>
            <p className="text-[11px] text-slate-400">Deskripsikan ide aplikasi, minta penambahan fitur, atau laporkan kendala.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/40 px-3 py-1 rounded-full text-[11px] text-indigo-300 font-medium">
          <Sparkles className="w-3 h-3" />
          <span>AI Generator Aktif</span>
        </div>
      </div>

      {/* Message History Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m) => (
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
          </div>
        ))}

        {isGenerating && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-xs text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>AI sedang memproses dan membangun aplikasi...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500 transition-all shadow-inner"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            placeholder="Ketik instruksi aplikasi Anda di sini (misal: 'buatkan aplikasi catatan tugas')..."
            className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isGenerating}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-30 shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
