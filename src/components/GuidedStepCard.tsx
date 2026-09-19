'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  CheckCircle2,
  Circle,
  Sparkles,
  Plus,
  Pencil,
  Loader2,
  AlertCircle,
  History,
  ArrowLeft,
  ArrowUpRight,
  GitMerge
} from 'lucide-react';
import type {
  GuidedStepPayload,
  GuidedStepOption,
  EntityDataCardItem,
  RoleModuleChecklistGroup,
  RoleModuleChecklistItem
} from '@/lib/templates/processes/types';
import { getAuthHeaders } from '@/lib/supabase/client';
import { DomainMindMapCard } from './DomainMindMapCard';

export interface CustomRoleItem {
  id: string;
  label: string;
  description: string;
  responsibilities: string[];
}

export interface EditedRoleItem {
  description: string;
  responsibilities: string[];
}

export interface EditedEntityItem {
  name: string;
  description: string;
}

interface GuidedStepCardProps {
  payload: GuidedStepPayload;
  disabled?: boolean;
  preselectRecommended?: boolean;
  session?: any;
  apiExtraPayload?: Record<string, any>;
  onSubmit: (
    selected: string[],
    other?: string,
    customRoles?: CustomRoleItem[],
    editedRoles?: Record<string, EditedRoleItem>,
    promotedEntities?: string[],
    editedEntities?: Record<string, EditedEntityItem>,
    roleModuleChecklist?: RoleModuleChecklistGroup[]
  ) => void;
}

/**
 * Kartu pilihan sesi mockup terpandu (checklist / single-select) + opsi peran kustom & edit deskripsi.
 */
