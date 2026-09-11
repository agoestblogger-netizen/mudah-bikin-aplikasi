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
    .filter((o) => preselectRecommended && o.recommended)
    .map((o) => o.id);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggle = (id: string) => {
    if (disabled || submitted) return;
    if (payload.multi) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelected([id]);
    }
  };

  const canSubmit =
    selected.length > 0 || (otherOpen && other.trim().length > 0);

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

      <div className="space-y-1.5 max-h-72 overflow-y-auto no-scrollbar pr-0.5">
        {payload.options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              disabled={disabled}
              className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-[#10f48e]/10 border-[#10f48e]/40 text-zinc-100'
                  : 'bg-white/[0.03] border-white/10 text-zinc-300 hover:border-white/20'
              } cursor-pointer active:scale-[0.99]`}
            >
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
                <span className="flex items-center gap-1.5">
                  <span className="text-[11.5px] font-medium truncate">{opt.label}</span>
                  {opt.recommended && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[#10f48e] border border-[#10f48e]/30 rounded px-1 py-0.5 shrink-0">
                      Disarankan
                    </span>
                  )}
                </span>
                {opt.description && (
                  <span className="block text-[10px] text-zinc-500 mt-0.5 leading-snug">{opt.description}</span>
                )}
              </span>
            </button>
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
            : 'bg-gradient-to-r from-emerald-400 to-[#10f48e] hover:from-emerald-500 hover:to-[#0df28a] text-black active:scale-[0.99]'
        }`}
      >
        Lanjut
      </button>
    </div>
  );
};
