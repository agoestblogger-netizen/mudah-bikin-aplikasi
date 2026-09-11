'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  Layers,
  Users,
  ListChecks,
  Sparkles,
  ChevronUp,
  X,
  Plus,
  Rocket,
  AlertTriangle
} from 'lucide-react';
import type { MockupSessionState } from '@/lib/templates/processes/types';
import {
  getProcessPatternsByIds,
  getIndustryOverlaysByIds,
  buildBusinessProcessChecklist,
  detectTier
} from '@/lib/templates/processes/registry';
import {
  compileBriefFromSession,
  isBriefBusinessComplete,
  listSessionFeatures,
  REQUIRED_ROLE
} from '@/lib/templates/processes/guided';

interface BriefEditorPageProps {
  session: MockupSessionState;
  onApprove: (brief: string) => void;
  onUpdateSession: (session: MockupSessionState) => void;
}

/**
 * Halaman Brief interaktif (E.5) — dokumen seperti notepad di panel kanan.
 * Core terkunci, advisory bebas. BASIC tampil ringkas + tombol "Lihat detail".
 */
export const BriefEditorPage: React.FC<BriefEditorPageProps> = ({
  session,
  onApprove,
  onUpdateSession
}) => {
  const [draft, setDraft] = useState<MockupSessionState>(session);
  const [expanded, setExpanded] = useState(session.match.tier === 'ADVANCE');
  const [newRole, setNewRole] = useState('');
  const [newFeature, setNewFeature] = useState('');
  const [appName, setAppName] = useState(() => {
    const overlaysInit = getIndustryOverlaysByIds(session.match.overlayIds);
    return overlaysInit[0] ? `Aplikasi ${overlaysInit[0].nama}` : 'Aplikasi Baru';
  });

  const patterns = useMemo(() => getProcessPatternsByIds(draft.match.patternIds), [draft.match.patternIds]);
  const overlays = useMemo(() => getIndustryOverlaysByIds(draft.match.overlayIds), [draft.match.overlayIds]);
  const checklist = useMemo(
    () => buildBusinessProcessChecklist(draft.match.patternIds, draft.match.overlayIds, draft.match.templateId),
    [draft.match.patternIds, draft.match.overlayIds, draft.match.templateId]
  );
  const features = useMemo(() => listSessionFeatures(draft), [draft]);
  const tierInfo = useMemo(
    () =>
      detectTier({
        patternIds: draft.match.patternIds,
        roleCount: draft.roles.selected.length,
        selectedFeatureIds: draft.features.selected.filter((f) => f.priority === 'WAJIB').map((f) => f.id)
      }),
    [draft]
  );
  const completeness = useMemo(() => isBriefBusinessComplete(draft), [draft]);

  const selectedMap = useMemo(() => {
    const map = new Map<string, 'WAJIB' | 'NYUSUL'>();
    draft.features.selected.forEach((f) => map.set(f.id, f.priority));
    return map;
  }, [draft]);

  const selectedRoleSet = useMemo(() => new Set(draft.roles.selected), [draft]);

  const flowLabel = useMemo(() => {
    if (!draft.flow.selectedId) return draft.flow.other || '-';
    for (const p of patterns) {
      const v = p.flowVariants.find((x) => x.id === draft.flow.selectedId);
      if (v) return v.label;
    }
    return draft.flow.other || draft.flow.selectedId;
  }, [draft, patterns]);

  const update = (next: MockupSessionState) => {
    setDraft(next);
    onUpdateSession(next);
  };

  const toggleRole = (role: string) => {
    if (role === REQUIRED_ROLE) return;
    const selected = selectedRoleSet.has(role)
      ? draft.roles.selected.filter((r) => r !== role)
      : [...draft.roles.selected, role];
    update({ ...draft, roles: { ...draft.roles, selected } });
  };

  const addCustomRole = () => {
    const value = newRole.trim();
    if (!value) return;
    if (!selectedRoleSet.has(value)) {
      update({ ...draft, roles: { ...draft.roles, selected: [...draft.roles.selected, value] } });
    }
    setNewRole('');
  };

  const toggleFeature = (id: string, isCore: boolean) => {
    if (isCore) return;
    const exists = selectedMap.has(id);
    const selected = exists
      ? draft.features.selected.filter((f) => f.id !== id)
      : [...draft.features.selected, { id, priority: 'WAJIB' as const }];
    update({ ...draft, features: { ...draft.features, selected } });
  };

  const setPriority = (id: string, priority: 'WAJIB' | 'NYUSUL', isCore: boolean) => {
    if (isCore && priority === 'NYUSUL') return;
    const selected = draft.features.selected.map((f) => (f.id === id ? { ...f, priority } : f));
    update({ ...draft, features: { ...draft.features, selected } });
  };

  const addCustomFeature = () => {
    const value = newFeature.trim();
    if (!value) return;
    update({ ...draft, features: { ...draft.features, other: value } });
    setNewFeature('');
  };

  const handleApprove = () => {
    const brief = compileBriefFromSession(draft, { appName });
    onApprove(brief);
  };

  const totalWajib = draft.features.selected.filter((f) => f.priority === 'WAJIB').length;
  const totalNyusul = draft.features.selected.filter((f) => f.priority === 'NYUSUL').length;

  if (!expanded) {
    return (
      <div className="w-full h-full overflow-y-auto bg-[#0b0b10] p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#101016] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#10f48e]" />
                Brief Kebutuhan Siap
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#10f48e] border border-[#10f48e]/30 rounded px-2 py-0.5">
                {tierInfo.tier}
              </span>
            </div>
            <p className="text-[11.5px] text-zinc-400 leading-relaxed">
              {patterns.map((p) => p.nama).join(' + ') || 'Aplikasi umum'}
              {overlays.length ? ` • ${overlays.map((o) => o.nama).join(', ')}` : ''}
            </p>
            <div className="flex flex-wrap gap-2 text-[10.5px] text-zinc-400">
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {draft.roles.selected.length} peran
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {totalWajib} fitur wajib
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {totalNyusul} fitur V2
              </span>
            </div>
            {!completeness.complete && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200 space-y-1">
                {completeness.missing.slice(0, 4).map((m, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-200 text-[11.5px] font-semibold transition-colors"
              >
                Lihat detail
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={!completeness.complete}
                className={`flex-1 py-2 rounded-xl text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                  completeness.complete
                    ? 'bg-gradient-to-r from-emerald-400 to-[#10f48e] text-black active:scale-[0.99]'
                    : 'bg-white/5 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <Rocket className="w-3.5 h-3.5" />
                Setujui & Buat Prototype
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-[#0b0b10] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4 pb-24">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-[#10f48e]" />
            Brief Kebutuhan
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#10f48e] border border-[#10f48e]/30 rounded px-2 py-0.5">
              {tierInfo.tier}
            </span>
            {tierInfo.reasons.length > 0 && (
              <span className="text-[10px] text-zinc-500 truncate max-w-[240px]" title={tierInfo.reasons.join('; ')}>
                {tierInfo.reasons.join('; ')}
              </span>
            )}
          </div>
        </div>

        {/* Identitas */}
        <section className="rounded-2xl border border-white/10 bg-[#101016] p-4 space-y-3">
          <label className="block text-[10.5px] font-semibold text-zinc-400">Nama Aplikasi</label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="Contoh: AutoRent Pro"
            className="w-full bg-[#0c0c11] border border-white/10 rounded-xl px-3 py-2 text-[12px] text-zinc-100 focus:outline-none focus:border-[#10f48e]/50"
          />
          <p className="text-[10.5px] text-zinc-500">
            Alur terpilih: <span className="text-zinc-300">{flowLabel}</span>
          </p>
        </section>

        {/* Peta Proses Bisnis */}
        <section className="rounded-2xl border border-white/10 bg-[#101016] p-4 space-y-3">
          <h2 className="text-[11.5px] font-bold text-zinc-200 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-[#10f48e]" />
            Peta Proses Bisnis
          </h2>

          <div className="flex flex-wrap gap-1.5">
            {patterns.map((p) => (
              <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-[#10f48e]/10 border border-[#10f48e]/25 text-[#10f48e]">
                {p.nama}
              </span>
            ))}
            {overlays.map((o) => (
              <span key={o.id} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-400/25 text-indigo-300">
                {o.nama}
              </span>
            ))}
          </div>

          {checklist.coreTransitions.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold text-zinc-400 mb-1">Transisi Inti (terkunci)</p>
              <div className="flex flex-wrap gap-1.5">
                {checklist.coreTransitions.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300">
                    <Lock className="w-3 h-3 text-indigo-300" />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {checklist.coreRules.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold text-zinc-400 mb-1">Aturan Bisnis Inti (terkunci)</p>
              <ul className="space-y-0.5">
                {checklist.coreRules.map((r) => (
                  <li key={r} className="flex items-start gap-1.5 text-[11px] text-zinc-300">
                    <Lock className="w-3 h-3 text-indigo-300 shrink-0 mt-0.5" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {checklist.coreEdgeCases.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold text-zinc-400 mb-1">Edge Case Inti (terkunci)</p>
              <div className="flex flex-wrap gap-1.5">
                {checklist.coreEdgeCases.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300">
                    <Lock className="w-3 h-3 text-indigo-300" />
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {checklist.advisoryItems.length > 0 && (
            <div>
              <p className="text-[10.5px] font-semibold text-zinc-400 mb-1">Saran (opsional)</p>
              <div className="flex flex-wrap gap-1.5">
                {checklist.advisoryItems.map((a) => (
                  <span key={a} className="text-[10.5px] px-2 py-1 rounded-lg bg-white/[0.02] border border-dashed border-white/10 text-zinc-500">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Fitur */}
        <section className="rounded-2xl border border-white/10 bg-[#101016] p-4 space-y-3">
          <h2 className="text-[11.5px] font-bold text-zinc-200 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10f48e]" />
            Fitur
          </h2>
          <div className="space-y-1.5 max-h-72 overflow-y-auto no-scrollbar pr-0.5">
            {features.map((f) => {
              const priority = selectedMap.get(f.id);
              const isSelected = Boolean(priority);
              const isCore = f.severity === 'core';
              return (
                <div
                  key={f.id}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${
                    isSelected ? 'bg-[#10f48e]/5 border-[#10f48e]/25' : 'bg-white/[0.02] border-white/10'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFeature(f.id, isCore)}
                    disabled={isCore}
                    className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${
                      isSelected ? 'bg-[#10f48e] border-[#10f48e]' : 'border-zinc-600'
                    } ${isCore ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                  >
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-black" />}
                  </button>
                  <span className="flex-1 text-[11.5px] text-zinc-200 truncate">
                    {f.label}
                    {isCore && <Lock className="inline w-3 h-3 text-indigo-300 ml-1.5 -mt-0.5" />}
                  </span>
                  <span className="text-[9.5px] text-zinc-500 shrink-0">{f.complexity}</span>
                  {isSelected && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPriority(f.id, 'WAJIB', isCore)}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                          priority === 'WAJIB'
                            ? 'bg-[#10f48e]/15 border-[#10f48e]/40 text-[#10f48e]'
                            : 'border-white/10 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Wajib
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriority(f.id, 'NYUSUL', isCore)}
                        disabled={isCore}
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                          priority === 'NYUSUL'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'border-white/10 text-zinc-500 hover:text-zinc-300'
                        } ${isCore ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        V2
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
            <input
              type="text"
              value={newFeature}
              onChange={(e) => setNewFeature(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomFeature()}
              placeholder="Tambah fitur lain..."
              className="flex-1 bg-[#0c0c11] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#10f48e]/50"
            />
            <button
              type="button"
              onClick={addCustomFeature}
              disabled={!newFeature.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-[10.5px] disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {draft.features.other && (
            <p className="text-[10.5px] text-zinc-400">Tambahan: {draft.features.other}</p>
          )}
        </section>

        {/* Peran */}
        <section className="rounded-2xl border border-white/10 bg-[#101016] p-4 space-y-3">
          <h2 className="text-[11.5px] font-bold text-zinc-200 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#10f48e]" />
            Peran & Halaman
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {Array.from(new Set([REQUIRED_ROLE, ...checklist.roles, ...draft.roles.selected])).map((role) => {
              const isLocked = role === REQUIRED_ROLE;
              const isSelected = role === REQUIRED_ROLE || selectedRoleSet.has(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  disabled={isLocked}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[10.5px] transition-colors ${
                    isSelected
                      ? 'bg-[#10f48e]/10 border-[#10f48e]/35 text-zinc-100'
                      : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200'
                  } ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {isLocked && <Lock className="w-3 h-3 text-indigo-300" />}
                  {role}
                  {!isLocked && isSelected && <X className="w-3 h-3 opacity-60" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomRole()}
              placeholder="Tambah peran lain..."
              className="flex-1 bg-[#0c0c11] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#10f48e]/50"
            />
            <button
              type="button"
              onClick={addCustomRole}
              disabled={!newRole.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-[10.5px] disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {draft.roles.other && <p className="text-[10.5px] text-zinc-400">Tambahan: {draft.roles.other}</p>}
        </section>

        {/* Catatan */}
        {(draft.painPoints.selected.length > 0 || draft.painPoints.other || draft.flow.other) && (
          <section className="rounded-2xl border border-white/10 bg-[#101016] p-4 space-y-2">
            <h2 className="text-[11.5px] font-bold text-zinc-200">Catatan</h2>
            {draft.painPoints.selected.length > 0 && (
              <p className="text-[11px] text-zinc-400">
                Masalah dipilih: {draft.painPoints.selected.length} poin
              </p>
            )}
            {draft.painPoints.other && <p className="text-[11px] text-zinc-400">Masalah lain: {draft.painPoints.other}</p>}
            {draft.flow.other && <p className="text-[11px] text-zinc-400">Alur lain: {draft.flow.other}</p>}
          </section>
        )}

        {!completeness.complete && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200 space-y-1">
            {completeness.missing.slice(0, 6).map((m, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{m}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer aksi */}
      <div className="sticky bottom-0 left-0 right-0 mt-4 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10] to-transparent pt-3 pb-2">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-[11px] font-semibold flex items-center gap-1"
          >
            <ChevronUp className="w-3.5 h-3.5" />
            Ringkas
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={!completeness.complete}
            className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all ${
              completeness.complete
                ? 'bg-gradient-to-r from-emerald-400 to-[#10f48e] text-black active:scale-[0.99]'
                : 'bg-white/5 text-zinc-600 cursor-not-allowed'
            }`}
          >
            <Rocket className="w-4 h-4" />
            Setujui & Buat Prototype
          </button>
        </div>
      </div>
    </div>
  );
};