export const GuidedStepCard: React.FC<GuidedStepCardProps> = ({
  payload,
  disabled,
  preselectRecommended,
  session,
  apiExtraPayload,
  onSubmit
}) => {
  const initialSelected = payload.options
    .filter((o) => o.locked || (preselectRecommended && o.recommended))
    .map((o) => o.id);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Bagian A & B: State untuk penambahan multi-role custom
  const [customRoles, setCustomRoles] = useState<CustomRoleItem[]>([]);
  const [showAddRoleForm, setShowAddRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleNote, setNewRoleNote] = useState('');
  const [isAnalyzingRole, setIsAnalyzingRole] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Bagian B: State konfirmasi kemiripan semantik peran
  const [similarityConfirmation, setSimilarityConfirmation] = useState<{
    newRole: CustomRoleItem;
    similarTo: string;
    explanation: string;
  } | null>(null);

  // Bagian D: State inline edit deskripsi & tanggung jawab peran
  const [editedRoles, setEditedRoles] = useState<Record<string, EditedRoleItem>>({});
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editDescDraft, setEditDescDraft] = useState('');
  const [editRespDraft, setEditRespDraft] = useState('');

  // Section Terpisah: Entitas Data (Non-Login)
  const [entities, setEntities] = useState<EntityDataCardItem[]>(payload.entityDataList || []);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [editEntityName, setEditEntityName] = useState('');
  const [editEntityDesc, setEditEntityDesc] = useState('');
  const [promotedEntities, setPromotedEntities] = useState<string[]>([]);
  const [editedEntities, setEditedEntities] = useState<Record<string, EditedEntityItem>>({});

  // Section: Checklist Modul / Form Kerja per Role (Step RBAC: CHECKLIST Stage)
  const isChecklistStage = payload.rbacStage === 'CHECKLIST';
  const [checklistGroups, setChecklistGroups] = useState<RoleModuleChecklistGroup[]>(
    payload.roleModuleChecklist || []
  );
  const [addingModuleForRole, setAddingModuleForRole] = useState<string | null>(null);
  const [customModuleName, setCustomModuleName] = useState('');
  const [customModuleDesc, setCustomModuleDesc] = useState('');
  const [isAnalyzingModule, setIsAnalyzingModule] = useState(false);
  const [moduleMergeConfirmation, setModuleMergeConfirmation] = useState<{
    roleName: string;
    newModuleName: string;
    newModuleDesc: string;
    targetModuleName: string;
    mergeExplanation: string;
    enhancedTargetDescription: string | null;
  } | null>(null);

  const toggleModuleCheck = (roleName: string, itemId: string) => {
    if (disabled || submitted) return;
    setChecklistGroups((prev) =>
      prev.map((g) => {
        if (g.role !== roleName) return g;
        return {
          ...g,
          items: g.items.map((it) =>
            it.id === itemId ? { ...it, checked: !it.checked } : it
          )
        };
      })
    );
  };

  const handleAddCustomModule = async (roleName: string) => {
    const trimmedName = customModuleName.trim();
    if (!trimmedName) return;

    // Daftar modul yang sudah ada untuk role ini
    const existingGroup = checklistGroups.find((g) => g.role === roleName);
    const existingModules = (existingGroup?.items || []).map((it) => ({
      nama: it.nama,
      deskripsi: it.deskripsi
    }));

    setIsAnalyzingModule(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/guided', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'ANALYZE_CUSTOM_MODULE',
          moduleName: trimmedName,
          moduleDesc: customModuleDesc.trim() || undefined,
          roleName,
          existingModules,
          session,
          ...(apiExtraPayload || {})
        })
      });
      const data = await res.json();

      if (data.success && data.canMerge && data.targetModuleName) {
        // Tunjukkan dialog saran penggabungan
        setIsAnalyzingModule(false);
        setModuleMergeConfirmation({
          roleName,
          newModuleName: trimmedName,
          newModuleDesc: customModuleDesc.trim(),
          targetModuleName: data.targetModuleName,
          mergeExplanation: data.mergeExplanation || '',
          enhancedTargetDescription: data.enhancedTargetDescription || null
        });
        return;
      }
    } catch (_err) {
      // Fallback: tambah sebagai mandiri
    }
    setIsAnalyzingModule(false);
    addModuleAsStandalone(roleName, trimmedName, customModuleDesc.trim());
  };

  /** Gabungkan input user ke deskripsi modul target yang sudah ada */
  const applyModuleMerge = () => {
    if (!moduleMergeConfirmation) return;
    const { roleName, targetModuleName, enhancedTargetDescription } = moduleMergeConfirmation;
    setChecklistGroups((prev) =>
      prev.map((g) => {
        if (g.role !== roleName) return g;
        return {
          ...g,
          items: g.items.map((it) =>
            it.nama.toLowerCase() === targetModuleName.toLowerCase()
              ? { ...it, deskripsi: enhancedTargetDescription || it.deskripsi }
              : it
          )
        };
      })
    );
    setModuleMergeConfirmation(null);
    setAddingModuleForRole(null);
    setCustomModuleName('');
    setCustomModuleDesc('');
  };

  /** Tambahkan modul sebagai form mandiri baru di checklist */
  const addModuleAsStandalone = (roleName: string, name: string, desc: string) => {
    const newItem: RoleModuleChecklistItem = {
      id: `mod_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nama: name,
      deskripsi: desc || undefined,
      role: roleName,
      termasukDiAlur: false,
      disarankan: false,
      checked: true,
      isCustom: true
    };
    setChecklistGroups((prev) =>
      prev.map((g) => {
        if (g.role !== roleName) return g;
        return { ...g, items: [...g.items, newItem] };
      })
    );
    setModuleMergeConfirmation(null);
    setAddingModuleForRole(null);
    setCustomModuleName('');
    setCustomModuleDesc('');
  };

  // Gabungkan payload.options dengan customRoles lokal, serta terapkan editedRoles
  const allDisplayOptions: GuidedStepOption[] = [
    ...payload.options.map((opt) => {
      const edited = editedRoles[opt.id] || editedRoles[opt.label];
      if (edited) {
        return {
          ...opt,
          description: edited.description,
          responsibilities: edited.responsibilities
        };
      }
      return opt;
    }),
    ...customRoles.map((cr) => {
      const edited = editedRoles[cr.id] || editedRoles[cr.label];
      return {
        id: cr.id,
        label: cr.label,
        description: edited ? edited.description : cr.description,
        responsibilities: edited ? edited.responsibilities : cr.responsibilities,
        roleStatus: 'TAMBAHAN' as const,
        recommended: true
      };
    })
  ];

  const isBackNavCard = allDisplayOptions.some((o) => o.id.startsWith('jump_step_') || o.id === 'cancel_back');

  const toggle = (id: string) => {
    if (disabled || submitted) return;
    const option = allDisplayOptions.find((o) => o.id === id);
    if (option?.locked) return;
    if (isBackNavCard) {
      // Pada kartu navigasi mundur, klik pada opsi step tujuan atau batal langsung mengeksekusi
      setSelected([id]);
      setSubmitted(true);
      onSubmit([id]);
      return;
    }
    if (payload.multi) {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelected([id]);
      if (otherOpen) {
        setOtherOpen(false);
        setOther('');
      }
    }
  };

  const isInputRequired = selected.some((id) => {
    const opt = allDisplayOptions.find((o) => o.id === id);
    return opt?.requiresInput || /koreksi|adjust|clarify/i.test(id);
  });

  const canSubmit = isInputRequired
    ? other.trim().length > 0
    : otherOpen
    ? payload.multi
      ? selected.length > 0 || other.trim().length > 0
      : other.trim().length > 0
    : selected.length > 0;

  const handleSubmit = () => {
    if (!canSubmit || disabled || submitted) return;
    setSubmitted(true);
    onSubmit(
      selected,
      other.trim() || undefined,
      customRoles.length > 0 ? customRoles : undefined,
      Object.keys(editedRoles).length > 0 ? editedRoles : undefined,
      promotedEntities.length > 0 ? promotedEntities : undefined,
      Object.keys(editedEntities).length > 0 ? editedEntities : undefined,
      isChecklistStage && checklistGroups.length > 0 ? checklistGroups : undefined
    );
  };

  // Handler interaksi Entitas Data (Non-Login)
  const startEditingEntity = (ent: EntityDataCardItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEntityId(ent.id);
    setEditEntityName(ent.name);
    setEditEntityDesc(ent.description);
  };

  const cancelEditingEntity = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEntityId(null);
  };

  const saveEditedEntity = (entId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanName = editEntityName.trim() || entId;
    const cleanDesc = editEntityDesc.trim();
    setEntities((prev) =>
      prev.map((item) =>
        item.id === entId ? { ...item, name: cleanName, description: cleanDesc } : item
      )
    );
    setEditedEntities((prev) => ({
      ...prev,
      [entId]: { name: cleanName, description: cleanDesc }
    }));
    setEditingEntityId(null);
  };

  const promoteEntityToLoginRole = (ent: EntityDataCardItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const finalName = editEntityName.trim() || ent.name || ent.id;
    const finalDesc = editEntityDesc.trim() || ent.description;

    // 1. Hapus dari section Entitas Data
    setEntities((prev) => prev.filter((item) => item.id !== ent.id));
    setEditingEntityId(null);

    // 2. Tambahkan ke customRoles & masukkan ke selected (muncul di daftar peran login)
    const promotedRole: CustomRoleItem = {
      id: finalName,
      label: finalName,
      description: `Pengguna Sistem (Akses Login Mandiri) — ${finalDesc.replace(/^Entitas Data\s*—\s*dicatat\s*&\s*dikelola[^\n.]*[.\s]*/i, '')}`,
      responsibilities: [
        `Mengakses portal/aplikasi mandiri sebagai ${finalName}`,
        `Melihat riwayat dan mengelola transaksi mandiri`
      ]
    };

    setCustomRoles((prev) => [...prev.filter((r) => r.id !== finalName), promotedRole]);
    setSelected((prev) => (prev.includes(finalName) ? prev : [...prev, finalName]));
    setPromotedEntities((prev) => Array.from(new Set([...prev, ent.id, finalName])));
  };

  // Handler penambahan peran kustom dengan analisis AI & semantic similarity check
  const handleAddRole = async () => {
    const trimmedName = newRoleName.trim();
    if (!trimmedName || isAnalyzingRole) return;

    const alreadyExists = allDisplayOptions.some(
      (o) => o.label.toLowerCase() === trimmedName.toLowerCase() || o.id.toLowerCase() === trimmedName.toLowerCase()
    );
    if (alreadyExists) {
      setAnalyzeError(`Peran "${trimmedName}" sudah ada di dalam daftar.`);
      return;
    }

    setIsAnalyzingRole(true);
    setAnalyzeError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/guided', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'ANALYZE_CUSTOM_ROLE',
          roleName: trimmedName,
          roleNote: newRoleNote.trim() || undefined,
          existingRoles: allDisplayOptions.map((o) => ({
            id: o.id,
            label: o.label,
            description: o.description,
            responsibilities: o.responsibilities
          })),
          session,
          ...apiExtraPayload
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gagal menganalisis peran dengan AI.');
      }

      const roleItem: CustomRoleItem = {
        id: data.role.name,
        label: data.role.name,
        description: data.role.description,
        responsibilities: data.role.responsibilities || []
      };

      if (data.similarity?.isSimilar && data.similarity.similarRoleName) {
        setSimilarityConfirmation({
          newRole: roleItem,
          similarTo: data.similarity.similarRoleName,
          explanation: data.similarity.similarityExplanation || ''
        });
      } else {
        setCustomRoles((prev) => [...prev, roleItem]);
        setSelected((prev) => (prev.includes(roleItem.id) ? prev : [...prev, roleItem.id]));
        setNewRoleName('');
        setNewRoleNote('');
      }
    } catch (err: any) {
      console.error('[GuidedStepCard] Error analyzing role:', err);
      // Fallback lokal jika request gagal
      const fallbackRole: CustomRoleItem = {
        id: trimmedName,
        label: trimmedName,
        description: newRoleNote
          ? `Bertanggung jawab atas: ${newRoleNote}`
          : `Menjalankan tugas operasional terkait ${trimmedName} dalam bisnis ini.`,
        responsibilities: newRoleNote
          ? [`Menjalankan tugas: ${newRoleNote}`, `Mencatat dan mengelola aktivitas harian ${trimmedName}`]
          : [`Mengkoordinasikan aktivitas ${trimmedName}`, 'Mencatat transaksi dan pelaporan operasional']
      };
      setCustomRoles((prev) => [...prev, fallbackRole]);
      setSelected((prev) => (prev.includes(fallbackRole.id) ? prev : [...prev, fallbackRole.id]));
      setNewRoleName('');
      setNewRoleNote('');
    } finally {
      setIsAnalyzingRole(false);
    }
  };

  // Handler inline edit peran
  const startEditingRole = (opt: GuidedStepOption, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRoleId(opt.id);
    setEditDescDraft(opt.description || '');
    setEditRespDraft((opt.responsibilities || []).join('\n'));
  };

  const saveEditedRole = (roleId: string, roleLabel: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanDesc = editDescDraft.trim();
    const cleanTasks = editRespDraft
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    setEditedRoles((prev) => ({
      ...prev,
      [roleId]: { description: cleanDesc, responsibilities: cleanTasks },
      [roleLabel]: { description: cleanDesc, responsibilities: cleanTasks }
    }));
    setEditingRoleId(null);
  };

  const cancelEditingRole = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRoleId(null);
  };

  const selectedLabels = allDisplayOptions
    .filter((o) => selected.includes(o.id))
    .map((o) => o.label);

  if (submitted) {
    const totalActiveModules = checklistGroups.reduce(
      (acc, g) => acc + g.items.filter((it) => it.checked).length,
      0
    );
    return (
      <div className="rounded-2xl border border-[#10f48e]/25 bg-[#10f48e]/5 p-3 text-[11px] text-zinc-300">
        <div className="flex items-center gap-1.5 text-[#10f48e] font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Jawaban tersimpan</span>
        </div>
        <p className="mt-1 text-zinc-400">
          {isChecklistStage
            ? `Checklist modul per peran tersimpan (${totalActiveModules} modul aktif)`
            : selectedLabels.join(', ') || other || '-'}
          {other && !isChecklistStage ? ` (+ ${other})` : ''}
        </p>
      </div>
    );
  }

  // Pisahkan opsi biasa dari opsi navigasi mundur ("Ada yang terlewat di langkah sebelumnya")
  const backNavOption = isBackNavCard
    ? undefined
    : payload.backNavOption || allDisplayOptions.find((o) => o.id === 'back_to_previous');

  const regularOptions = isBackNavCard
    ? allDisplayOptions.filter((o) => o.id !== 'back_to_previous')
    : allDisplayOptions.filter(
        (o) =>
          o.id !== 'back_to_previous' &&
          !o.id.startsWith('jump_step_') &&
          o.id !== 'cancel_back' &&
          !(isChecklistStage && o.id === 'confirm_role_modules')
      );

  // Jika kartu navigasi mundur tidak memiliki opsi yang valid, jangan render kartu kosong yang rusak
  if (isBackNavCard && regularOptions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0c11] p-3.5 space-y-3 shadow-inner">
      <div className="flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[#10f48e] shrink-0 mt-0.5" />
        <p className="text-[11.5px] font-semibold text-zinc-200 leading-relaxed">{payload.title}</p>
      </div>

      {payload.domainProfile && (
        <div className="my-1">
          <DomainMindMapCard
            profile={payload.domainProfile}
            domainTitle={
              session?.match?.businessCategory ||
              (session?.match?.templateId && !session.match.templateId.startsWith('MT-')
                ? session.match.templateId.replace(/_/g, ' ')
                : 'Domain Bisnis')
            }
          />
        </div>
      )}

      {/* Bagian Checklist Modul / Form Kerja per Role (Step RBAC: CHECKLIST Stage) */}
      {isChecklistStage && checklistGroups.length > 0 && (
        <div className="space-y-3 my-2">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-zinc-300 leading-relaxed flex items-start gap-2">
            <span className="text-[#10f48e] text-sm shrink-0">📋</span>
            <div>
              <span className="font-semibold text-zinc-200">Daftar Modul & Form Kerja per Peran:</span>
              <p className="text-[10px] text-zinc-400 mt-0.5">
                Modul dari alur kerja otomatis tercentang. Modul <span className="text-amber-400 font-medium">(disarankan)</span> adalah rekomendasi lazim industri. Anda dapat menyesuaikan centang atau menambah modul kustom.
              </p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto no-scrollbar pr-0.5">
            {checklistGroups.map((group) => {
              const activeCount = group.items.filter((it) => it.checked).length;
              const isAddingCustom = addingModuleForRole === group.role;

              return (
                <div
                  key={group.role}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2.5 hover:border-white/15 transition-all"
                >
                  {/* Header Role */}
                  <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-white/5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-bold text-zinc-100 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#10f48e]" />
                          {group.role}
                        </span>
                        <span className="text-[9.5px] font-medium text-zinc-400 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                          {activeCount}/{group.items.length} modul aktif
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* List Modul / Form Kerja */}
                  <div className="space-y-1.5">
                    {group.items.map((it) => {
                      const isChecked = Boolean(it.checked);
                      return (
                        <div
                          key={it.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleModuleCheck(group.role, it.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleModuleCheck(group.role, it.id);
                            }
                          }}
                          className={`w-full flex items-start gap-2.5 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-[#10f48e]/5 border-[#10f48e]/30 text-zinc-100'
                              : 'bg-black/20 border-white/5 text-zinc-400 hover:border-white/15'
                          }`}
                        >
                          <span className="mt-0.5 shrink-0">
                            {isChecked ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[#10f48e]" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-zinc-600" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[11px] font-medium leading-tight ${isChecked ? 'text-zinc-100' : 'text-zinc-400'}`}>
                                {it.nama}
                              </span>
                              {it.disarankan && (
                                <span className="text-[9px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.2 shrink-0">
                                  (disarankan)
                                </span>
                              )}
                              {it.termasukDiAlur && (
                                <span className="text-[9px] text-zinc-500 bg-white/5 border border-white/10 rounded px-1.5 py-0.2 shrink-0">
                                  Alur
                                </span>
                              )}
                              {it.isCustom && (
                                <span className="text-[9px] font-semibold text-[#10f48e] bg-[#10f48e]/10 border border-[#10f48e]/30 rounded px-1.5 py-0.2 shrink-0">
                                  (custom)
                                </span>
                              )}
                            </div>
                            {it.deskripsi && (
                              <p className="text-[9.5px] text-zinc-400 mt-0.5 leading-snug">
                                {it.deskripsi}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Form Tambah Modul / Form Kerja Custom */}
                  <div className="pt-1">
                    {!isAddingCustom ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAddingModuleForRole(group.role);
                          setCustomModuleName('');
                          setCustomModuleDesc('');
                        }}
                        disabled={disabled || submitted}
                        className="w-full py-1.5 px-2.5 rounded-lg border border-dashed border-white/15 hover:border-[#10f48e]/40 bg-white/[0.01] hover:bg-[#10f48e]/5 text-[10px] font-medium text-zinc-400 hover:text-[#10f48e] flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Plus className="w-3 h-3 text-[#10f48e]" />
                        <span>+ Tambah Modul/Form Custom</span>
                      </button>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-[#101016] border border-white/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-semibold text-[#10f48e] flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Tambah Modul ({group.role})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingModuleForRole(null);
                              setCustomModuleName('');
                              setCustomModuleDesc('');
                            }}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300"
                          >
                            Tutup
                          </button>
                        </div>

                        <div>
                          <label className="block text-[9.5px] text-zinc-400 mb-0.5">
                            Nama Modul / Form Kerja <span className="text-[#10f48e]">*</span>
                          </label>
                          <input
                            type="text"
                            value={customModuleName}
                            onChange={(e) => setCustomModuleName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddCustomModule(group.role);
                              }
                            }}
                            placeholder="Contoh: Form Pengembalian Barang, Audit Mutu..."
                            className="w-full bg-black/40 border border-white/15 focus:border-[#10f48e]/60 rounded-md px-2 py-1 text-[10.5px] text-zinc-100 placeholder-zinc-500 focus:outline-none"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className="block text-[9.5px] text-zinc-400 mb-0.5">
                            Deskripsi / Catatan <span className="text-zinc-500">(Opsional)</span>
                          </label>
                          <input
                            type="text"
                            value={customModuleDesc}
                            onChange={(e) => setCustomModuleDesc(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddCustomModule(group.role);
                              }
                            }}
                            placeholder="Opsional: wewenang atau cakupan tugas modul ini..."
                            className="w-full bg-black/40 border border-white/10 focus:border-[#10f48e]/50 rounded-md px-2 py-1 text-[10.5px] text-zinc-200 placeholder-zinc-600 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAddingModuleForRole(null);
                              setCustomModuleName('');
                              setCustomModuleDesc('');
                              setModuleMergeConfirmation(null);
                            }}
                            className="px-2 py-0.5 text-[9.5px] text-zinc-400 hover:text-zinc-200"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            disabled={!customModuleName.trim() || isAnalyzingModule}
                            onClick={() => handleAddCustomModule(group.role)}
                            className="px-2.5 py-0.5 text-[9.5px] bg-[#10f48e] disabled:bg-white/10 disabled:text-zinc-600 text-black font-semibold rounded hover:bg-[#0df28a] transition-colors flex items-center gap-1"
                          >
                            {isAnalyzingModule ? (
                              <>
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                Menganalisis AI...
                              </>
                            ) : (
                              'Tambah Modul'
                            )}
                          </button>
                        </div>

                        {/* Dialog Saran Penggabungan AI */}
                        {moduleMergeConfirmation && moduleMergeConfirmation.roleName === group.role && (
                          <div className="mt-2 p-3 rounded-xl bg-amber-500/5 border border-amber-400/30 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <GitMerge className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="text-[10.5px] font-semibold text-amber-300">
                                💡 Saran Penggabungan Form
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-300 leading-relaxed">
                              Fitur{' '}
                              <span className="font-semibold text-zinc-100">
                                &ldquo;{moduleMergeConfirmation.newModuleName}&rdquo;
                              </span>{' '}
                              terdeteksi lebih cocok digabungkan ke dalam{' '}
                              <span className="font-semibold text-amber-300">
                                {moduleMergeConfirmation.targetModuleName}
                              </span>
                              .
                            </p>
                            {moduleMergeConfirmation.mergeExplanation && (
                              <p className="text-[9.5px] text-zinc-400 leading-relaxed border-l-2 border-amber-400/40 pl-2">
                                {moduleMergeConfirmation.mergeExplanation}
                              </p>
                            )}
                            <div className="flex items-center gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={applyModuleMerge}
                                className="flex-1 py-1 px-2.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-[9.5px] font-semibold text-amber-300 transition-colors flex items-center justify-center gap-1"
                              >
                                <GitMerge className="w-2.5 h-2.5" />
                                Gabungkan ke {moduleMergeConfirmation.targetModuleName}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  addModuleAsStandalone(
                                    moduleMergeConfirmation.roleName,
                                    moduleMergeConfirmation.newModuleName,
                                    moduleMergeConfirmation.newModuleDesc
                                  )
                                }
                                className="flex-1 py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[9.5px] font-medium text-zinc-300 transition-colors flex items-center justify-center gap-1"
                              >
                                <Plus className="w-2.5 h-2.5" />
                                Tetap Buat Form Terpisah
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {regularOptions.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar pr-0.5">
        {regularOptions.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const needsInput = opt.requiresInput || /koreksi|adjust|clarify/i.test(opt.id);
          const isEditing = editingRoleId === opt.id;

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

                    {/* Tombol Edit Deskripsi (Bagian D - Berlaku HANYA untuk peran nyata di step ROLE, bukan tombol navigasi) */}
                    {payload.stepId === 'ROLE' &&
                      !isEditing &&
                      !/^(jump_step_|cancel_back|back_to_previous)/i.test(opt.id) &&
                      Boolean(opt.roleStatus || (opt.responsibilities && opt.responsibilities.length > 0)) && (
                        <button
                          type="button"
                          onClick={(e) => startEditingRole(opt, e)}
                          className="ml-auto inline-flex items-center gap-1 text-[9.5px] text-zinc-400 hover:text-[#10f48e] bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors"
                          title="Edit deskripsi & tanggung jawab peran ini"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          <span>Edit</span>
                        </button>
                    )}
                  </span>

                  {/* Form Inline Edit (Bagian D) */}
                  {isEditing ? (
                    <div
                      className="mt-2 pt-2 border-t border-white/15 space-y-2 w-full bg-black/40 p-2.5 rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] font-semibold text-[#10f48e] flex items-center gap-1">
                        <Pencil className="w-3 h-3" />
                        Edit Detail Peran: {opt.label}
                      </span>
                      <div>
                        <label className="block text-[9.5px] text-zinc-400 mb-0.5">Deskripsi Naratif:</label>
                        <textarea
                          value={editDescDraft}
                          onChange={(e) => setEditDescDraft(e.target.value)}
                          rows={2}
                          className="w-full bg-[#101016] border border-white/15 focus:border-[#10f48e]/60 rounded-md p-1.5 text-[10.5px] text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9.5px] text-zinc-400 mb-0.5">
                          Tanggung Jawab Utama (1 butir per baris):
                        </label>
                        <textarea
                          value={editRespDraft}
                          onChange={(e) => setEditRespDraft(e.target.value)}
                          rows={3}
                          className="w-full bg-[#101016] border border-white/15 focus:border-[#10f48e]/60 rounded-md p-1.5 text-[10.5px] text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none font-sans"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={cancelEditingRole}
                          className="px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 rounded"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={(e) => saveEditedRole(opt.id, opt.label, e)}
                          className="px-2.5 py-0.5 text-[10px] bg-[#10f48e] text-black font-semibold rounded hover:bg-[#0df28a] transition-colors"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {opt.description && (
                        <span className="block text-[10.5px] text-zinc-400 mt-1 leading-relaxed">
                          {opt.description}
                        </span>
                      )}
                      {opt.responsibilities && opt.responsibilities.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t border-white/5">
                          <span className="text-[9.5px] font-medium text-zinc-400 block mb-0.5">
                            Tanggung Jawab Utama:
                          </span>
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
                    </>
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
      )}

      {/* Bagian B: Modal / Box Konfirmasi Kemiripan Semantik */}
      {similarityConfirmation && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5 animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-zinc-200 leading-relaxed">
              <p className="font-semibold text-amber-300 mb-0.5">Konfirmasi Kemiripan Peran</p>
              <p>
                Peran <strong className="text-white">"{similarityConfirmation.newRole.label}"</strong> terdeteksi mirip dengan peran <strong className="text-[#10f48e]">"{similarityConfirmation.similarTo}"</strong> yang sudah ada di daftar.
              </p>
              {similarityConfirmation.explanation && (
                <p className="text-zinc-400 text-[10px] mt-1 italic">
                  * {similarityConfirmation.explanation}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-500/20">
            <button
              type="button"
              onClick={() => {
                // Gunakan similar role: centang role tersebut jika ada
                const targetOpt = allDisplayOptions.find(
                  (o) =>
                    o.label.toLowerCase() === similarityConfirmation.similarTo.toLowerCase() ||
                    o.id.toLowerCase() === similarityConfirmation.similarTo.toLowerCase()
                );
                if (targetOpt && !selected.includes(targetOpt.id)) {
                  setSelected((prev) => [...prev, targetOpt.id]);
                }
                setSimilarityConfirmation(null);
                setNewRoleName('');
                setNewRoleNote('');
              }}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-zinc-200 text-[10.5px] font-medium transition-colors"
            >
              Gunakan "{similarityConfirmation.similarTo}"
            </button>
            <button
              type="button"
              onClick={() => {
                // Tetap tambah terpisah
                const roleToAdd = similarityConfirmation.newRole;
                setCustomRoles((prev) => [...prev, roleToAdd]);
                setSelected((prev) => (prev.includes(roleToAdd.id) ? prev : [...prev, roleToAdd.id]));
                setSimilarityConfirmation(null);
                setNewRoleName('');
                setNewRoleNote('');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[10.5px] font-semibold transition-colors"
            >
              Tetap Tambah Terpisah
            </button>
          </div>
        </div>
      )}

      {/* Section Terpisah: Entitas Data (Non-Login) Khusus Step ROLE */}
      {payload.stepId === 'ROLE' && entities.length > 0 && (
        <div className="pt-2.5 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[11px] font-semibold text-zinc-300">
              Entitas Data (Non-Login)
            </span>
            <span className="text-[9.5px] text-zinc-500">
              Data dicatat & dikelola staf
            </span>
          </div>

          <div className="space-y-2">
            {entities.map((ent) => {
              const isEditing = editingEntityId === ent.id;

              return (
                <div
                  key={ent.id}
                  className="w-full flex flex-col gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.02] text-zinc-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[12px] font-semibold text-zinc-200">
                        {ent.name}
                      </span>
                      {!isEditing && (
                        <p className="text-[10.5px] text-zinc-400 mt-1 leading-relaxed">
                          {ent.description}
                        </p>
                      )}
                    </div>

                    {!isEditing && !disabled && (
                      <button
                        type="button"
                        onClick={(e) => startEditingEntity(ent, e)}
                        className="shrink-0 inline-flex items-center gap-1 text-[9.5px] text-zinc-400 hover:text-[#10f48e] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded transition-colors"
                        title="Koreksi detail atau promosikan jadi peran login"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  {/* Form Inline Edit Entitas Data */}
                  {isEditing && (
                    <div
                      className="mt-1 pt-2 border-t border-white/10 space-y-2 bg-black/40 p-2.5 rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] font-semibold text-[#10f48e] flex items-center gap-1">
                        <Pencil className="w-3 h-3" />
                        Edit Detail Entitas: {ent.name}
                      </span>

                      <div>
                        <label className="block text-[9.5px] text-zinc-400 mb-0.5">Nama Entitas:</label>
                        <input
                          type="text"
                          value={editEntityName}
                          onChange={(e) => setEditEntityName(e.target.value)}
                          className="w-full bg-[#101016] border border-white/15 focus:border-[#10f48e]/60 rounded-md p-1.5 text-[10.5px] text-zinc-100 placeholder-zinc-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[9.5px] text-zinc-400 mb-0.5">Deskripsi Peran di Alur Bisnis:</label>
                        <textarea
                          value={editEntityDesc}
                          onChange={(e) => setEditEntityDesc(e.target.value)}
                          rows={2}
                          className="w-full bg-[#101016] border border-white/15 focus:border-[#10f48e]/60 rounded-md p-1.5 text-[10.5px] text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 flex-wrap">
                        <button
                          type="button"
                          onClick={(e) => promoteEntityToLoginRole(ent, e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-medium rounded-lg transition-colors"
                          title="Promosikan entitas ini menjadi peran login mandiri"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                          <span>Promosikan Jadi Peran Login</span>
                        </button>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={cancelEditingEntity}
                            className="px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 rounded"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={(e) => saveEditedEntity(ent.id, e)}
                            className="px-2.5 py-1 text-[10px] bg-[#10f48e] text-black font-semibold rounded hover:bg-[#0df28a] transition-colors"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bagian A & C: Form Tambah Peran Kustom Khusus Step ROLE */}
      {payload.stepId === 'ROLE' && payload.allowOther && (
        <div className="pt-2 border-t border-white/10">
          {!showAddRoleForm ? (
            <button
              type="button"
              onClick={() => {
                setShowAddRoleForm(true);
                setAnalyzeError(null);
              }}
              disabled={disabled || isAnalyzingRole}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-white/20 hover:border-[#10f48e]/50 bg-white/[0.02] hover:bg-[#10f48e]/5 text-[11px] font-medium text-zinc-300 hover:text-[#10f48e] flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#10f48e]" />
              <span>+ Tambah Peran Baru (Custom)</span>
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/15 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#10f48e] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Tambah Peran Baru
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRoleForm(false);
                    setNewRoleName('');
                    setNewRoleNote('');
                    setAnalyzeError(null);
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  Tutup
                </button>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Nama Peran <span className="text-[#10f48e]">*</span>
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddRole();
                    }
                  }}
                  placeholder="Contoh: Pengepul, Admin Gudang, Teknisi..."
                  className="w-full bg-[#101016] border border-white/15 focus:border-[#10f48e]/60 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-500 focus:outline-none"
                  disabled={isAnalyzingRole}
                  autoFocus
                />
              </div>

              {/* Bagian C: Kolom Catatan Tambahan (Opsional) */}
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">
                  Catatan Tambahan <span className="text-zinc-500">(Opsional)</span>
                </label>
                <input
                  type="text"
                  value={newRoleNote}
                  onChange={(e) => setNewRoleNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddRole();
                    }
                  }}
                  placeholder="Opsional: kasih sedikit konteks kalau perlu (misal 'yang urus jadwal antar sopir')"
                  className="w-full bg-[#101016] border border-white/10 focus:border-[#10f48e]/50 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none"
                  disabled={isAnalyzingRole}
                />
              </div>

              {analyzeError && (
                <p className="text-[10px] text-red-400 leading-tight">{analyzeError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRoleForm(false);
                    setNewRoleName('');
                    setNewRoleNote('');
                    setAnalyzeError(null);
                  }}
                  className="px-2.5 py-1 text-[10.5px] text-zinc-400 hover:text-zinc-200"
                  disabled={isAnalyzingRole}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAddRole}
                  disabled={!newRoleName.trim() || isAnalyzingRole}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10f48e] text-black font-semibold rounded-lg text-[11px] hover:bg-[#0df28a] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isAnalyzingRole ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Menganalisis AI...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3" />
                      <span>Tambah Peran</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback allowOther untuk step SELAIN ROLE */}
      {payload.stepId !== 'ROLE' && payload.allowOther && (
        <div className="pt-2 border-t border-white/10 space-y-2">
          {!otherOpen ? (
            <button
              type="button"
              onClick={() => {
                setOtherOpen(true);
                if (!payload.multi) {
                  setSelected([]);
                }
              }}
              disabled={disabled}
              className="w-full py-2 px-3 rounded-xl border border-dashed border-white/20 hover:border-[#10f48e]/50 bg-white/[0.02] hover:bg-[#10f48e]/5 text-[11px] font-medium text-zinc-300 hover:text-[#10f48e] flex items-center justify-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-[#10f48e]" />
              <span>+ Lainnya (isi sendiri)</span>
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10.5px] font-semibold text-[#10f48e] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tulis arahan / kebutuhan lain:</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOtherOpen(false);
                    setOther('');
                    if (!payload.multi && initialSelected.length > 0) {
                      setSelected(initialSelected);
                    }
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Tutup
                </button>
              </div>

              <textarea
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="Contoh: Fokus pembelian saja dari sumber barang..."
                rows={3}
                className="w-full bg-[#101016] border border-white/15 focus:border-[#10f48e]/60 rounded-lg p-2.5 text-[11px] text-zinc-100 placeholder-zinc-500 focus:outline-none resize-none transition-colors"
                autoFocus
              />

              {other.trim().length === 0 && (
                <span className="text-[9.5px] text-amber-400/90 block">
                  * Tuliskan arahan Anda di atas sebelum melanjutkan
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tombol Navigasi Mundur ("Ada yang terlewat di langkah sebelumnya") - Terpisah secara visual & tanpa checkbox / tombol edit */}
      {backNavOption && (
        <div className="pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (disabled || submitted) return;
              setSubmitted(true);
              onSubmit(['back_to_previous']);
            }}
            disabled={disabled}
            className="w-full group flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-amber-500/25 hover:border-amber-400/50 bg-amber-500/[0.02] hover:bg-amber-500/[0.06] text-left transition-all active:scale-[0.99]"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="mt-0.5 p-1 rounded-md bg-amber-400/10 text-amber-400 group-hover:bg-amber-400/20 transition-colors shrink-0">
                <History className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <span className="block text-[11.5px] font-semibold text-zinc-200 group-hover:text-amber-300 transition-colors">
                  {backNavOption.label.replace(/^[⬅️↩️\s]+/, '')}
                </span>
                {backNavOption.description && (
                  <span className="block text-[10px] text-zinc-400 group-hover:text-zinc-300 transition-colors leading-relaxed mt-0.5">
                    {backNavOption.description}
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400/90 group-hover:text-black bg-amber-400/10 group-hover:bg-amber-400 border border-amber-400/20 group-hover:border-transparent px-2.5 py-1 rounded-lg transition-all">
              <span>Kembali</span>
              <ArrowLeft className="w-3 h-3" />
            </span>
          </button>
        </div>
      )}

      {/* Tombol Utama: User baru pindah ke step berikutnya saat secara eksplisit klik tombol ini */}
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
        {isBackNavCard
          ? 'Pilih Langkah'
          : isInputRequired
          ? 'Kirim Koreksi'
          : isChecklistStage
          ? 'Lanjut Susun Matriks Hak Akses (RBAC) →'
          : otherOpen && other.trim().length > 0
          ? 'Kirim Arahan'
          : 'Lanjut'}
      </button>
    </div>
  );
};
