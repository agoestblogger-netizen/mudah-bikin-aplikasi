'use client';

import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ExternalLink, Check, Loader2, AlertCircle } from 'lucide-react';
import {
  PROVIDERS,
  DEFAULT_MODELS,
  getProviderConfig,
  getModelsForProvider,
  getModelLabel,
  saveModelSettings,
} from '@/lib/modelConfig';
import type { AIProvider, ModelSettings, AIModelOption } from '@/lib/modelConfig';

interface ModelSettingsMenuProps {
  provider: AIProvider;
  token: string;
  model: string;
  onSave: (settings: ModelSettings) => void;
}

export const ModelSettingsMenu: React.FC<ModelSettingsMenuProps> = ({
  provider,
  token,
  model,
  onSave,
}) => {
  const [providerId, setProviderId] = useState<AIProvider>(provider);
  const [key, setKey] = useState(token);
  const [selectedModel, setSelectedModel] = useState(token ? model : '');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liveModels, setLiveModels] = useState<AIModelOption[] | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState('');

  const activeProvider = getProviderConfig(providerId);
  const hasKey = Boolean(key.trim());

  const handleProviderChange = (newProvider: AIProvider) => {
    setProviderId(newProvider);
    setKey('');
    setSelectedModel('');
    setLiveModels(null);
    setModelError('');
  };

  const fetchLiveOpenRouterModels = async () => {
    if (providerId !== 'openrouter' || !hasKey) return;
    setLoadingModels(true);
    setModelError('');
    setLiveModels(null);
    try {
      const res = await fetch('/api/openrouter/models', {
        headers: { Authorization: `Bearer ${key.trim()}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setModelError(data?.error || 'Gagal memuat daftar model OpenRouter.');
        setLoadingModels(false);
        return;
      }
      const data = (await res.json()) as { models: AIModelOption[] };
      const models = Array.isArray(data.models) ? data.models : [];
      if (models.length === 0) {
        setModelError('Tidak ada model terbuka pada layer gratis. Masukkan setelan lain atau gunakan Server Default.');
        setLoadingModels(false);
        return;
      }
      setLiveModels(models);
      if (!models.some((m) => m.id === selectedModel)) {
        setSelectedModel(models[0].id);
      }
    } catch {
      setModelError('Gagal terhubung ke OpenRouter. Periksa koneksi internet Anda.');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = () => {
    const trimmed = key.trim();
    const effectiveModel = hasKey ? selectedModel || DEFAULT_MODELS[providerId] : '';
    const settings: ModelSettings = {
      provider: providerId,
      token: trimmed,
      model: effectiveModel,
    };
    saveModelSettings(settings);
    onSave(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const models = providerId === 'openrouter' && liveModels ? liveModels : getModelsForProvider(providerId);

  return (
    <div className="px-2 py-1">
      {/* Provider Selector */}
      <div className="px-2 py-1.5">
        <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Provider AI</p>
        <select
          value={providerId}
          onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
          className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* API Key Input */}
      <div className="px-2 py-1.5 border-t border-slate-800/80">
        <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">API Key {activeProvider.label}</p>

        <div className="relative mt-1.5">
          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              if (!e.target.value.trim()) {
                setLiveModels(null);
                setModelError('');
              }
            }}
            placeholder={activeProvider.keyPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowKey((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label={showKey ? 'Sembunyikan key' : 'Tampilkan key'}
          >
            {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
          {hasKey ? (
            <>
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Key terpasang
              </span>
              {' '}· tersimpan aman di browser, hanya dipakai untuk permintaan Anda.
            </>
          ) : (
            <>
              Belum punya?{' '}
              <a
                href={activeProvider.signupUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
              >
                Dapatkan key {activeProvider.label} <ExternalLink className="w-3 h-3" />
              </a>
            </>
          )}
        </p>
      </div>

      {/* Model Section (Opsi 2: tersembunyi tanpa key) */}
      {hasKey ? (
        <div className="px-2 py-1.5 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">Pilih Model</p>
            {providerId === 'openrouter' && (
              <button
                type="button"
                onClick={fetchLiveOpenRouterModels}
                disabled={loadingModels}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
              >
                {loadingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Muat daftar model'}
              </button>
            )}
          </div>

          {loadingModels ? (
            <p className="mt-1.5 text-[10px] text-slate-500 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Memuat model dari OpenRouter...
            </p>
          ) : modelError ? (
            <p className="mt-1.5 text-[10px] text-rose-400 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {modelError}
            </p>
          ) : (
            <>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="mt-1.5 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
                Model aktif: <span className="text-indigo-300 font-medium">{getModelLabel(selectedModel, providerId)}</span>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="px-2 py-1.5 border-t border-slate-800/80">
          <p className="text-[10px] leading-relaxed bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300">
            <span className="text-indigo-300 font-semibold">Belum ada key</span> → aktif <span className="font-semibold text-emerald-400">Server Default (Gemini)</span> secara gratis.
          </p>
        </div>
      )}

      <div className="px-2 py-1.5">
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all"
        >
          {saved ? (
            <>
              <Check className="w-3.5 h-3.5" /> Tersimpan!
            </>
          ) : (
            'Simpan Pengaturan'
          )}
        </button>
      </div>
    </div>
  );
};