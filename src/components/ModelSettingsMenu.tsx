'use client';

import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ExternalLink, Check } from 'lucide-react';
import {
  PROVIDERS,
  DEFAULT_MODELS,
  getProviderConfig,
  getModelsForProvider,
  saveModelSettings,
} from '@/lib/modelConfig';
import type { AIProvider, ModelSettings } from '@/lib/modelConfig';

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
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeProvider = getProviderConfig(providerId);
  const hasKey = Boolean(key.trim());

  const handleProviderChange = (newProvider: AIProvider) => {
    setProviderId(newProvider);
    setKey('');
  };

  const handleSave = () => {
    const trimmed = key.trim();
    // Gunakan model yang sudah ada jika cocok dengan provider baru, atau gunakan default provider tersebut
    const existingModels = getModelsForProvider(providerId);
    const isModelMatching = existingModels.some(m => m.id === model);
    const effectiveModel = trimmed ? (isModelMatching ? model : DEFAULT_MODELS[providerId]) : DEFAULT_MODELS.gemini;

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
            onChange={(e) => setKey(e.target.value)}
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

      {/* Info Status Key & Petunjuk Dropdown Atas */}
      <div className="px-2 py-2 border-t border-slate-800/80">
        {hasKey ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-left">
            <p className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              API Key {activeProvider.label} Aktif
            </p>
            <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
              Pemilihan model spesifik (GPT-4o, Claude, DeepSeek, dll) langsung tersedia dari <strong>dropdown di bagian atas chat</strong>.
            </p>
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-left">
            <p className="text-[10px] leading-relaxed text-slate-300">
              <span className="text-indigo-300 font-semibold">Belum ada key</span> → sistem otomatis menggunakan <span className="font-semibold text-emerald-400">Server Default (Gemini)</span> gratis.
            </p>
          </div>
        )}
      </div>

      <div className="px-2 py-1.5">
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
        >
          {saved ? (
            <>
              <Check className="w-3.5 h-3.5" /> API Key Tersimpan!
            </>
          ) : (
            'Simpan API Key'
          )}
        </button>
      </div>
    </div>
  );
};