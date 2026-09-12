'use client';

import React, { useState } from 'react';
import { CheckSquare, Square, CheckCircle2, Circle, Sparkles, Plus } from 'lucide-react';
import type { GuidedStepPayload } from '@/lib/templates/processes/types';

interface GuidedStepCardProps {
  payload: GuidedStepPayload;
  disabled?: boolean;
  preselectRecommended?: boolean;
  onSubmit: (selected: string[], other?: string) => void;
}

/**
 * Kartu pilihan sesi mockup terpandu (checklist / single-select) + opsi "Lainnya".
 * Opsi berasal dari repository proses bisnis (dikirim server), bukan dari AI bebas.
 */
export const GuidedStepCard: React.FC<GuidedStepCardProps> = ({
  payload,
  disabled,
  preselectRecommended,
  onSubmit
}) => {
  const initialSelected = payload.options
    .filter((o) => o.locked || (preselectRecommended && o.recommended))
    .map((o) => o.id);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id: string) => {
    if (disabled || submitted) return;
    const option = payload.options.find((o) => o.id === id);
    if (option?.locked) return;
    if (payload.multi) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelected([id]);
    }
  };

  const isInputRequired = selected.some((id) => {
    const opt = payload.options.find((o) => o.id === id);
    return opt?.requiresInput || /koreksi|adjust|clarify/i.test(id);
  });

  const canSubmit = isInputRequired
    ? other.trim().length > 0
    : selected.length > 0 || (otherOpen && other.trim().length > 0);

  const handleSubmit = () => {
    if (!canSubmit || disabled || submitted) return;
    setSubmitted(true);
    onSubmit(selected, other.trim() || undefined);
  };

  const selectedLabels = payload.options
    .filter((o) => selected.includes(o.id))
    .map((o) => o.label);

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#10f48e]/25 bg-[#10f48e]/5 p-3 text-[11px] text-zinc-300">
        <div className="flex items-center gap-1.5 text-[#10f48e] font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Jawaban tersimpan</span>
        </div>
        <p className="mt-1 text-zinc-400">
          {selectedLabels.join(', ') || other || '-'}
          {other ? ` (+ ${other})` : ''}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0c11] p-3.5 space-y-3 shadow-inner">
      <div className="flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#10f48e] shrink-0 mt-0.5" />
        <p className="text-[11.5px] font-semibold text-zinc-200 leading-relaxed">{payload.title}</p>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar pr-0.5">
        {payload.options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const needsInput = opt.requiresInput || /koreksi|adjust|clarify/i.test(opt.id);
          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={0}
              onClick={() => toggle(opt.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                    toggle(opt.id);
                  }
                }
              }}
              className={`w-full flex flex-col gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-[#10f48e]/10 border-[#10f48e]/40 text-zinc-100'
                  : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:border-white/20'
              } ${opt.locked ? 'cursor-default opacity-95' : 'cursor-pointer active:scale-[0.99]'}`}
            >
              <div className="flex items-start gap-2.5 w-full">
                <span className="mt-0.5 shrink-0">
                  {payload.multi ? (
                    isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#10f48e]" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-zinc-600" />
                    )
                  ) : isSelected ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10f48e]" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-zinc-600" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold">{opt.label}</span>
                    {opt.roleStatus === 'WAJIB_OWNER' && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400 border border-amber-400/30 rounded px-1.5 py-0.5 shrink-0">
                        Wajib (Owner)
                      </span>
                    )}
                    {(opt.roleStatus === 'WAJIB_INTI' || opt.category === 'ALUR_INTI') && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#10f48e] border border-[#10f48e]/30 rounded px-1.5 py-0.5 shrink-0">
                        Wajib (Alur Inti)
                      </span>
                    )}
                    {opt.category === 'ALUR_PENDUKUNG' && (
                      <span className="text-[9px] font-medium tracking-wide text-sky-400 border border-sky-400/30 rounded px-1.5 py-0.5 shrink-0">
                        Alur Pendukung
                      </span>
                    )}
                    {opt.category === 'FITUR_PENDUKUNG' && (
                      <span className="text-[9px] font-medium tracking-wide text-purple-400 border border-purple-400/30 rounded px-1.5 py-0.5 shrink-0">
                        Fitur Pendukung (MVP)
                      </span>
                    )}
                    {opt.roleStatus === 'TAMBAHAN' && (
                      <span className="text-[9px] font-medium tracking-wide text-zinc-400 border border-white/10 rounded px-1.5 py-0.5 shrink-0">
                        Tambahan
                      </span>
                    )}
                    {!opt.roleStatus && !opt.category && opt.recommended && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#10f48e] border border-[#10f48e]/30 rounded px-1 py-0.5 shrink-0">
                        Disarankan
                      </span>
                    )}
                  </span>
                  {opt.description && (
                    <span className="block text-[10.5px] text-zinc-400 mt-1 leading-relaxed">{opt.description}</span>
                  )}
                  {opt.responsibilities && opt.responsibilities.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-white/5">
                      <span className="text-[9.5px] font-medium text-zinc-400 block mb-0.5">Tanggung Jawab Utama:</span>
                      <ul className="space-y-0.5 text-[9.5px] text-zinc-300">
                        {opt.responsibilities.map((t, idx) => (
                          <li key={idx} className="flex items-start gap-1 leading-snug">
                            <span className="text-[#10f48e] select-none shrink-0">•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {opt.steps && opt.steps.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-white/5 space-y-1">
                      <span className="text-[9.5px] font-semibold text-zinc-400 block mb-1">
                        Tahapan Alur ({opt.steps.length} langkah):
                      </span>
                      <ol className="space-y-1 text-[10px] text-zinc-300">
                        {opt.steps.map((st, sIdx) => (
                          <li key={sIdx} className="flex items-start gap-1.5 leading-snug">
                            <span className="text-zinc-500 font-mono text-[9px] shrink-0 mt-0.5">{sIdx + 1}.</span>
                            <span>
                              <strong className="text-[#10f48e] font-semibold">({st.pelaku})</strong> {st.aksi}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </span>
              </div>

              {/* Inline input area bila opsi memerlukan masukan/koreksi teks */}
              {isSelected && needsInput && (
                <div
                  className="mt-1 pt-2 border-t border-white/10 w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="block text-[10px] font-semibold text-[#10f48e] mb-1.5 flex items-center gap-1">
                    <span>✏️ Tulis detail perbaikan / koreksi:</span>
                  </label>
                  <textarea
                    value={other}
                    onChange={(e) => setOther(e.target.value)}
                    placeholder={
                      opt.inputPlaceholder ||
                      'Tuliskan perbaikan alur, langkah, atau fitur di sini...'
                    }
                    rows={3}
                    className="w-full bg-[#101016] border border-white/15 focus:border-[#10f48e]/60 rounded-lg p-2 text-[11px] text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none transition-colors"
                    autoFocus
                  />
                  {other.trim().length === 0 && (
                    <span className="text-[9.5px] text-amber-400/90 block mt-1">
                      * Kolom ini wajib diisi sebelum mengirim koreksi
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {payload.allowOther && (
        <div className="pt-1 border-t border-white/10">
          {!otherOpen ? (
            <button
              type="button"
              onClick={() => setOtherOpen(true)}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 text-[10.5px] text-zinc-400 hover:text-[#10f48e] transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Lainnya (isi sendiri)</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Tulis kebutuhan lain..."
                className="flex-1 bg-[#101016] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#10f48e]/50"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setOtherOpen(false);
                  setOther('');
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || disabled}
        className={`w-full py-2 rounded-xl text-[11.5px] font-bold transition-all ${
          !canSubmit || disabled
            ? 'bg-white/5 text-zinc-600 cursor-not-allowed'
            : isInputRequired
            ? 'bg-gradient-to-r from-amber-400 to-[#10f48e] hover:from-amber-500 hover:to-[#0df28a] text-black active:scale-[0.99]'
            : 'bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black active:scale-[0.99]'
        }`}
      >
        {isInputRequired ? 'Kirim Koreksi' : 'Lanjut'}
      </button>
    </div>
  );
};
