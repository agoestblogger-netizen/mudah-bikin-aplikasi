'use client';

import React, { useState } from 'react';
import { AppProjectState, ChatMessage } from '@/types/app';
import { Bot, Send, User, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

interface Stage1InterviewAIProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  onNextStage: () => void;
}

export const Stage1InterviewAI: React.FC<Stage1InterviewAIProps> = ({
  projectState,
  onUpdateState,
  onNextStage
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(projectState.chatMessages);
  const [input, setInput] = useState('');
  const [questionCount, setQuestionCount] = useState(1);

  // Simulated AI response generator based on user input
  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    // Generate next dynamic question from AI (Max 3-4 focused questions)
    setTimeout(() => {
      let aiText = '';
      let suggestions: string[] = [];

      if (questionCount === 1) {
        aiText = `Bagus sekali! Aplikasi "${query}" menarik sekali.\n\nPertanyaan 2 dari 3: Siapa target pengguna utama aplikasi ini, dan apakah aplikasi memerlukan fitur Login (termasuk Role Admin untuk kelola user)?`;
        suggestions = [
          'Memerlukan Login & Role Admin (Fitur Tambah User)',
          'Hanya Login Sederhana (Satu Jenis User)',
          'Publik (Tanpa Login)'
        ];
        setQuestionCount(2);

        // Dynamically update specs
        onUpdateState({
          title: query,
          mandatorySpecs: {
            ...projectState.mandatorySpecs,
            appType: query
          }
        });
      } else if (questionCount === 2) {
        aiText = `Dicatat! Proteksi autentikasi sudah diset.\n\nPertanyaan 3 dari 3: Apa saja 3-5 tombol aksi atau alur kerja paling penting yang wajib ada di aplikasi ini? (Contoh: Tambah Barang, Proses Kasir, Cetak Laporan)`;
        suggestions = [
          'Tambah Barang, Transaksi POS, Cetak Struk, Tambah User Admin',
          'Input Data, Filter Kategori, Export Excel',
          'Formulir Pendaftaran, Verifikasi Data, Cetak Kartu'
        ];
        setQuestionCount(3);

        const requiresLogin = !query.toLowerCase().includes('tanpa login');
        const hasAdminRole = query.toLowerCase().includes('admin');

        onUpdateState({
          mandatorySpecs: {
            ...projectState.mandatorySpecs,
            targetUsers: query,
            requiresLogin,
            hasAdminRole,
            hasUserManagement: hasAdminRole
          }
        });
      } else {
        aiText = `Terima kasih banyak! Semua kebutuhan utama untuk Tahap 1 sudah lengkap.\n\nSpesifikasi aplikasi Anda siap ditransformasikan secara instan ke Tahap 2 (Mockup Canvas & Dynamic State JS). Klik tombol di bawah untuk melanjutkan!`;
        suggestions = [];
        setQuestionCount(4);

        const actions = query.split(',').map((s) => s.trim());
        onUpdateState({
          mandatorySpecs: {
            ...projectState.mandatorySpecs,
            keyButtonsActions: actions
          }
        });
      }

      const aiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: aiText,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        suggestedOptions: suggestions
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      onUpdateState({ chatMessages: finalMessages });
    }, 600);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Tahap 1 PRD: Pembukaan Singkat (Interaktif Chat AI)</h2>
            <p className="text-xs text-slate-400">AI menentukan pertanyaan berikutnya secara dinamis berdasarkan respon Anda (2-4 pertanyaan fokus).</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/40 px-3 py-1.5 rounded-full text-xs text-indigo-300 font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Progres Wawancara: {Math.min(questionCount * 25, 100)}%</span>
        </div>
      </div>

      {/* Chat Window */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-6 backdrop-blur-xl min-h-[450px] flex flex-col justify-between">
        {/* Message History */}
        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 no-scrollbar">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${m.sender === 'USER' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                  m.sender === 'AI'
                    ? 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-md'
                    : 'bg-slate-800 border border-slate-700 text-slate-300'
                }`}
              >
                {m.sender === 'AI' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed space-y-2 ${
                  m.sender === 'AI'
                    ? 'bg-slate-950 border border-slate-800 text-slate-200'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                }`}
              >
                <p className="whitespace-pre-line">{m.text}</p>
                <span className="text-[10px] opacity-60 block text-right">{m.timestamp}</span>

                {/* Suggested Quick Options */}
                {m.sender === 'AI' && m.suggestedOptions && m.suggestedOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/80">
                    {m.suggestedOptions.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(opt)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all text-xs font-medium text-left"
                      >
                        + {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Tuliskan jawaban Anda di sini..."
            className="flex-1 px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => handleSendMessage()}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
          >
            <span>Kirim</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Next Stage Action */}
      <div className="flex justify-end pt-2">
        <button
          onClick={onNextStage}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all"
        >
          <span>Lanjut ke Tahap 2: Mockup & Preview Canvas</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
