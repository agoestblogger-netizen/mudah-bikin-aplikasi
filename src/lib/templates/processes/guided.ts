import {
  getProcessPatternsByIds,
  getIndustryOverlaysByIds,
  buildBusinessProcessChecklist
} from './registry';
import { getMasterTemplateById } from '../masterTemplates';
import type {
  GuidedStepOption,
  GuidedStepPayload,
  GuidedStepId,
  MockupSessionState,
  SessionStep
} from './types';

/**
 * Logika sesi mockup terpandu (Batch 6).
 * Murni deterministik dari repository; narasi AI ditambahkan di route.
 */

export const REQUIRED_ROLE = 'Super Admin';

export const SESSION_STEP_ORDER: SessionStep[] = [
  'PAIN',
  'ROLES',
  'FLOW',
  'FEATURES',
  'PRIORITY',
  'BRIEF_REVIEW'
];

export function nextSessionStep(step: GuidedStepId | SessionStep): SessionStep {
  const idx = SESSION_STEP_ORDER.indexOf(step as SessionStep);
  if (idx < 0) return 'PAIN';
  return SESSION_STEP_ORDER[Math.min(idx + 1, SESSION_STEP_ORDER.length - 1)];
}

interface FeatureInfo {
  id: string;
  label: string;
  severity: 'core' | 'advisory';
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

function collectFeatures(session: MockupSessionState): FeatureInfo[] {
  const patterns = getProcessPatternsByIds(session.match.patternIds);
  const overlays = getIndustryOverlaysByIds(session.match.overlayIds);
  const byId = new Map<string, FeatureInfo>();
  const byLabel = new Set<string>();

  const push = (f: FeatureInfo) => {
    const key = f.label.trim().toLowerCase();
    if (byId.has(f.id) || byLabel.has(key)) return;
    byId.set(f.id, f);
    byLabel.add(key);
  };

  patterns.forEach((p) => p.features.forEach((f) => push({ ...f })));
  overlays.forEach((o) => o.extraFeatures.forEach((f) => push({ ...f })));

  return Array.from(byId.values());
}

export function findFeatureInfo(session: MockupSessionState, featureId: string): FeatureInfo | undefined {
  return collectFeatures(session).find((f) => f.id === featureId);
}

function dedupeOptions(options: GuidedStepOption[]): GuidedStepOption[] {
  const seenId = new Set<string>();
  const seenLabel = new Set<string>();
  const result: GuidedStepOption[] = [];
  for (const opt of options) {
    const labelKey = opt.label.trim().toLowerCase();
    if (seenId.has(opt.id) || seenLabel.has(labelKey)) continue;
    seenId.add(opt.id);
    seenLabel.add(labelKey);
    result.push(opt);
  }
  return result;
}

function buildPainStep(session: MockupSessionState): GuidedStepPayload {
  const patterns = getProcessPatternsByIds(session.match.patternIds);
  const overlays = getIndustryOverlaysByIds(session.match.overlayIds);
  const options: GuidedStepOption[] = [];

  overlays.forEach((o) =>
    o.painPoints.forEach((p) =>
      options.push({
        id: p.id,
        label: p.label,
        recommended: p.severity === 'core',
        description: o.nama
      })
    )
  );
  patterns.forEach((p) =>
    p.painPoints.forEach((pp) =>
      options.push({
        id: pp.id,
        label: pp.label,
        recommended: pp.severity === 'core',
        description: p.nama
      })
    )
  );

  return {
    stepId: 'PAIN',
    title: 'Masalah utama apa yang mau diselesaikan? (boleh pilih lebih dari satu)',
    multi: true,
    allowOther: true,
    options: dedupeOptions(options).slice(0, 14)
  };
}

function buildRolesStep(session: MockupSessionState): GuidedStepPayload {
  const patterns = getProcessPatternsByIds(session.match.patternIds);
  const overlays = getIndustryOverlaysByIds(session.match.overlayIds);
  const options: GuidedStepOption[] = [
    {
      id: REQUIRED_ROLE,
      label: REQUIRED_ROLE,
      description: 'Kelola akun staf, role & permission, konfigurasi sistem',
      locked: true,
      recommended: true
    }
  ];

  overlays.forEach((o) =>
    o.roleLabels.forEach((role) =>
      options.push({
        id: role,
        label: role,
        recommended: !/pelanggan|pembeli|pasien|siswa|warga|donatur|penyewa|tamu|member|subscriber|penerima/i.test(role),
        description: o.nama
      })
    )
  );
  patterns.forEach((p) =>
    p.actors.forEach((a) =>
      options.push({
        id: a.role,
        label: a.role,
        recommended: a.category !== 'external',
        description: p.nama
      })
    )
  );

  // Peran dari Master Template (mis. Petugas Sewa / Penyewa untuk MT-21)
  const template = session.match.templateId ? getMasterTemplateById(session.match.templateId) : undefined;
  if (template) {
    template.roleDefault
      .filter((role) => !/^(?:owner|manager|admin)$/i.test(role.trim()))
      .forEach((role) =>
        options.push({
          id: role,
          label: role,
          recommended: !/pelanggan|pembeli|pasien|siswa|warga|donatur|penyewa|tamu|member|subscriber|penerima/i.test(role),
          description: template.nama
        })
      );
  }

  return {
    stepId: 'ROLES',
    title: 'Siapa saja yang akan memakai aplikasi ini? (boleh pilih lebih dari satu)',
    multi: true,
    allowOther: true,
    options: dedupeOptions(options).slice(0, 14)
  };
}

function buildFlowStep(session: MockupSessionState): GuidedStepPayload {
  const patterns = getProcessPatternsByIds(session.match.patternIds);
  const options: GuidedStepOption[] = [];

  patterns.forEach((p) =>
    p.flowVariants.forEach((v, idx) =>
      options.push({
        id: v.id,
        label: v.label,
        description: `${p.nama}: ${v.summary}`,
        recommended: idx === 0
      })
    )
  );

  return {
    stepId: 'FLOW',
    title: 'Alur kerja sekarang paling mendekati yang mana?',
    multi: false,
    allowOther: true,
    options: dedupeOptions(options).slice(0, 10)
  };
}

function buildFeaturesStep(session: MockupSessionState): GuidedStepPayload {
  const features = collectFeatures(session);
  return {
    stepId: 'FEATURES',
    title: 'Fitur apa saja yang dibutuhkan? (centang semua yang perlu)',
    multi: true,
    allowOther: true,
    options: features.map((f) => ({
      id: f.id,
      label: f.label,
      recommended: f.severity === 'core',
      description: `Kompleksitas: ${f.complexity}`
    }))
  };
}

function buildPriorityStep(session: MockupSessionState): GuidedStepPayload {
  const features = collectFeatures(session);
  const selectedIds = session.features.selected.map((f) => f.id);
  const selected = features.filter((f) => selectedIds.includes(f.id));
  return {
    stepId: 'PRIORITY',
    title: 'Dari fitur yang dipilih, mana yang wajib ada sekarang? (yang tidak dicentang masuk V2)',
    multi: true,
    allowOther: false,
    options: selected.map((f) => ({
      id: f.id,
      label: f.label,
      recommended: f.severity === 'core',
      description: f.severity === 'core' ? 'Disarankan Wajib' : 'Boleh menyusul'
    }))
  };
}

export function buildGuidedStep(session: MockupSessionState): GuidedStepPayload | null {
  switch (session.step) {
    case 'PAIN':
      return buildPainStep(session);
    case 'ROLES':
      return buildRolesStep(session);
    case 'FLOW':
      return buildFlowStep(session);
    case 'FEATURES':
      return buildFeaturesStep(session);
    case 'PRIORITY':
      return buildPriorityStep(session);
    default:
      return null;
  }
}

/**
 * Gabungkan jawaban user ke session dan majukan langkah.
 */
export function applyGuidedAnswer(
  session: MockupSessionState,
  stepId: GuidedStepId,
  selected: string[],
  other?: string
): MockupSessionState {
  const next: MockupSessionState = JSON.parse(JSON.stringify(session));

  if (stepId === 'PAIN') {
    next.painPoints = { selected: [...selected], ...(other ? { other } : {}) };
  } else if (stepId === 'ROLES') {
    const roles = [REQUIRED_ROLE, ...selected.filter((r) => r !== REQUIRED_ROLE)];
    next.roles = { selected: Array.from(new Set(roles)), ...(other ? { other } : {}) };
  } else if (stepId === 'FLOW') {
    next.flow = { ...(selected[0] ? { selectedId: selected[0] } : {}), ...(other ? { other } : {}) };
  } else if (stepId === 'FEATURES') {
    next.features = {
      selected: selected.map((id) => ({ id, priority: 'WAJIB' as const })),
      ...(other ? { other } : {})
    };
  } else if (stepId === 'PRIORITY') {
    const wajib = new Set(selected);
    next.features = {
      ...next.features,
      selected: next.features.selected.map((f) => ({
        id: f.id,
        priority: wajib.has(f.id) ? 'WAJIB' : 'NYUSUL'
      }))
    };
  }

  next.step = nextSessionStep(stepId);
  return next;
}

export interface BriefCompleteness {
  complete: boolean;
  missing: string[];
}

/**
 * Gate proses inti: semua fitur core & Super Admin harus ada sebelum build.
 */
export function isBriefBusinessComplete(session: MockupSessionState): BriefCompleteness {
  const missing: string[] = [];
  const checklist = buildBusinessProcessChecklist(
    session.match.patternIds,
    session.match.overlayIds,
    session.match.templateId
  );
  const features = collectFeatures(session);
  const selectedWajib = new Set(
    session.features.selected.filter((f) => f.priority === 'WAJIB').map((f) => f.id)
  );

  if (!session.roles.selected.includes(REQUIRED_ROLE)) {
    missing.push('Peran Super Admin wajib ada');
  }
  if (session.roles.selected.filter((r) => r !== REQUIRED_ROLE).length === 0) {
    missing.push('Minimal 1 peran operasional/pengguna');
  }
  if (!session.flow.selectedId) {
    missing.push('Alur kerja utama belum dipilih');
  }

  const coreFeatures = features.filter((f) => f.severity === 'core');
  for (const f of coreFeatures) {
    if (!selectedWajib.has(f.id)) missing.push(`Fitur inti "${f.label}" wajib ada (Wajib)`);
  }

  for (const label of checklist.coreRules) {
    // Aturan inti tidak bisa dimatikan; hanya dicatat bila fitur intinya hilang.
    void label;
  }

  return { complete: missing.length === 0, missing };
}

export interface BriefMeta {
  appName?: string;
  templateName?: string;
}

/**
 * Rakit Brief Kebutuhan deterministik dari jawaban sesi.
 * Narasi AI ditambahkan terpisah (tetap terikat jawaban).
 */
export function compileBriefFromSession(
  session: MockupSessionState,
  meta: BriefMeta = {}
): string {
  const patterns = getProcessPatternsByIds(session.match.patternIds);
  const overlays = getIndustryOverlaysByIds(session.match.overlayIds);
  const checklist = buildBusinessProcessChecklist(
    session.match.patternIds,
    session.match.overlayIds,
    session.match.templateId
  );
  const features = collectFeatures(session);
  const wajib = session.features.selected.filter((f) => f.priority === 'WAJIB');
  const nyusul = session.features.selected.filter((f) => f.priority === 'NYUSUL');

  const appName =
    (meta.appName && meta.appName.trim()) ||
    (overlays[0] ? `Aplikasi ${overlays[0].nama}` : meta.templateName ? `Aplikasi ${meta.templateName}` : 'Aplikasi Baru');

  const tierLabel = session.match.tier === 'ADVANCE' ? 'ADVANCE' : 'BASIC';

  const stateLabels: string[] = [];
  patterns.forEach((p) => p.stages.slice(0, 6).forEach((s) => stateLabels.push(s.label)));
  const uniqueStates = Array.from(new Set(stateLabels));

  const lines: string[] = [];
  lines.push('📋 **Brief Kebutuhan**');
  lines.push(`- **Nama App**: ${appName}`);
  lines.push('- **Orientasi UI**: Responsif, mobile-friendly');
  lines.push(`- **Tier Aplikasi**: ${tierLabel}`);
  if (patterns.length) {
    lines.push(`- **Pola Proses Bisnis**: ${patterns.map((p) => `${p.id} ${p.nama}`).join(', ')}`);
  }
  if (overlays.length) {
    lines.push(`- **Kekhasan Industri**: ${overlays.map((o) => o.nama).join(', ')}`);
  }

  const entityNames = Array.from(
    new Set([
      ...patterns.flatMap((p) => p.entities.map((e) => e.name)),
      ...overlays.flatMap((o) => o.extraEntities.map((e) => e.name))
    ])
  );
  if (entityNames.length) {
    lines.push(`- **Entitas Data**: ${entityNames.join(', ')}`);
  }
  if (uniqueStates.length) {
    lines.push(`- **State Utama**: ${uniqueStates.join(' -> ')}`);
  }

  if (checklist.coreTransitions.length) {
    lines.push('- **Transisi Inti (WAJIB)**:');
    checklist.coreTransitions.forEach((t, i) => lines.push(`  ${i + 1}. ${t}`));
  }
  if (checklist.coreRules.length) {
    lines.push('- **Aturan Bisnis Inti (WAJIB)**:');
    checklist.coreRules.forEach((r) => lines.push(`  - ${r}`));
  }
  if (checklist.coreEdgeCases.length) {
    lines.push(`- **Edge Case Inti**: ${checklist.coreEdgeCases.join('; ')}`);
  }
  if (checklist.coreItems.length) {
    lines.push(`- **Komponen Wajib Industri**: ${checklist.coreItems.join('; ')}`);
  }
  if (checklist.advisoryItems.length) {
    lines.push(`- **Saran (opsional)**: ${checklist.advisoryItems.join('; ')}`);
  }

  if (wajib.length) {
    lines.push('- **Fitur Utama (V1)**:');
    wajib.forEach((f, i) => {
      const info = features.find((x) => x.id === f.id);
      lines.push(`  ${i + 1}. ${info?.label ?? f.id}`);
    });
  }
  if (nyusul.length) {
    lines.push('- **Fitur Menyusul (V2)**:');
    nyusul.forEach((f) => {
      const info = features.find((x) => x.id === f.id);
      lines.push(`  - ${info?.label ?? f.id}`);
    });
  }

  const roles = session.roles.selected;
  if (roles.length) {
    lines.push('- **Job Description & Struktur Halaman per Role**:');
    for (const role of roles) {
      lines.push(`  * **${role}**:`);
      if (role === REQUIRED_ROLE) {
        lines.push('    - Manajemen Sistem (default): section Akun Staf, section Role & Permission, section Audit Log');
        lines.push('      * Field Input:');
        lines.push('        - [x] Nama / Email Staf (Text)');
        lines.push('        - [x] Role dan Permission (Select)');
        lines.push('      * Action / Event:');
        lines.push('        - [x] onclick: Tambah Akun Staf (Membuat akun staf baru)');
        lines.push('        - [x] onclick: Atur Role & Permission (Mengubah hak akses staf)');
      } else {
        const roleFeatures = wajib
          .map((f) => features.find((x) => x.id === f.id)?.label)
          .filter(Boolean)
          .slice(0, 5);
        const sectionText = roleFeatures.length
          ? `: section ${roleFeatures.join(', section ')}`
          : '';
        lines.push(`    - Halaman Utama (default)${sectionText}`);
      }
    }
  }

  const notes: string[] = [];
  if (session.painPoints.selected.length) {
    notes.push(`Masalah yang diselesaikan: ${session.painPoints.selected.length} poin terpilih`);
  }
  if (session.painPoints.other) notes.push(`Catatan pain point: ${session.painPoints.other}`);
  if (session.roles.other) notes.push(`Peran tambahan: ${session.roles.other}`);
  if (session.flow.other) notes.push(`Alur tambahan: ${session.flow.other}`);
  if (session.features.other) notes.push(`Fitur tambahan: ${session.features.other}`);
  if (notes.length) {
    lines.push('- **Catatan Tambahan**:');
    notes.forEach((n) => lines.push(`  - ${n}`));
  }

  return lines.join('\n');
}
