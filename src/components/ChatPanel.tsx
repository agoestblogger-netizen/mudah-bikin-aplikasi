'use client';

import React, { useState, useRef, useEffect } from 'react';
import { AppProjectState, ChatMessage } from '@/types/app';
import { 
  Bot, 
  Send, 
  User, 
  Sparkles, 
  RefreshCw, 
  Plus, 
  Mic, 
  MicOff, 
  ChevronDown, 
  Check, 
  Wrench, 
  FileText, 
  Database,
  Menu,
  ChevronRight
} from 'lucide-react';
import { BriefKebutuhanCard, parseBriefKebutuhan } from './BriefKebutuhanCard';
import { DemoCredentialsCard, parseDemoCredentials } from './DemoCredentialsCard';
import { loadModelSettings, getModelLabel, getProviderConfig } from '@/lib/modelConfig';
import type { ModelSettings } from '@/lib/modelConfig';
import { extractAppTitleFromChat } from '@/lib/extractAppTitle';

export type ChatMode = 'BUILD' | 'PLAN' | 'SYNC_GAS';

interface ChatPanelProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  externalSendToken?: string | number;
  externalSendText?: string | null;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

const BRAINSTORMING_LOADING_TEXTS = [
  'Sedang menganalisa ide Anda...',
  'Menyiapkan rancangan aplikasi...',
  'Memproses instruksi Anda...',
  'Merangkai kode dan antarmuka...'
];

