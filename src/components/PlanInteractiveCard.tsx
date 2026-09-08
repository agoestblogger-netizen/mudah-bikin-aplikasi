'use client';

import React, { useState } from 'react';
import { Sparkles, Check, Send, Zap, UserCheck, Layers } from 'lucide-react';

export interface PlanOptionsData {
  title?: string;
  roles: string[];
  features: string[];
}

interface PlanInteractiveCardProps {
  data: PlanOptionsData;
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const PlanInteractiveCard: React.FC<PlanInteractiveCardProps> = ({
  data,
  onSend,
  disabled = false,
}) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleFeature = (feat: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feat) ? prev.filter((f) => f !== feat) : [...prev, feat]
    );
  };

  const totalSelected = selectedRoles.length + selectedFeatures.length;

  const handleSendGuided = () => {
    if (totalSelected === 0) return;
    const parts: string[] = [];
    if (selectedRoles.length > 0) {
      parts.push(`Peran yang saya pilih: ${selectedRoles.join(', ')}`);
    }
    if (selectedFeatures.length > 0) {
      parts.push(`Fitur yang saya butuhkan: ${selectedFeatures.join(', ')}`);
    }
    const msg = `${parts.join('. ')}. Tolong susunkan Product Requirements Document (PRD) lengkap untuk aplikasi ini.`;
    onSend(msg);
  };

  const handleSendExpress = () => {
    onSend(
      'Saya setuju dengan rekomendasi peran dan fitur standar di atas. Tolong langsung susunkan Product Requirements Document (PRD) teknis lengkap untuk aplikasi ini.'
    );
  };

  return (
    <div className="w-full max-w-xl rounded-2xl bg-[#0f0f16] border border-[#10f48e]/30 p-4 sm:p-5 shadow-2xl space-y-4 my-2 text-zinc-200 animate-in fade-in zoom-in-95 duration-200">
      {/* Header Kartu */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[#10f48e]/15 border border-[#10f48e]/30 flex items-center justify-center text-[#10f48e]">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-wide">
              {data.title || 'PILIH PERAN & FITUR KUNCI'}
            </h4>
            <p className="text-[11px] text-zinc-400">
              Pilih satu atau lebih opsi di bawah, atau langsung buatkan PRD
            </p>
          </div>
        </div>
        {totalSelected > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-[#10f48e]/15 border border-[#10f48e]/40 text-[#10f48e] text-[10px] font-extrabold">
            {totalSelected} Dipilih
          </span>
        )}
      </div>

      {/* Kategori 1: Peran Pengguna (User Roles) */}
      {data.roles && data.roles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
            <UserCheck className="w-3.5 h-3.5 text-[#10f48e]" />
            <span>Peran Pengguna (Roles):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.roles.map((role, idx) => {
              const isSelected = selectedRoles.includes(role);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-[#10f48e] text-black border border-[#10f48e] shadow-md shadow-[#10f48e]/25 font-extrabold'
                      : 'bg-white/5 border border-white/10 text-zinc-300 hover:border-[#10f48e]/40 hover:text-white'
                  }`}
                >
                  {isSelected ? (
                    <Check className="w-3 h-3 stroke-[3]" />
                  ) : (
                    <span className="text-zinc-500 font-normal">+</span>
                  )}
                  <span>{role}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Kategori 2: Fitur Utama (Features) */}
      {data.features && data.features.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
            <Layers className="w-3.5 h-3.5 text-[#10f48e]" />
            <span>Fitur & Alur Operasional:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.features.map((feat, idx) => {
              const isSelected = selectedFeatures.includes(feat);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleFeature(feat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-[#10f48e] text-black border border-[#10f48e] shadow-md shadow-[#10f48e]/25 font-extrabold'
                      : 'bg-white/5 border border-white/10 text-zinc-300 hover:border-[#10f48e]/40 hover:text-white'
                  }`}
                >
                  {isSelected ? (
                    <Check className="w-3 h-3 stroke-[3]" />
                  ) : (
                    <span className="text-zinc-500 font-normal">+</span>
                  )}
                  <span>{feat}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tombol Aksi Hybrid: Guided (Kirim Pilihan) vs Express (Langsung PRD) */}
      <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={handleSendExpress}
          className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#10f48e]/40 text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
          title="Gunakan seluruh rekomendasi standar industri dan langsung buatkan PRD"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>⚡ Langsung Buatkan PRD Lengkap</span>
        </button>

        <button
          type="button"
          disabled={disabled || totalSelected === 0}
          onClick={handleSendGuided}
          className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black font-extrabold text-xs shadow-md shadow-[#10f48e]/20 transition-all flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-40 disabled:hover:from-emerald-400 disabled:cursor-not-allowed cursor-pointer"
        >
          <Send className="w-3 h-3 stroke-[2.5]" />
          <span>Kirim Pilihan {totalSelected > 0 ? `(${totalSelected})` : ''} ↵</span>
        </button>
      </div>
    </div>
  );
};
