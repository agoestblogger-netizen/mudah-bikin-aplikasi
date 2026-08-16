'use client';

import React, { useState } from 'react';
import { AppProjectState, InputMode, ImageSubCase } from '@/types/app';
import { MessageSquareCode, Image as ImageIcon, Sparkles, CheckCircle2, Shield, Lock, Sliders, ArrowRight } from 'lucide-react';

interface Phase1InterviewProps {
  projectState: AppProjectState;
  onUpdateState: (updated: Partial<AppProjectState>) => void;
  onNextPhase: () => void;
}

export const Phase1Interview: React.FC<Phase1InterviewProps> = ({
  projectState,
  onUpdateState,
  onNextPhase
}) => {
  const [inputMode, setInputMode] = useState<InputMode>(projectState.inputMode);
  const [imageSubCase, setImageSubCase] = useState<ImageSubCase>(projectState.imageSubCase || 'SCREENSHOT_REF');

  // Form Fields
  const [title, setTitle] = useState(projectState.title);
  const [description, setDescription] = useState(projectState.description);
  const [targetUsers, setTargetUsers] = useState(projectState.mandatorySpecs.targetUsers);
  const [appGoal, setAppGoal] = useState(projectState.mandatorySpecs.appGoal);
  const [requiresLogin, setRequiresLogin] = useState(projectState.mandatorySpecs.requiresLogin);
  const [hasAdminRole, setHasAdminRole] = useState(projectState.mandatorySpecs.hasAdminRole);
  const [hasUserManagement, setHasUserManagement] = useState(projectState.mandatorySpecs.hasUserManagement);
  const [keyButtons, setKeyButtons] = useState(projectState.mandatorySpecs.keyButtonsActions.join('\n'));
  const [validationRules, setValidationRules] = useState(projectState.mandatorySpecs.basicValidationRules.join('\n'));

  // Visual DNA Fields
  const [themeName, setThemeName] = useState(projectState.visualDNA.themeName);
  const [primaryColor, setPrimaryColor] = useState(projectState.visualDNA.primaryColor);
  const [visualMood, setVisualMood] = useState(projectState.visualDNA.visualMood);

  const handleSaveAndContinue = () => {
    onUpdateState({
      title,
      description,
      inputMode,
      imageSubCase,
      visualDNA: {
        ...projectState.visualDNA,
        themeName,
        primaryColor,
        visualMood
      },
      mandatorySpecs: {
        ...projectState.mandatorySpecs,
        requiresLogin,
        loginType: requiresLogin ? (hasAdminRole ? 'ROLE_BASED' : 'BASIC_AUTH') : 'NONE',
        hasAdminRole,
        hasUserManagement,
        targetUsers,
        appGoal,
        keyButtonsActions: keyButtons.split('\n').filter((s) => s.trim().length > 0),
        basicValidationRules: validationRules.split('\n').filter((s) => s.trim().length > 0)
      }
    });

    onNextPhase();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 lg:p-8 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <MessageSquareCode className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">FASE 1: Wawancara & Analisis Visual DNA</h2>
            <p className="text-xs text-slate-400">Tentukan jalur masukan ide, kebutuhan autentikasi, serta tombol aksi wajib.</p>
          </div>
        </div>

        {/* Input Mode Switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <button
            type="button"
            onClick={() => {
              setInputMode('TEXT');
              onUpdateState({ inputMode: 'TEXT' });
            }}
            className={`flex items-start gap-4 p-5 rounded-2xl border transition-all text-left ${
              inputMode === 'TEXT'
                ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <MessageSquareCode className={`w-6 h-6 mt-1 ${inputMode === 'TEXT' ? 'text-indigo-400' : 'text-slate-500'}`} />
            <div>
              <h3 className="font-semibold text-sm text-white">Jalur 1: Wawancara Teks Interaktif</h3>
              <p className="text-xs text-slate-400 mt-1">Jelaskan tujuan aplikasi, alur kerja utama, serta daftar role pengguna secara naratif.</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setInputMode('IMAGE_VISUAL_DNA');
              onUpdateState({ inputMode: 'IMAGE_VISUAL_DNA' });
            }}
            className={`flex items-start gap-4 p-5 rounded-2xl border transition-all text-left ${
              inputMode === 'IMAGE_VISUAL_DNA'
                ? 'bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <ImageIcon className={`w-6 h-6 mt-1 ${inputMode === 'IMAGE_VISUAL_DNA' ? 'text-purple-400' : 'text-slate-500'}`} />
            <div>
              <h3 className="font-semibold text-sm text-white">Jalur 2: Analisis Gambar & Visual DNA</h3>
              <p className="text-xs text-slate-400 mt-1">Ekstrak gaya visual dari sketsa UI, screenshot referensi, atau diagram arsitektur.</p>
            </div>
          </button>
        </div>

        {/* If Image Visual DNA Sub-Cases */}
        {inputMode === 'IMAGE_VISUAL_DNA' && (
          <div className="mt-6 p-4 rounded-2xl bg-purple-950/20 border border-purple-800/40 space-y-3">
            <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">Sub-Kasus Referensi Gambar:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'SKETCH_UI', label: '1. Sketsa Oretan UI' },
                { id: 'SCREENSHOT_REF', label: '2. Screenshot Referensi' },
                { id: 'COLOR_PALETTE', label: '3. Tema & Palet Warna' },
                { id: 'ARCH_DIAGRAM', label: '4. Diagram Arsitektur' }
              ].map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setImageSubCase(sc.id as ImageSubCase)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    imageSubCase === sc.id
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Form Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Identitas Proyek & Alur */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            1. Informasi Dasar Proyek
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Nama Proyek / Aplikasi</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Contoh: Aplikasi Kasir & Toko"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Deskripsi Singkat & Ringkasan Ide</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Jelaskan kebutuhan utama aplikasi..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Target Pengguna Utama</label>
            <input
              type="text"
              value={targetUsers}
              onChange={(e) => setTargetUsers(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Kasir, Admin, Pelanggan, dsb."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Daftar Tombol & Akses Kerja Utama (1 Per Baris)</label>
            <textarea
              rows={4}
              value={keyButtons}
              onChange={(e) => setKeyButtons(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none font-mono text-xs"
              placeholder="Tambah Barang Baru&#10;Proses Transaksi&#10;Kelola User"
            />
          </div>
        </div>

        {/* Right Column: Mandat Autentikasi & Validasi */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            2. Autentikasi & Aturan Validasi Mutlak
          </h3>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-white">Butuh Halaman Login?</span>
                <p className="text-xs text-slate-400">Proteksi aplikasi dengan halaman autentikasi awal</p>
              </div>
              <input
                type="checkbox"
                checked={requiresLogin}
                onChange={(e) => setRequiresLogin(e.target.checked)}
                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
              />
            </div>

            {requiresLogin && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white">Role Admin & User Management?</span>
                    <p className="text-[11px] text-slate-400">Penting: Fitur Tambah User WAJIB terkunci di balik login Admin</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasAdminRole}
                    onChange={(e) => {
                      setHasAdminRole(e.target.checked);
                      setHasUserManagement(e.target.checked);
                    }}
                    className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Aturan Validasi Form / Karakter (1 Per Baris)</label>
            <textarea
              rows={4}
              value={validationRules}
              onChange={(e) => setValidationRules(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-indigo-500 focus:outline-none font-mono text-xs"
              placeholder="Username tidak boleh kosong&#10;Harga harus angka positif"
            />
          </div>

          {/* Visual Style Selection */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-medium text-slate-300">Gaya Visual Mood</label>
            <div className="grid grid-cols-2 gap-2">
              {['Glassmorphism', 'Minimalist Modern', 'Vibrant Tech', 'Corporate Elegant'].map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => setVisualMood(mood as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                    visualMood === mood
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSaveAndContinue}
          className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all"
        >
          <span>Simpan & Lanjut ke Live Canvas Studio (Fase 2)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
