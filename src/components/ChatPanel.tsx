'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  ChevronRight,
  X,
  Settings,
  Search,
  Loader2,
  Cpu
} from 'lucide-react';
import { BriefKebutuhanCard, parseBriefKebutuhan } from './BriefKebutuhanCard';
import { DemoCredentialsCard, parseDemoCredentials } from './DemoCredentialsCard';
import { GuidedStepCard, type CustomRoleItem, type EditedRoleItem } from './GuidedStepCard';
import { MarkdownMessage } from './MarkdownMessage';
import { loadModelSettings, saveModelSettings, getModelLabel, getProviderConfig, getModelsForProvider, ROUTER_STATIC_MODELS, type ModelSettings, type AIModelOption } from '@/lib/modelConfig';
import { ModelSettingsMenu } from './ModelSettingsMenu';
import { extractAppTitleFromChat } from '@/lib/extractAppTitle';
import type { GuidedStepPayload, GuidedStepId, MockupSessionState } from '@/lib/templates/processes/types';
import { getAuthHeaders } from '@/lib/supabase/client';

export type ChatMode = 'BUILD' | 'PLAN' | 'SYNC_GAS';

interface ChatPanelProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
  externalSendToken?: string | number;
  externalSendText?: string | null;
  externalSendMode?: ChatMode;
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
  externalSendMode,
  onToggleSidebar,
  isSidebarCollapsed
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(projectState.chatMessages);
  const [input, setInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<ChatMode>(() => {
    if (projectState.canvasCode?.html) return 'BUILD';
    return 'PLAN';
  });
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [loadingText, setLoadingText] = useState('Sedang menganalisa ide Anda...');
  const [streamingText, setStreamingText] = useState<string | null>(null);
  
  const [modelConfig, setModelConfig] = useState<ModelSettings>(() => loadModelSettings());
  const [liveOpenRouterModels, setLiveOpenRouterModels] = useState<AIModelOption[] | null>(null);
  const [isLoadingLiveModels, setIsLoadingLiveModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [modelCategoryFilter, setModelCategoryFilter] = useState<'ALL' | 'GRATIS' | 'POPULER' | 'CODING' | 'REASONING'>('ALL');
  const [showCustomModelInput, setShowCustomModelInput] = useState(false);
  const [customModelId, setCustomModelId] = useState('');

  // Notifikasi popup model saat chat pertama kali
  const [modelNotification, setModelNotification] = useState<{ modelName: string } | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getNotificationModelName = (settings: ModelSettings): string => {
    if (!settings.token) {
      return 'Google Gemini (gemini-3.6-flash)';
    }
    const providerCfg = getProviderConfig(settings.provider);
    const label = getModelLabel(settings.model, settings.provider);
    if (label && label.toLowerCase() !== settings.model.toLowerCase()) {
      return `${providerCfg.label} (${label})`;
    }
    return `${providerCfg.label} (${settings.model})`;
  };

  const triggerModelNotification = () => {
    const currentSettings = loadModelSettings();
    const modelText = getNotificationModelName(currentSettings);
    setModelNotification({ modelName: modelText });

    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    notificationTimerRef.current = setTimeout(() => {
      setModelNotification(null);
    }, 6000);
  };

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  // Fetch katalog live OpenRouter (400+ model)
  useEffect(() => {
    if (modelConfig.provider === 'openrouter' && !liveOpenRouterModels && !isLoadingLiveModels) {
      setIsLoadingLiveModels(true);
      const headers: Record<string, string> = {};
      if (modelConfig.token) {
        headers.Authorization = `Bearer ${modelConfig.token}`;
      }
      fetch('/api/openrouter/models', { headers })
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.models) && data.models.length > 0) {
            setLiveOpenRouterModels(data.models);
          }
        })
        .catch(err => {
          console.warn('Gagal memuat katalog model OpenRouter:', err);
        })
        .finally(() => {
          setIsLoadingLiveModels(false);
        });
    }
  }, [modelConfig.provider, modelConfig.token, isModelDropdownOpen, liveOpenRouterModels, isLoadingLiveModels]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Sinkronisasi model config secara berkala & event listener lintas komponen
  useEffect(() => {
    const syncConfig = () => {
      setModelConfig(loadModelSettings());
    };
    syncConfig();
    window.addEventListener('ai_model_settings_changed', syncConfig);
    window.addEventListener('storage', syncConfig);
    return () => {
      window.removeEventListener('ai_model_settings_changed', syncConfig);
      window.removeEventListener('storage', syncConfig);
    };
  }, []);

  const handleSelectModel = (modelId: string) => {
    const updated: ModelSettings = {
      ...modelConfig,
      model: modelId
    };
    saveModelSettings(updated);
    setModelConfig(updated);
    setIsModelDropdownOpen(false);

    // Jika user memilih model OpenRouter atau OpenAI tapi key belum diisi, langsung buka modal setelan API
    if ((updated.provider === 'openrouter' || updated.provider === 'openai') && !updated.token) {
      setShowSettingsModal(true);
    }
  };

  // Auto scroll ke bawah
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, streamingText]);

  // Sinkronisasi pesan dari state proyek
  useEffect(() => {
    setMessages(projectState.chatMessages);
  }, [projectState.chatMessages]);

  // Sinkronisasi mode otomatis (system-managed):
  // - Mode PLAN: selama sesi wawancara terpandu (kanvas kosong dan belum disetujui di REVIEW_FINAL)
  // - Mode BUILD: jika sesi sudah disetujui di REVIEW_FINAL atau kanvas sudah memiliki prototipe kode
  useEffect(() => {
    const hasCode = Boolean(projectState.canvasCode?.html?.trim());
    const isApproved = Boolean(projectState.sessionState?.reviewFinalApproved);
    if (hasCode || isApproved) {
      setSelectedMode('BUILD');
    } else {
      setSelectedMode('PLAN');
    }
  }, [projectState.id, projectState.canvasCode?.html, projectState.sessionState?.reviewFinalApproved]);

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

  const guidedApiPayload = () => {
    const settings = loadModelSettings();
    const payload: Record<string, unknown> = { provider: settings.provider, model: settings.model };
    if (settings.token) payload.apiKey = settings.token;
    return payload;
  };

  const startGuidedSession = async (prompt: string) => {
    const isFirstUserChat = !messages.some((m) => m.sender === 'USER');
    if (isFirstUserChat) {
      triggerModelNotification();
    }
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: prompt,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsGenerating(true);
    setStreamingText(null);
    setLoadingText('Menyiapkan pertanyaan terpandu...');

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/guided', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'START', prompt, ...guidedApiPayload() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memulai sesi terpandu.');
      }

      const aiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: data.narration || 'Silakan pilih opsi berikut.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        guidedStep: data.guidedStep || undefined
      };
      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      const stateUpdate: Partial<AppProjectState> = {
        chatMessages: finalMessages,
        sessionState: data.session as MockupSessionState
      };
      const extractedTitle = extractAppTitleFromChat(finalMessages);
      if (extractedTitle && (!projectState.title || projectState.title === 'Proyek Baru' || projectState.title !== extractedTitle)) {
        stateUpdate.title = extractedTitle;
      }
      onUpdateState(stateUpdate);
    } catch (err: any) {
      const errorAiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: `⚠️ ${err.message || 'Gagal memulai sesi terpandu.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...updatedMessages, errorAiMsg];
      setMessages(finalMessages);
      onUpdateState({ chatMessages: finalMessages });
    } finally {
      setIsGenerating(false);
    }
  };

  const resumeGuidedStep = async (targetStep?: string) => {
    setIsGenerating(true);
    setLoadingText('Membuka tahapan perencanaan...');
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/guided', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'RESUME',
          session: projectState.sessionState,
          targetStep: targetStep || projectState.sessionState?.step || 'STORYTELLING',
          ...guidedApiPayload()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal melanjutkan tahapan terpandu.');
      }

      const aiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: data.narration || 'Silakan lanjutkan tahapan berikut:',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        guidedStep: data.guidedStep || undefined
      };
      const finalMessages = [...messages, aiMsg];
      setMessages(finalMessages);
      setSelectedMode('PLAN');
      onUpdateState({
        chatMessages: finalMessages,
        sessionState: data.session as MockupSessionState
      });
    } catch (err: any) {
      console.error('Error resuming guided step:', err);
      const errorAiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: `⚠️ ${err.message || 'Gagal melanjutkan tahapan terpandu.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...messages, errorAiMsg];
      setMessages(finalMessages);
      onUpdateState({ chatMessages: finalMessages });
    } finally {
      setIsGenerating(false);
    }
  };

  const summarizeGuidedAnswer = (
    payload: GuidedStepPayload | undefined,
    selected: string[],
    other?: string,
    customRoles?: CustomRoleItem[]
  ): string => {
    if (!payload) return [selected.join(', '), other].filter(Boolean).join(' + ') || 'Lanjut';
    const labels = payload.options.filter((o) => selected.includes(o.id)).map((o) => o.label);
    if (customRoles && customRoles.length > 0) {
      for (const cr of customRoles) {
        if (selected.includes(cr.id) && !labels.includes(cr.label)) {
          labels.push(cr.label);
        }
      }
    }
    return [labels.join(', '), other].filter(Boolean).join(' + ') || 'Lanjut';
  };

  const handleGuidedAnswer = async (
    messageId: string,
    stepId: GuidedStepId,
    selected: string[],
    other?: string,
    customRoles?: CustomRoleItem[],
    editedRoles?: Record<string, EditedRoleItem>
  ) => {
    const session = projectState.sessionState;
    if (!session || isGenerating) return;

    const stepPayload = messages.find((m) => m.id === messageId)?.guidedStep;
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: summarizeGuidedAnswer(stepPayload, selected, other, customRoles),
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsGenerating(true);
    setLoadingText('Memproses pilihan Anda...');

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/guided', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'NEXT',
          session,
          stepId,
          selected,
          other,
          customRoles,
          editedRoles,
          ...guidedApiPayload()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal memproses pilihan.');
      }

      let nextSession = data.session as MockupSessionState;
      const aiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: data.narration || 'Lanjut ke langkah berikutnya.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        guidedStep: data.guidedStep || undefined
      };
      let finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);

      // Tangani tombol "Setujui & Buat Prototipe" dari kartu REVIEW_FINAL
      if (data.action === 'APPROVE' || (stepId === 'REVIEW_FINAL' && selected.includes('approve_prototype'))) {
        const briefText = data.brief || nextSession.compiledBrief || '';
        nextSession.reviewFinalApproved = true;
        nextSession.statusKonfirmasi = 'disetujui';
        if (!nextSession.review) {
          nextSession.review = { statusKonfirmasi: 'disetujui' };
        } else {
          nextSession.review.statusKonfirmasi = 'disetujui';
        }
        onUpdateState({ chatMessages: finalMessages, sessionState: nextSession });
        setSelectedMode('BUILD');
        setTimeout(() => {
          handleSendMessage(
            '✅ Saya menyetujui Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang.',
            'BUILD',
            nextSession
          );
        }, 100);
        return;
      }

      onUpdateState({ chatMessages: finalMessages, sessionState: nextSession });
    } catch (err: any) {
      const errorAiMsg: ChatMessage = {
        id: 'msg-' + (Date.now() + 1),
        sender: 'AI',
        text: `⚠️ ${err.message || 'Gagal memproses pilihan.'}`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...updatedMessages, errorAiMsg];
      setMessages(finalMessages);
      onUpdateState({ chatMessages: finalMessages });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (
    textToSend?: string,
    modeOverride?: ChatMode,
    sessionOverride?: MockupSessionState
  ) => {
    const query = textToSend || input;
    if (!query.trim() || isGenerating) return;

    const effectiveSession = sessionOverride || projectState.sessionState || null;
    const isCanvasEmpty = !projectState.canvasCode?.html;
    const isApprovedOrBuild = modeOverride === 'BUILD' || Boolean(effectiveSession?.reviewFinalApproved);
    // Jika kanvas kosong dan belum disetujui di REVIEW_FINAL, mode efektif dipaksa selalu PLAN
    const activeMode = (isCanvasEmpty && !isApprovedOrBuild) ? 'PLAN' : (modeOverride || selectedMode);

    // Deteksi eksplisit permintaan pembuatan ide aplikasi baru
    const isExplicitNewAppIdea =
      /(?:buatkan|bikin|buat|buatkan\s+saya|kembangkan|rancang)\s+(?:aplikasi|sistem|app|web\s+app)\b/i.test(query.trim()) ||
      /(?:aplikasi|sistem)\s+(?:cuci\s+mobil|laundry|posyandu|kasir|klinik|rental|bengkel|toko|keuangan|booking|antrean|sekolah|koperasi|restoran|cafe)/i.test(query.trim());

    // SKENARIO NYATA: Habis testing proyek lama (canvas masih ada kode),
    // tanpa refresh browser langsung mengetik ide aplikasi baru ("buatkan aplikasi cuci mobil")
    if (!isCanvasEmpty && isExplicitNewAppIdea) {
      onUpdateState({
        title: 'Proyek Aplikasi Baru',
        canvasCode: { html: '', css: '', js: '' },
        sessionState: null,
        annotations: { marks: [], notes: [], patches: [] }
      });
      setSelectedMode('PLAN');
      await startGuidedSession(query);
      return;
    }

    // Sesi terpandu (Multiple-Choice Flow): mulai otomatis pada pesan ide pertama saat kanvas kosong
    const isQuestionOrGreeting =
      /^(apa|apakah|bagaimana|kenapa|mengapa|bisa|boleh|hallo|halo|hai|selamat|pagi|siang|sore|malam)\b/i.test(query.trim()) ||
      query.trim().endsWith('?');
    const looksLikeIdea = (query.trim().length > 8 && !isQuestionOrGreeting) || isExplicitNewAppIdea;

    if (
      isCanvasEmpty &&
      !isApprovedOrBuild &&
      (!effectiveSession || !effectiveSession.step || looksLikeIdea)
    ) {
      // Jika belum ada sessionState, mulai sesi terpandu baru
      if (!effectiveSession || !effectiveSession.step) {
        await startGuidedSession(query);
        return;
      }
    }

    // Jika sesi terpandu sedang aktif di PLAN mode, teruskan input teks sebagai jawaban/koreksi langkah aktif (termasuk REVIEW_FINAL)
    if (
      activeMode === 'PLAN' &&
      isCanvasEmpty &&
      effectiveSession &&
      effectiveSession.step
    ) {
      const currentStep = effectiveSession.step;
      const lastGuidedMsg = [...messages].reverse().find((m) => m.guidedStep);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      await handleGuidedAnswer(lastGuidedMsg?.id || 'msg-current', currentStep, [], query.trim());
      return;
    }

    const hasBrief = messages.some(m => m.text.includes('Brief Kebutuhan') || m.text.includes('Nama App:'));
    const contextualText = getContextualLoadingText(
      query, 
      Boolean(projectState.canvasCode?.html), 
      hasBrief,
      activeMode
    );
    setLoadingText(contextualText);

    const isFirstUserChat = !messages.some((m) => m.sender === 'USER');
    if (isFirstUserChat) {
      triggerModelNotification();
    }

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
      // Menentukan stage percakapan berdasarkan activeMode & status saat ini
      let currentStage = 'TAHAP_1_PEMBUKAAN';
      if (activeMode === 'PLAN') {
        currentStage = 'TAHAP_1_PEMBUKAAN';
      } else if (activeMode === 'SYNC_GAS') {
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

      // Tanpa API key pribadi, pakai Server Default (Gemini gratis di server)
      // agar generation tetap berjalan.
      const useServerDefault = !activeSettings.token;

      const payload: Record<string, unknown> = {
        prompt: query,
        chatHistory: updatedMessages,
        stage: currentStage,
        currentCode: projectState.canvasCode.html,
        mode: activeMode,
        // POIN C: Kirim sessionState terstruktur dari guided interview supaya
        // backend bisa membaca roles & compiledBrief langsung — tidak perlu parse regex chat history
        sessionState: effectiveSession || null
      };
      if (!useServerDefault) {
        payload.userProvider = activeSettings.provider;
        payload.userModel = activeSettings.model;
        payload.userApiKey = activeSettings.token;
      }

      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errorMsg = 'Terjadi kesalahan pada server saat memproses permintaan.';
        let suggestedOptions: string[] | undefined = undefined;
        let metadata: Record<string, unknown> | undefined = undefined;

        if (res.status === 504) {
          errorMsg = '⏱️ Batas waktu server tercapai (Timeout 504). Silakan coba kembali atau sederhanakan instruksi.';
        } else if (res.status === 429) {
          errorMsg = '⏳ Batas kuota tercapai. Mohon tunggu beberapa detik sebelum mencoba kembali.';
        } else {
          try {
            const errData = await res.json();
            if (errData.error) errorMsg = `⚠️ ${errData.error}`;
            if (errData.needsGuidedInterview) {
              const activeStep = errData.currentStep || projectState.sessionState?.step || 'STORYTELLING';
              const stepName = errData.stepName || activeStep;
              suggestedOptions = [
                `▶️ Lanjutkan dari Tahap ${stepName}`,
                `🔄 Mulai dari Awal (Cerita Bisnis)`
              ];
              metadata = {
                resumeStep: activeStep,
                restartGuided: true
              };
            }
          } catch (_) {}
        }

        const errorAiMsg: ChatMessage = {
          id: 'msg-' + (Date.now() + 1),
          sender: 'AI',
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          suggestedOptions,
          metadata
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
              // Server mengirim { type: 'chunk', text } atau { type: 'token', content }
              if (parsed.type === 'chunk' && parsed.text) {
                accumulated += parsed.text;
                setStreamingText(accumulated);
              } else if (parsed.type === 'token' && parsed.content) {
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
        if (extractedTitle && (!projectState.title || projectState.title === 'Proyek Baru' || projectState.title !== extractedTitle)) {
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
      if (extractedTitle && (!projectState.title || projectState.title === 'Proyek Baru' || projectState.title !== extractedTitle)) {
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

      // POIN D: Jika backend mengembalikan flag suggestSimplify, tambahkan tombol aksi otomatis
      // ke pesan AI — user tidak perlu mengetik ulang prompt dari nol
      if (data.suggestSimplify || data.suggestedRetryPrompt) {
        const autoOptions: string[] = [];
        if (data.suggestedRetryPrompt) autoOptions.push(`🔄 Coba Generate Ulang`);
        if (data.suggestSimplify && data.suggestedSimplifyPrompt) autoOptions.push(`📦 Generate Versi Sederhana`);

        if (autoOptions.length > 0) {
          // Update pesan AI terakhir dengan suggestedOptions agar tombol dirender
          const updatedAiMsg: ChatMessage = {
            ...aiMsg,
            suggestedOptions: autoOptions,
            // Simpan prompt asli di metadata agar handleSendMessage bisa meneruskan prompt yang tepat
            metadata: {
              retryPrompt: data.suggestedRetryPrompt || 'buatkan prototipe sekarang',
              simplifyPrompt: data.suggestedSimplifyPrompt || ''
            }
          };
          const msgWithOptions = [...updatedMessages, updatedAiMsg];
          setMessages(msgWithOptions);
          onUpdateState({ ...stateUpdate, chatMessages: msgWithOptions });
          return;
        }
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

  // External trigger dari luar (misal dari popover mark / halaman Brief)
  useEffect(() => {
    if (externalSendToken && externalSendText) {
      handleSendMessage(externalSendText, externalSendMode);
    }
  }, [externalSendToken]);

  const activeProvider = modelConfig.token ? getProviderConfig(modelConfig.provider).label : 'Server Default';
  const activeModelName = modelConfig.token ? getModelLabel(modelConfig.model, modelConfig.provider) : 'Gemini 3.6 Flash';

  const allProviderModels: AIModelOption[] = useMemo(() => {
    if (modelConfig.provider === 'openrouter') {
      if (liveOpenRouterModels && liveOpenRouterModels.length > 0) {
        return liveOpenRouterModels;
      }
      return ROUTER_STATIC_MODELS;
    }
    return getModelsForProvider(modelConfig.provider);
  }, [modelConfig.provider, liveOpenRouterModels]);

  const filteredModels: AIModelOption[] = useMemo(() => {
    let list = allProviderModels;

    // Filter Kategori Tab
    if (modelCategoryFilter === 'GRATIS') {
      list = list.filter(m => m.category === 'GRATIS' || m.id.endsWith(':free') || m.pricePerMInput === 'Gratis' || m.id === 'openrouter/free');
    } else if (modelCategoryFilter === 'POPULER') {
      const popularIds = new Set(ROUTER_STATIC_MODELS.map(m => m.id));
      list = list.filter(m => popularIds.has(m.id));
    } else if (modelCategoryFilter === 'CODING') {
      list = list.filter(m => 
        m.id.toLowerCase().includes('coder') || 
        m.id.toLowerCase().includes('claude') || 
        m.id.toLowerCase().includes('gpt-4') || 
        m.id.toLowerCase().includes('deepseek') ||
        m.label.toLowerCase().includes('code')
      );
    } else if (modelCategoryFilter === 'REASONING') {
      list = list.filter(m => 
        m.id.toLowerCase().includes('r1') || 
        m.id.toLowerCase().includes('o1') || 
        m.id.toLowerCase().includes('o3') || 
        m.id.toLowerCase().includes('reasoning') ||
        m.label.toLowerCase().includes('penalaran')
      );
    }

    // Filter Pencarian Teks
    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase().trim();
      list = list.filter(m => 
        m.label.toLowerCase().includes(q) || 
        m.id.toLowerCase().includes(q) || 
        m.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allProviderModels, modelCategoryFilter, modelSearch]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#08080c] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative select-none">
      
      {/* Popup Notifikasi Model AI saat Awal Pemrosesan (Chat Pertama Kali) */}
      {modelNotification && (
        <div className="absolute top-[62px] inset-x-3 z-40 animate-fadeIn pointer-events-auto">
          <div className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#0c1410]/95 border border-[#10f48e]/40 text-white shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#10f48e]/20 border border-[#10f48e]/40 flex items-center justify-center shrink-0">
                <Cpu className="w-3.5 h-3.5 text-[#10f48e] animate-pulse" />
              </div>
              <p className="text-xs truncate">
                <span className="text-zinc-300">Pemrosesan menggunakan model </span>
                <span className="font-semibold text-[#10f48e]">{modelNotification.modelName}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModelNotification(null)}
              className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
              title="Tutup Notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header Panel Chat: Nama Proyek + Dropdown Pemilihan Model AI */}
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

        {/* AI Model Selector Dropdown Interaktif */}
        <div className="relative" ref={modelDropdownRef}>
          <button
            type="button"
            onClick={() => setIsModelDropdownOpen(prev => !prev)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#10f48e]/40 text-[11px] font-medium text-zinc-200 transition-all cursor-pointer group shadow-sm"
            title="Klik untuk memilih model AI atau setel API Key"
          >
            <span className={`w-2 h-2 rounded-full ${modelConfig.token ? 'bg-[#10f48e] shadow-[0_0_8px_#10f48e]' : 'bg-emerald-400'} animate-pulse shrink-0`} />
            <div className="flex items-center gap-1.5 text-left min-w-0">
              <span className="truncate max-w-[110px] sm:max-w-[170px] font-semibold text-white">
                {activeModelName}
              </span>
              <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-400 uppercase font-mono tracking-wide">
                {modelConfig.token ? modelConfig.provider : 'Default'}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform duration-200 shrink-0 ${isModelDropdownOpen ? 'rotate-180 text-[#10f48e]' : ''}`} />
          </button>

          {/* Dropdown Menu Model Selector */}
          {isModelDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-[420px] rounded-2xl bg-[#121218]/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-3 z-50 animate-fadeIn text-left">
              {/* Header Info Dropdown */}
              <div className="pb-2.5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Pilih Model AI</p>
                    {isLoadingLiveModels && (
                      <span className="flex items-center gap-1 text-[9px] text-[#10f48e] font-mono">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Memuat 400+ model...
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white mt-0.5">
                    Provider: <span className="text-[#10f48e] capitalize">{modelConfig.token ? modelConfig.provider : 'Server Default'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${modelConfig.token ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'}`}>
                    {modelConfig.token ? 'API Terpasang' : 'Server Default'}
                  </span>
                  <p className="text-[9px] text-zinc-400 mt-0.5 font-mono">
                    {allProviderModels.length} model
                  </p>
                </div>
              </div>

              {/* Input Pencarian Model */}
              <div className="pt-2 pb-1.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder={
                      modelConfig.provider === 'openrouter'
                        ? 'Cari 400+ model (claude, r1, gpt-4o, free, qwen)...'
                        : 'Cari nama atau tipe model...'
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#10f48e]/60 transition-colors"
                  />
                  {modelSearch && (
                    <button
                      type="button"
                      onClick={() => setModelSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Tabs (Kategori) untuk OpenRouter */}
              {modelConfig.provider === 'openrouter' && (
                <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none text-[10px]">
                  <button
                    type="button"
                    onClick={() => setModelCategoryFilter('ALL')}
                    className={`px-2 py-0.5 rounded-lg font-medium transition-colors shrink-0 ${
                      modelCategoryFilter === 'ALL'
                        ? 'bg-white/15 text-white border border-white/20'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelCategoryFilter('GRATIS')}
                    className={`px-2 py-0.5 rounded-lg font-medium transition-colors shrink-0 ${
                      modelCategoryFilter === 'GRATIS'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                        : 'text-zinc-400 hover:text-emerald-300 hover:bg-white/5'
                    }`}
                  >
                    🆓 Gratis
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelCategoryFilter('POPULER')}
                    className={`px-2 py-0.5 rounded-lg font-medium transition-colors shrink-0 ${
                      modelCategoryFilter === 'POPULER'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                        : 'text-zinc-400 hover:text-amber-300 hover:bg-white/5'
                    }`}
                  >
                    🔥 Populer
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelCategoryFilter('CODING')}
                    className={`px-2 py-0.5 rounded-lg font-medium transition-colors shrink-0 ${
                      modelCategoryFilter === 'CODING'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold'
                        : 'text-zinc-400 hover:text-indigo-300 hover:bg-white/5'
                    }`}
                  >
                    💻 Coding
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelCategoryFilter('REASONING')}
                    className={`px-2 py-0.5 rounded-lg font-medium transition-colors shrink-0 ${
                      modelCategoryFilter === 'REASONING'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold'
                        : 'text-zinc-400 hover:text-purple-300 hover:bg-white/5'
                    }`}
                  >
                    🧠 Reasoning
                  </button>
                </div>
              )}

              {/* Daftar Pilihan Model */}
              <div className="py-1 max-h-64 sm:max-h-72 overflow-y-auto space-y-1 scrollbar-thin">
                {filteredModels.length === 0 ? (
                  <div className="py-6 px-3 text-center">
                    <p className="text-xs text-zinc-400">Tidak ada model yang cocok dengan kata kunci.</p>
                    {modelSearch && (
                      <button
                        type="button"
                        onClick={() => handleSelectModel(modelSearch.trim())}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10f48e]/15 border border-[#10f48e]/30 text-xs font-bold text-[#10f48e] hover:bg-[#10f48e]/25 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Gunakan "{modelSearch.trim()}"
                      </button>
                    )}
                  </div>
                ) : (
                  filteredModels.slice(0, 120).map((m) => {
                    const isSelected = modelConfig.model === m.id || (m.id === 'openrouter/free' && !modelConfig.model);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectModel(m.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all text-xs cursor-pointer group ${
                          isSelected
                            ? 'bg-[#10f48e]/15 border border-[#10f48e]/30 text-white font-medium'
                            : 'hover:bg-white/5 text-zinc-300 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-white">{m.label}</span>
                            {m.category === 'GRATIS' && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                                FREE
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono truncate mt-0.5 opacity-70 group-hover:opacity-100">
                            {m.id}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                            <span>{m.context} konteks</span>
                            <span>•</span>
                            <span className="text-zinc-500">{m.category}</span>
                            {m.pricePerMInput && (
                              <>
                                <span>•</span>
                                <span className={m.pricePerMInput === 'Gratis' ? 'text-emerald-400 font-semibold' : 'text-zinc-400'}>
                                  {m.pricePerMInput}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#10f48e] shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
                {filteredModels.length > 120 && (
                  <p className="text-[10px] text-zinc-500 text-center py-1 font-mono">
                    Menampilkan 120 dari {filteredModels.length} hasil. Gunakan kolom pencarian untuk mempersempit.
                  </p>
                )}
              </div>

              {/* Opsi Ketik Model ID Custom */}
              <div className="pt-2 mt-1 border-t border-white/10 px-1">
                {showCustomModelInput ? (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-zinc-400 font-medium">Ketik ID model dari katalog OpenRouter:</p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customModelId}
                        onChange={(e) => setCustomModelId(e.target.value)}
                        placeholder="misal: mistralai/mistral-large-2411"
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white placeholder:text-zinc-600 font-mono focus:outline-none focus:border-[#10f48e]/60"
                      />
                      <button
                        type="button"
                        disabled={!customModelId.trim()}
                        onClick={() => {
                          if (customModelId.trim()) {
                            handleSelectModel(customModelId.trim());
                            setCustomModelId('');
                            setShowCustomModelInput(false);
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-[#10f48e] text-black font-bold text-xs hover:bg-emerald-400 disabled:opacity-40 cursor-pointer"
                      >
                        Pilih
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCustomModelInput(false)}
                        className="p-1 text-zinc-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[10px]">
                    <button
                      type="button"
                      onClick={() => setShowCustomModelInput(true)}
                      className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer inline-flex items-center gap-1 py-0.5"
                    >
                      <Plus className="w-3 h-3 text-[#10f48e]" />
                      <span>Ketik ID Model Lainnya</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModelDropdownOpen(false);
                        setShowSettingsModal(true);
                      }}
                      className="text-[11px] font-semibold text-[#10f48e] hover:underline inline-flex items-center gap-1 cursor-pointer py-0.5"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Setel API Key</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
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
                    ? 'bg-gradient-to-tr from-zinc-600 to-zinc-500 text-white shadow-md shadow-black/20'
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
                          `Saya menyetujui skenario dan Brief Kebutuhan ini. Silakan buatkan prototipe aplikasinya sekarang!`,
                          'BUILD'
                        );
                      } else {
                        setSelectedMode('PLAN');
                        handleSendMessage(
                          `Saya telah menyesuaikan rincian brief kebutuhan dan pembagian peran. Mohon sesuaikan skenario alur kerja dan lembar brief aplikasi ini, lalu konfirmasikan kembali:\n\n${compiledMarkdown}`,
                          'PLAN'
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
                        ? 'bg-gradient-to-r from-zinc-700 to-zinc-600 text-zinc-100 shadow-lg rounded-tr-none font-semibold ml-auto'
                        : 'bg-[#101015] border border-white/10 text-zinc-200 shadow-inner rounded-tl-none'
                    }`}
                  >
                    <MarkdownMessage content={textToDisplay} isUser={m.sender === 'USER'} />

                  {/* Quick Action Pills — untuk pesan pertama (welcome), pesan kegagalan generate (POIN D), atau pemulihan guided interview */}
                  {m.suggestedOptions && m.suggestedOptions.length > 0 && Boolean(messages.length <= 1 || m.metadata?.retryPrompt || m.metadata?.resumeStep || m.metadata?.restartGuided) && (
                    <div className="pt-3 border-t border-white/10 flex flex-wrap gap-1.5">
                      {m.suggestedOptions.map((opt, i) => {
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (m.metadata?.resumeStep && opt.startsWith('▶️')) {
                                resumeGuidedStep(m.metadata.resumeStep as string);
                                return;
                              }
                              if (m.metadata?.restartGuided && opt.startsWith('🔄 Mulai')) {
                                const ideaTitle = projectState.title && projectState.title !== 'Proyek Baru' ? `buatkan aplikasi ${projectState.title}` : 'buatkan aplikasi baru';
                                startGuidedSession(ideaTitle);
                                return;
                              }

                              // POIN D: Jika ada metadata, resolve prompt aktual dari metadata
                              let actualPrompt = opt;
                              if (m.metadata) {
                                if (opt.startsWith('🔄') && m.metadata.retryPrompt) {
                                  actualPrompt = m.metadata.retryPrompt as string;
                                } else if (opt.startsWith('📦') && m.metadata.simplifyPrompt) {
                                  actualPrompt = m.metadata.simplifyPrompt as string;
                                }
                              }
                              handleSendMessage(actualPrompt);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-[#10f48e]/15 border border-white/10 hover:border-[#10f48e]/35 text-[11px] font-medium text-zinc-300 hover:text-[#10f48e] transition-all text-left active:scale-[0.98]"
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <span className={`text-[10px] block text-right pt-1 opacity-60`}>
                    {m.timestamp}
                  </span>
                </div>

                {/* Kartu pilihan sesi terpandu (Multiple-Choice Flow) */}
                {m.sender === 'AI' && m.guidedStep && (
                  <GuidedStepCard
                    key={`${m.id}-guided`}
                    payload={m.guidedStep}
                    disabled={isGenerating}
                    preselectRecommended
                    session={projectState.sessionState}
                    apiExtraPayload={guidedApiPayload()}
                    onSubmit={(selected, other, customRoles, editedRoles) =>
                      handleGuidedAnswer(m.id, m.guidedStep!.stepId, selected, other, customRoles, editedRoles)
                    }
                  />
                )}

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
          {/* Indikator Panduan Alur: Jika Brief sudah siap & masih di mode Plan */}
          {messages.some(m => m.text.includes('Brief Kebutuhan') || m.text.includes('Nama App:')) && selectedMode === 'PLAN' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 animate-in fade-in duration-200">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span className="truncate">Tinjau lembar brief di atas, lalu klik <b>Setujui &amp; Buat Prototipe</b> untuk mulai membuat aplikasi.</span>
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
                      ? 'Ketik masukan atau penyesuaian untuk brief kebutuhan...'
                      : 'Diskusikan ide & fitur yang ingin Anda rencanakan...')
                  : 'Ketik instruksi untuk merevisi atau menambahkan fitur pada prototype...'
              }
              className="flex-1 bg-transparent px-1 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50 resize-none max-h-36 min-h-[32px] overflow-y-auto leading-relaxed scrollbar-thin"
            />
          </div>

          {/* Baris Bawah Kapsul: Status Badge Read-Only, Mic, & Send Button */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5">
            {/* Status Badge Read-Only: Mode Sistem (Perencanaan vs Pembuatan & Revisi) */}
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold select-none cursor-default transition-all ${
                selectedMode === 'PLAN'
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                  : 'bg-[#10f48e]/10 border-[#10f48e]/25 text-[#10f48e]'
              }`}
              title={
                selectedMode === 'PLAN'
                  ? 'Mode Perencanaan (Otomatis): AI memandu alur wawancara untuk menyusun brief kebutuhan aplikasi.'
                  : 'Mode Pembuatan & Revisi (Otomatis): AI membuat dan merevisi prototipe aplikasi berdasarkan brief.'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  selectedMode === 'PLAN'
                    ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                    : 'bg-[#10f48e] shadow-[0_0_6px_#10f48e]'
                }`}
              />
              <span>
                {selectedMode === 'PLAN' ? '📝 Perencanaan' : '🛠️ Pembuatan & Revisi'}
              </span>
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

      {/* Modal Pengaturan Model AI & API Key */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-sm sm:max-w-md bg-[#121218] border border-white/15 rounded-2xl shadow-2xl p-5 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#10f48e]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Setelan API Key & Model AI</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ModelSettingsMenu
              provider={modelConfig.provider}
              token={modelConfig.token}
              model={modelConfig.model}
              onSave={(newSettings) => {
                setModelConfig(newSettings);
                setShowSettingsModal(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
