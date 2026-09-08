'use client';

import React, { useState } from 'react';
import { Sparkles, Check, Send, Zap, UserCheck, Layers, Plus, RotateCcw, CheckCheck } from 'lucide-react';

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
  // State untuk peran & fitur (bawaan + kustom buatan user)
  const [roles, setRoles] = useState<string[]>(data.roles || []);
  const [features, setFeatures] = useState<string[]>(data.features || []);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  // State untuk input "Lain-lain"
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [isAddingFeature, setIsAddingFeature] = useState(false);
  const [newFeatureInput, setNewFeatureInput] = useState('');

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

  // Tambah Peran Kustom
  const handleAddCustomRole = () => {
    const trimmed = newRoleInput.trim();
    if (!trimmed) return;
    if (!roles.includes(trimmed)) {
      setRoles((prev) => [...prev, trimmed]);
    }
    if (!selectedRoles.includes(trimmed)) {
      setSelectedRoles((prev) => [...prev, trimmed]);
    }
    setNewRoleInput('');
    setIsAddingRole(false);
  };

  // Tambah Fitur Kustom
  const handleAddCustomFeature = () => {
    const trimmed = newFeatureInput.trim();
    if (!trimmed) return;
    if (!features.includes(trimmed)) {
      setFeatures((prev) => [...prev, trimmed]);
    }
    if (!selectedFeatures.includes(trimmed)) {
      setSelectedFeatures((prev) => [...prev, trimmed]);
    }
    setNewFeatureInput('');
    setIsAddingFeature(false);
  };

  // Pilih Semua
  const handleSelectAll = () => {
    setSelectedRoles([...roles]);
    setSelectedFeatures([...features]);
  };

  // Reset Pilihan
  const handleReset = () => {
    setSelectedRoles([]);
    setSelectedFeatures([]);
  };

  const totalSelected = selectedRoles.length + selectedFeatures.length;
  const totalAvailable = roles.length + features.length;
  const isAllSelected = totalSelected === totalAvailable && totalAvailable > 0;

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
              Pilih opsi di bawah, tambah peran/fitur kustom, atau langsung buatkan PRD
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
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[#10f48e]" />
            <span>Peran Pengguna (Roles):</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {roles.map((role, idx) => {
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

          {/* Chip Tambah Peran Kustom (Lain-lain) */}
          {isAddingRole ? (
            <div className="flex items-center gap-1 bg-[#14141f] border border-[#10f48e]/40 rounded-xl p-1 animate-in fade-in duration-150">
              <input
                type="text"
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomRole();
                  } else if (e.key === 'Escape') {
                    setIsAddingRole(false);
                  }
                }}
                placeholder="Nama peran baru..."
                className="bg-transparent px-2 py-0.5 text-xs text-white placeholder-zinc-500 focus:outline-none w-32"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddCustomRole}
                className="px-2 py-1 rounded-lg bg-[#10f48e] text-black font-extrabold text-[10.5px] hover:bg-emerald-400"
              >
                Tambah
              </button>
              <button
                type="button"
                onClick={() => setIsAddingRole(false)}
                className="px-1.5 py-1 text-[10.5px] text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsAddingRole(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-dashed border-zinc-600 hover:border-[#10f48e]/60 text-zinc-400 hover:text-[#10f48e] text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Lainnya...</span>
            </button>
          )}
        </div>
      </div>

      {/* Kategori 2: Fitur Utama (Features) */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#10f48e]" />
            <span>Fitur & Alur Operasional:</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {features.map((feat, idx) => {
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

          {/* Chip Tambah Fitur Kustom (Lain-lain) */}
          {isAddingFeature ? (
            <div className="flex items-center gap-1 bg-[#14141f] border border-[#10f48e]/40 rounded-xl p-1 animate-in fade-in duration-150">
              <input
                type="text"
                value={newFeatureInput}
                onChange={(e) => setNewFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomFeature();
                  } else if (e.key === 'Escape') {
                    setIsAddingFeature(false);
                  }
                }}
                placeholder="Ketik fitur kustom..."
                className="bg-transparent px-2 py-0.5 text-xs text-white placeholder-zinc-500 focus:outline-none w-36"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddCustomFeature}
                className="px-2 py-1 rounded-lg bg-[#10f48e] text-black font-extrabold text-[10.5px] hover:bg-emerald-400"
              >
                Tambah
              </button>
              <button
                type="button"
                onClick={() => setIsAddingFeature(false)}
                className="px-1.5 py-1 text-[10.5px] text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsAddingFeature(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-dashed border-zinc-600 hover:border-[#10f48e]/60 text-zinc-400 hover:text-[#10f48e] text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Tambah Fitur Lain...</span>
            </button>
          )}
        </div>
      </div>

      {/* Tombol Aksi Hybrid Dinamis */}
      <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {totalSelected === 0 ? (
          <>
            {/* Keadaan 0 Dipilih: Tombol Express + Tombol Pilih Semua */}
            <button
              type="button"
              disabled={disabled}
              onClick={handleSendExpress}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-500/5 hover:from-amber-500/25 hover:to-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
              title="Langsung buatkan PRD lengkap dengan rekomendasi standar"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>⚡ Langsung Buatkan PRD Lengkap</span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={handleSelectAll}
              className="py-2 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[#10f48e]" />
              <span>Pilih Semua ({totalAvailable})</span>
            </button>
          </>
        ) : (
          <>
            {/* Keadaan 1+ Dipilih: Tombol Reset/Pilih Semua + Tombol Kirim Pilihan */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={handleReset}
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white text-xs font-medium transition-all flex items-center gap-1 cursor-pointer active:scale-98"
                title="Batalkan semua pilihan"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>

              {!isAllSelected && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handleSelectAll}
                  className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1 cursor-pointer active:scale-98"
                >
                  <span>Pilih Semua</span>
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={handleSendGuided}
              className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black font-extrabold text-xs shadow-lg shadow-[#10f48e]/25 transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
            >
              <Send className="w-3 h-3 stroke-[2.5]" />
              <span>Kirim Pilihan ({totalSelected}) ↵</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