function getContextualLoadingText(query: string, hasCode: boolean, hasBrief: boolean, mode: ChatMode): string {
  if (mode === 'PLAN') return 'AI sedang menganalisa dan merancang brief kebutuhan...';
  if (mode === 'SYNC_GAS') return 'AI sedang meracik script backend Google Apps Script...';
  
  const lower = query.toLowerCase().trim();
  if (hasCode) {
    if (lower.includes('error') || lower.includes('bug') || lower.includes('rusak')) {
      return 'AI sedang mendiagnosa & memperbaiki error...';
    }
    return 'AI sedang memperbarui prototype aplikasi...';
  }
  if (hasBrief) {
    return 'AI sedang membangun prototype awal aplikasi...';
  }
  const randomIndex = Math.floor(Math.random() * BRAINSTORMING_LOADING_TEXTS.length);
  return BRAINSTORMING_LOADING_TEXTS[randomIndex];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  projectState,
  onUpdateState,
  isGenerating,
  setIsGenerating,
  externalSendToken,
  externalSendText,
  onToggleSidebar,
  isSidebarCollapsed
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(projectState.chatMessages);
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<ChatMode>(() => {
    if (projectState.canvasCode?.html) return 'BUILD';
    return 'PLAN';
  });
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [loadingText, setLoadingText] = useState('Sedang menganalisa ide Anda...');
  const [streamingText, setStreamingText] = useState<string | null>(null);
  
  const [modelConfig, setModelConfig] = useState<ModelSettings>(() => loadModelSettings());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sinkronisasi model config secara berkala
  useEffect(() => {
    setModelConfig(loadModelSettings());
  }, []);

  // Auto scroll ke bawah
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, streamingText]);

  // Sinkronisasi pesan dari state proyek
  useEffect(() => {
    setMessages(projectState.chatMessages);
  }, [projectState.chatMessages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Menangani klik luar dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setIsModeDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Speech Recognition (Web Speech API)
  const toggleSpeechRecognition = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Browser Anda belum mendukung input suara.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isGenerating) return;

    const hasBrief = messages.some(m => m.text.includes('Brief Kebutuhan') || m.text.includes('Nama App:'));
    const contextualText = getContextualLoadingText(
      query, 
      Boolean(projectState.canvasCode?.html), 
      hasBrief,
      selectedMode
    );
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
      // Menentukan stage percakapan berdasarkan selectedMode & status saat ini
      let currentStage = 'TAHAP_1_PEMBUKAAN';
      if (selectedMode === 'PLAN') {
        currentStage = 'TAHAP_1_PEMBUKAAN';
      } else if (selectedMode === 'SYNC_GAS') {
        currentStage = 'TAHAP_4_BACKEND';
      } else {
        // BUILD MODE
        if (projectState.canvasCode.html) {
          currentStage = 'TAHAP_5_PATCH';
        } else {
          currentStage = 'TAHAP_2_MOCKUP';
        }
      }

      const activeSettings = loadModelSettings();
      const payload: Record<string, unknown> = {
        prompt: query,
        chatHistory: updatedMessages,
        stage: currentStage,
        currentCode: projectState.canvasCode.html,
        mode: selectedMode
      };
      payload.userProvider = activeSettings.provider;
      if (activeSettings.token) {
        payload.userApiKey = activeSettings.token;
        payload.userModel = activeSettings.model;
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorMsg = 'Terjadi kesalahan pada server saat memproses permintaan.';
        if (res.status === 504) {
          errorMsg = '⏱️ Batas waktu server tercapai (Timeout 504). Silakan coba kembali atau sederhanakan instruksi.';
        } else if (res.status === 429) {
          errorMsg = '⏳ Batas kuota tercapai. Mohon tunggu beberapa detik sebelum mencoba kembali.';
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

      if (contentType.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let finalReplyText = '';
        let finalCode: any = null;

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
            if (!raw || raw === '[DONE]') continue;

            try {
              const parsed = JSON.parse(raw);
              if (parsed.type === 'token') {
                accumulated += parsed.content;
                setStreamingText(accumulated);
              } else if (parsed.type === 'done') {
                finalReplyText = parsed.replyText || accumulated;
                finalCode = parsed.code || null;
              }
            } catch (_) {}
          }
        }

        setStreamingText(null);

        const aiMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'AI',
          text: finalReplyText || accumulated,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
        };

        const finalMessages = [...updatedMessages, aiMsg];
        setMessages(finalMessages);

        const extractedTitle = extractAppTitleFromChat(finalMessages);
        const stateUpdate: Partial<AppProjectState> = { chatMessages: finalMessages };
        if (extractedTitle && (!projectState.title || projectState.title === 'Proyek Baru')) {
          stateUpdate.title = extractedTitle;
        }

        if (finalCode) {
          stateUpdate.canvasCode = {
            html: finalCode.html || projectState.canvasCode.html,
            css: finalCode.css || projectState.canvasCode.css,
            js: finalCode.js || projectState.canvasCode.js
          };
        }

        onUpdateState(stateUpdate);
        return;
      }

      // JSON Response (Batch Pipeline)
      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: data.replyText,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      const extractedTitle = extractAppTitleFromChat(finalMessages);
      const stateUpdate: Partial<AppProjectState> = { chatMessages: finalMessages };
      if (extractedTitle && (!projectState.title || projectState.title === 'Proyek Baru')) {
        stateUpdate.title = extractedTitle;
      }

      if (data.code) {
        stateUpdate.canvasCode = {
          html: data.code.html,
          css: data.code.css,
          js: data.code.js
        };
      }

      if (data.gasScript) {
        stateUpdate.gasConfig = {
          ...projectState.gasConfig,
          scriptCode: data.gasScript
        };
      }

      onUpdateState(stateUpdate);
    } catch (err: any) {
      const errorAiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: `⚠️ Kendala koneksi: ${err.message || 'Gagal memproses permintaan.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...updatedMessages, errorAiMsg];
      setMessages(finalMessages);
      onUpdateState({ chatMessages: finalMessages });
    } finally {
      setIsGenerating(false);
      setStreamingText(null);
    }
  };

  // External trigger dari luar (misal dari popover mark)
  useEffect(() => {
    if (externalSendToken && externalSendText) {
      handleSendMessage(externalSendText);
    }
  }, [externalSendToken]);

  const activeProvider = modelConfig.token ? getProviderConfig(modelConfig.provider).label : 'Server Default';
  const activeModelName = modelConfig.token ? getModelLabel(modelConfig.model, modelConfig.provider) : 'Gemini 2.5 Flash';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#08080c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative select-none">
      
      {/* Header Panel Chat (Alternatif 1: Nama Proyek + Dropdown Model AI) */}
      <div className="h-14 px-4 border-b border-white/10 bg-[#0e0e13] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {onToggleSidebar && isSidebarCollapsed && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors mr-1"
              title="Buka Sidebar Navigasi"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-[#10f48e]/15 border border-[#10f48e]/30 flex items-center justify-center text-[#10f48e] shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-white truncate flex items-center gap-1.5" title={projectState.title || 'Proyek Baru'}>
              <span>{projectState.title || 'Proyek Baru'}</span>
            </h2>
          </div>
        </div>

        {/* AI Model Badge / Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[11px] font-medium text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10f48e] animate-pulse shrink-0 shadow-[0_0_6px_#10f48e]" />
            <span className="truncate max-w-[130px] sm:max-w-[180px]">{activeModelName}</span>
          </div>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 select-text">
        {messages.map((m) => {
          const briefData = m.sender === 'AI' ? parseBriefKebutuhan(m.text) : null;
          const credsData = !briefData && m.sender === 'AI' ? parseDemoCredentials(m.text) : null;
          const textToDisplay = credsData ? credsData.cleanText : m.text;

          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${
                m.sender === 'USER' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  m.sender === 'USER'
                    ? 'bg-gradient-to-tr from-emerald-400 to-[#10f48e] text-black shadow-md shadow-[#10f48e]/20'
                    : 'bg-[#14141a] border border-white/10 text-[#10f48e]'
                }`}
              >
                {m.sender === 'USER' ? <User className="w-3.5 h-3.5 stroke-[2.5]" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {briefData ? (
                <div className="flex-1 max-w-[95%]">
                  <BriefKebutuhanCard
                    data={briefData}
                    onApplyBrief={(compiledMarkdown, targetMode) => {
                      if (targetMode === 'BUILD') {
                        setSelectedMode('BUILD');
                        handleSendMessage(
                          `Saya menyetujui skenario dan Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang!`
                        );
                      } else {
                        setSelectedMode('PLAN');
                        handleSendMessage(
                          `Saya telah menyesuaikan rincian brief kebutuhan dan pembagian peran. Mohon sesuaikan skenario alur kerja dan lembar brief aplikasi ini, lalu konfirmasikan kembali:\n\n${compiledMarkdown}`
                        );
                      }
                    }}
                  />
                  <span className="text-[10px] block text-right pt-1 text-zinc-500">
                    {m.timestamp}
                  </span>
                </div>
              ) : (
                <div className="flex-1 max-w-[88%] space-y-2">
                  <div
                    className={`rounded-2xl p-3.5 space-y-2 text-xs leading-relaxed ${
                      m.sender === 'USER'
                        ? 'bg-gradient-to-r from-emerald-500 to-[#0df28a] text-black shadow-lg rounded-tr-none font-semibold ml-auto'
                        : 'bg-[#101015] border border-white/10 text-zinc-200 shadow-inner rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{textToDisplay}</p>
                  
                  {/* Tombol Pintas: Beralih ke Mode Build jika AI meminta beralih ke Build */}
                  {m.sender === 'AI' && selectedMode === 'PLAN' && (
                    m.text.toLowerCase().includes('build (prototype)') || 
                    m.text.toLowerCase().includes('mode ke build') || 
                    m.text.toLowerCase().includes('ganti mode ke build') || 
                    m.text.toLowerCase().includes('ubah mode ke build') ||
                    m.text.toLowerCase().includes('mode build')
                  ) && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMode('BUILD')}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black font-extrabold text-xs shadow-md shadow-[#10f48e]/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Wrench className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>🛠️ Beralih ke Mode Build Sekarang</span>
                      </button>
                    </div>
                  )}

                  {/* Quick Action Pills */}
                  {m.suggestedOptions && m.suggestedOptions.length > 0 && messages.length <= 1 && (
                    <div className="pt-3 border-t border-white/10 flex flex-wrap gap-1.5">
                      {m.suggestedOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendMessage(opt)}
                          className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-[#10f48e]/15 border border-white/10 hover:border-[#10f48e]/35 text-[11px] font-medium text-zinc-300 hover:text-[#10f48e] transition-all text-left active:scale-[0.98]"
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

                {/* Render Kartu Kredensial Akun Demo (DemoCredentialsCard) */}
                {credsData && (
                  <DemoCredentialsCard data={credsData} />
                )}
              </div>
            )}
            </div>
          );
        })}

        {/* Ghost Bubble SSE Streaming */}
        {streamingText !== null && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-[#14141a] border border-white/10 flex items-center justify-center shrink-0 text-[#10f48e]">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="max-w-[85%] bg-[#101015] border border-[#10f48e]/30 rounded-2xl rounded-tl-none p-3.5 text-xs text-zinc-200 shadow-inner leading-relaxed">
              <p className="whitespace-pre-wrap">
                {streamingText}
                <span className="inline-block w-1.5 h-3.5 bg-[#10f48e] ml-0.5 animate-pulse rounded-sm align-middle" />
              </p>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isGenerating && streamingText === null && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-[#14141a] border border-white/10 flex items-center justify-center shrink-0 text-[#10f48e]">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="bg-[#101015] border border-white/10 rounded-2xl rounded-tl-none p-3 text-xs text-zinc-300 flex items-center gap-2 shadow-inner">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#10f48e]" />
              <span>{loadingText}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Capsule Prompt Box (Modern Pure Pitch Black + Neon Green) */}
      <div className="p-3 sm:p-4 bg-gradient-to-t from-[#060609] via-[#08080c] to-transparent shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative bg-[#101016] border border-white/10 hover:border-white/20 focus-within:border-[#10f48e]/60 rounded-2xl p-2.5 transition-all shadow-xl flex flex-col gap-2"
        >
          {/* Indikator Alur Plan vs Build: Jika Brief sudah siap & mode masih Plan */}
          {messages.some(m => m.text.includes('Brief Kebutuhan') || m.text.includes('Nama App:')) && selectedMode === 'PLAN' && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#10f48e]/10 border border-[#10f48e]/25 text-[11px] text-[#10f48e] animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold truncate">Brief Kebutuhan siap! Beralih ke <b>Build</b> untuk membuat prototipe.</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMode('BUILD')}
                className="ml-2 shrink-0 px-2.5 py-0.5 rounded-lg bg-[#10f48e] hover:bg-emerald-400 text-black font-extrabold text-[10px] transition-all cursor-pointer shadow-sm active:scale-95"
              >
                Ganti ke Build
              </button>
            </div>
          )}

          {/* Baris Input Teks */}
          <div className="flex items-start gap-2">
            <button
              type="button"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors shrink-0 mt-0.5"
              title="Aksi Cepat / Lampiran"
            >
              <Plus className="w-4 h-4" />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              placeholder={
                selectedMode === 'PLAN'
                  ? (messages.some(m => m.text.includes('Brief Kebutuhan') || m.text.includes('Nama App:'))
                      ? 'Brief sudah siap. Ketik revisi brief, atau ganti mode ke Build untuk membuat prototipe...'
                      : 'Diskusikan ide & fitur yang ingin Anda rencanakan...')
                  : selectedMode === 'SYNC_GAS'
                  ? 'Ketik instruksi backend Google Apps Script / Sheet database...'
                  : 'Ketik instruksi untuk membangun prototype web app Anda...'
              }
              className="flex-1 bg-transparent px-1 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50 resize-none max-h-36 min-h-[32px] overflow-y-auto leading-relaxed scrollbar-thin"
            />
          </div>

          {/* Baris Bawah Kapsul: Mode Dropdown, Mic, & Send Button */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            {/* Mode Dropdown (Plan / Build / Sync GAS) */}
            <div className="relative" ref={modeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsModeDropdownOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-zinc-200 transition-all"
                title="Pilih Mode Pengerjaan"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#10f48e] shrink-0 shadow-[0_0_6px_#10f48e]" />
                <span>
                  {selectedMode === 'PLAN' && 'Plan (Brief)'}
                  {selectedMode === 'BUILD' && 'Build (Prototype)'}
                  {selectedMode === 'SYNC_GAS' && 'Sync GAS'}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
              </button>

              {/* Dropdown Menu Popover Upward */}
              {isModeDropdownOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-52 rounded-xl bg-[#14141c] border border-white/10 shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('BUILD');
                      setIsModeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selectedMode === 'BUILD' ? 'bg-[#10f48e]/15 text-[#10f48e] font-semibold' : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Build (Prototype)</span>
                    </div>
                    {selectedMode === 'BUILD' && <Check className="w-3.5 h-3.5 text-[#10f48e]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('PLAN');
                      setIsModeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selectedMode === 'PLAN' ? 'bg-[#10f48e]/15 text-[#10f48e] font-semibold' : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Plan (Brief Kebutuhan)</span>
                    </div>
                    {selectedMode === 'PLAN' && <Check className="w-3.5 h-3.5 text-[#10f48e]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('SYNC_GAS');
                      setIsModeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selectedMode === 'SYNC_GAS' ? 'bg-[#10f48e]/15 text-[#10f48e] font-semibold' : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5" />
                      <span>Sync GAS (Apps Script)</span>
                    </div>
                    {selectedMode === 'SYNC_GAS' && <Check className="w-3.5 h-3.5 text-[#10f48e]" />}
                  </button>
                </div>
              )}
            </div>

            {/* Sisi Kanan: Mic & Send Button */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-1.5 rounded-lg transition-all ${
                  isListening 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
                title={isListening ? 'Mendengarkan... (Klik untuk stop)' : 'Input Suara (Mic)'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black font-extrabold shadow-md shadow-[#10f48e]/20 transition-all disabled:opacity-30 disabled:hover:from-emerald-400 disabled:hover:to-[#10f48e] shrink-0 flex items-center gap-1 active:scale-[0.98] cursor-pointer"
                aria-label="Kirim Pesan"
              >
                <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
