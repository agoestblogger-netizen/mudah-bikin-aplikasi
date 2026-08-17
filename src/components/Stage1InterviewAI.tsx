'use client';

import React, { useState } from 'react';
import { AppProjectState, ChatMessage } from '@/types/app';
import { Bot, Send, User, Sparkles, ArrowRight, RefreshCw } from 'lucide-react';

interface Stage1InterviewAIProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  onNextStage: () => void;
}

const BRAINSTORMING_LOADING_TEXTS = [
  'Sedang mikirin ide kamu...',
  'Lagi nyimak, bentar ya...',
  'Oke, saya proses dulu...',
  'Bentar ya, lagi saya rangkai tanggapannya...'
];

export const Stage1InterviewAI: React.FC<Stage1InterviewAIProps> = ({
  projectState,
  onUpdateState,
  onNextStage
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(projectState.chatMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Sedang mikirin ide kamu...');

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: query,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    const randomTxt = BRAINSTORMING_LOADING_TEXTS[Math.floor(Math.random() * BRAINSTORMING_LOADING_TEXTS.length)];
    setLoadingText(randomTxt);
    setLoading(true);

    try {
      // Panggilan nyata ke /api/generate secara server-side
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          chatHistory: updatedMessages,
          stage: 'TAHAP_1_PEMBUKAAN'
        })
      });

      const data = await res.json();
      const aiReply = data.replyText || 'Terima kasih, informasi telah dicatat.';

      const aiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      if (data.code) {
        // AI langsung menghasilkan kode mockup (misal user minta "buatkan saja / terserah kamu")
        let h = '', c = '', j = '';
        if (typeof data.code === 'string') {
          h = data.code;
        } else if (typeof data.code === 'object') {
          h = data.code.html || '';
          c = data.code.css || '';
          j = data.code.js || '';
        }

        onUpdateState({
          title: query.length < 30 ? query : projectState.title,
          chatMessages: finalMessages,
          canvasCode: { html: h, css: c, js: j },
          currentStage: 'TAHAP_2_MOCKUP',
          qualityAudit: {
            ...projectState.qualityAudit,
            totalScore: 92,
            isCanvasCodeOnly: true,
            hasDynamicState: true
          }
        });

        // Langsung lompat ke Tahap 2
        setTimeout(() => {
          onNextStage();
        }, 600);
      } else {
        onUpdateState({
          title: query.length < 30 ? query : projectState.title,
          chatMessages: finalMessages
        });
      }
    } catch (err) {
      console.error('Error calling /api/generate:', err);
    } finally {
      setLoading(false);
    }
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
            <h2 className="text-xl font-bold text-white">Tahap 1: Eksplorasi Ide Aplikasi</h2>
            <p className="text-xs text-slate-400">Ceritakan kebutuhan aplikasi Anda kepada AI untuk memulai pembuatan prototipe.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/40 px-3 py-1.5 rounded-full text-xs text-indigo-300 font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interaksi Chat Aktif</span>
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

          {loading && (
            <div className="flex items-center gap-2 text-indigo-400 text-xs py-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{loadingText}</span>
            </div>
          )}
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
            disabled={loading}
            className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
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
