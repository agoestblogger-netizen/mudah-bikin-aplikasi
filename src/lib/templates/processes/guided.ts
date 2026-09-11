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

export type { FeatureInfo };

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

  // Overlay industri dulu agar fitur khas industri lebih diutamakan,
  // baru fitur generik dari pola universal.
  overlays.forEach((o) => o.extraFeatures.forEach((f) => push({ ...f })));
  patterns.forEach((p) => p.features.forEach((f) => push({ ...f })));

  return Array.from(byId.values());
}

/**
 * Kelompok makna peran agar tidak ada duplikat seperti "Pelanggan" vs "Customer".
 * Urutan penting: kelompok yang lebih spesifik dicek lebih dulu.
 */
const ROLE_GROUPS: Array<{ key: string; re: RegExp }> = [
  { key: 'super-admin', re: /^super\s*admin$/i },
  { key: 'customer-service', re: /customer\s*(service|success)|cs\b/i },
  { key: 'front-office', re: /resepsionis|front\s*office|front\s*desk|loket|receptionist|petugas\s*loket/i },
  { key: 'cashier', re: /kasir|cashier/i },
  { key: 'warehouse', re: /gudang|warehouse|wh\s*staff|storekeeper/i },
  { key: 'finance', re: /finance|keuangan|akuntan|accountant|bendahara|penaksir|kolektor|bookkeeper|ar\/ap|\btax\b|auditor/i },
  { key: 'kitchen', re: /dapur|kitchen|koki|chef|barista/i },
  { key: 'waiter', re: /pelayan|waiter|waitress|pramusaji/i },
  { key: 'medical', re: /dokter|doctor|perawat|nurse|bidan|apoteker|pharmacist|farmasi|terapis|trainer|fisioterapi|rekam\s*medis|medical\s*record/i },
  { key: 'teacher', re: /guru|teacher|pengajar|tutor|instruktur|principal|kepala\s*sekolah|homeroom/i },
  { key: 'technician', re: /mekanik|montir|teknisi|operator|service\s*advisor|maintenance/i },
  { key: 'driver', re: /kurir|driver|sopir/i },
  { key: 'adjuster', re: /adjuster|investigator|investigasi/i },
  { key: 'consultant', re: /konsultan|consultant/i },
  { key: 'rental-staff', re: /petugas\s*rental|petugas\s*sewa|staf\s*rental|staf\s*sewa/i },
  { key: 'service-staff', re: /service\s*staff|staff\s*layanan|petugas\s*layanan|staf\s*layanan/i },
  { key: 'customer', re: /pelanggan|customer|pembeli|buyer|klien|client|pasien|patient|siswa|student|murid|warga|tamu|guest|member|subscriber|penyewa|tenant|penerima\s*manfaat|pemohon|penumpang|participant|peserta|orang\s*tua|\bparent\b/i },
  { key: 'owner', re: /owner|pemilik|pengurus|direktur|director|partner|founder|foundation|yayasan/i },
  { key: 'manager', re: /manager|manajer|supervisor|pengawas|kepala|principal/i },
  { key: 'admin-staff', re: /\badmin\b|administrator/i },
];

const GENERIC_ROLE_RE = /^(staff|staf|user|pengguna)$/i;

/**
 * Padanan Indonesia untuk label peran bawaan Master Template (bahasa Inggris).
 * Hanya berlaku persis sama; label overlay industri selalu diutamakan.
 */
const EN_ROLE_LABEL_MAP: Record<string, string> = {
  customer: 'Pelanggan',
  cashier: 'Kasir',
  warehouse: 'Gudang',
  'wh staff': 'Gudang',
  owner: 'Pemilik',
  manager: 'Manajer',
  receptionist: 'Resepsionis',
  employee: 'Karyawan',
  bookkeeper: 'Pembukuan'
};

export function canonicalRoleKey(role: string): string {
  const clean = role.trim();
  for (const group of ROLE_GROUPS) {
    if (group.re.test(clean)) return group.key;
  }
  return clean.toLowerCase();
}

/**
 * Dedupe label peran berdasarkan makna, mempertahankan urutan kemunculan pertama.
 * Super Admin selalu dipertahankan paling depan.
 */
export function dedupeRoleLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels) {
    const clean = label.trim();
    if (!clean) continue;
    const key = canonicalRoleKey(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result.sort((a, b) => {
    if (canonicalRoleKey(a) === 'super-admin') return -1;
    if (canonicalRoleKey(b) === 'super-admin') return 1;
    return 0;
  });
}

export function findFeatureInfo(session: MockupSessionState, featureId: string): FeatureInfo | undefined {
  return collectFeatures(session).find((f) => f.id === featureId);
}

export function listSessionFeatures(session: MockupSessionState): FeatureInfo[] {
  return collectFeatures(session);
}

function cleanStopWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !/^(yang|dan|atau|dengan|untuk|pada|dari|saat|dalam|tidak|sering|sulit|bisa|adalah)$/.test(w)
    );
}

function isSimilarOptionLabel(a: string, b: string): boolean {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true;
  const wordsA = new Set(cleanStopWords(a));
  const wordsB = cleanStopWords(b);
  if (wordsA.size === 0 || wordsB.length === 0) return false;
  let matches = 0;
  for (const w of wordsB) {
    if (wordsA.has(w)) matches++;
  }
  return matches >= 3 || (matches >= 2 && matches / Math.min(wordsA.size, wordsB.length) >= 0.6);
}

function dedupeOptions(options: GuidedStepOption[]): GuidedStepOption[] {
  const seenId = new Set<string>();
  const seenLabel = new Set<string>();
  const result: GuidedStepOption[] = [];
  for (const opt of options) {
    const labelKey = opt.label.trim().toLowerCase();
    if (seenId.has(opt.id) || seenLabel.has(labelKey)) continue;
    const isDuplicate = result.some((existing) => isSimilarOptionLabel(existing.label, opt.label));
    if (isDuplicate) continue;
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

  // 1. Masalah kontekstual hasil pemetaan AI cerdas (diposisikan paling atas)
  if (session.match.contextualPainPoints && session.match.contextualPainPoints.length > 0) {
    session.match.contextualPainPoints.forEach((p, idx) => {
      options.push({
        id: `ctx-p-${idx}`,
        label: p,
        recommended: true,
        description: session.match.businessCategory || 'Spesifik Kebutuhan Anda'
      });
    });
  }

  // 2. Masalah dari overlay industri
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

  // 3. Masalah dari pola universal (hanya jika opsi masih sedikit)
  if (options.length < 4) {
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
  }

  return {
    stepId: 'PAIN',
    title: 'Masalah utama apa yang mau diselesaikan? (boleh pilih lebih dari satu)',
    multi: true,
    allowOther: true,
    options: dedupeOptions(options).slice(0, 14)
  };
}

function isExternalRole(label: string): boolean {
  return canonicalRoleKey(label) === 'customer';
}

function buildRolesStep(session: MockupSessionState): GuidedStepPayload {
  const patterns = getProcessPatternsByIds(session.match.patternIds);
  const overlays = getIndustryOverlaysByIds(session.match.overlayIds);
  const template = session.match.templateId ? getMasterTemplateById(session.match.templateId) : undefined;

  const seen = new Set<string>([canonicalRoleKey(REQUIRED_ROLE)]);
  const options: GuidedStepOption[] = [];

  const addRole = (label: string, source: string, recommended?: boolean) => {
    const clean = label.trim();
    if (!clean || GENERIC_ROLE_RE.test(clean)) return;
    const key = canonicalRoleKey(clean);
    if (seen.has(key)) return;
    seen.add(key);
    const display = EN_ROLE_LABEL_MAP[clean.toLowerCase()] || clean;
    options.push({
      id: display,
      label: display,
      recommended: recommended ?? !isExternalRole(display),
      description: source
    });
  };

  // 1. Peran kontekstual dari hasil pemetaan AI cerdas (diposisikan paling atas)
  if (session.match.contextualRoles && session.match.contextualRoles.length > 0) {
    session.match.contextualRoles.forEach((role) =>
      addRole(role, session.match.businessCategory || 'Spesifik Kebutuhan Anda', true)
    );
  }

  // 2. Prioritas utama: peran khas industri dari overlay yang terdeteksi.
  //    Semua roleLabels overlay dianggap disarankan (termasuk peran pelanggan/penyewa)
  //    karena sudah dikurasi khusus untuk industri tersebut.
  overlays.forEach((o) => o.roleLabels.forEach((role) => addRole(role, o.nama, true)));

  // 3. Pelengkap: peran dari Master Template (mis. Petugas Sewa / Penyewa untuk MT-21).
  if (template) {
    template.roleDefault.forEach((role) => addRole(role, template.nama));
  }

  // 4. Fallback: aktor pola universal HANYA jika total peran masih kurang dari 2.
  if (options.length < 2) {
    patterns.forEach((p) =>
      p.actors.forEach((a) => addRole(a.role, p.nama, a.category !== 'external'))
    );
  }

  return {
    stepId: 'ROLES',
    title: 'Siapa saja yang akan memakai aplikasi ini? (boleh pilih lebih dari satu)',
    multi: true,
    allowOther: true,
    options: [
      {
        id: REQUIRED_ROLE,
        label: REQUIRED_ROLE,
        description: 'Kelola akun staf, role & permission, konfigurasi sistem',
        recommended: true
      },
      ...options.slice(0, 13)
    ]
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
      description: f.severity === 'core' ? 'Fitur inti (disarankan)' : `Kompleksitas: ${f.complexity}`
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
      description: f.severity === 'core' ? 'Fitur inti (disarankan)' : 'Boleh menyusul'
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
    const roles = dedupeRoleLabels(selected.length > 0 ? selected : [REQUIRED_ROLE]);
    next.roles = { selected: roles, ...(other ? { other } : {}) };
  } else if (stepId === 'FLOW') {
    next.flow = { ...(selected[0] ? { selectedId: selected[0] } : {}), ...(other ? { other } : {}) };
  } else if (stepId === 'FEATURES') {
    const featureIds = selected.length > 0 ? selected : collectFeatures(next).filter((f) => f.severity === 'core').map((f) => f.id);
    next.features = {
      selected: featureIds.map((id) => ({ id, priority: 'WAJIB' as const })),
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
 * Gate proses: validasi kelengkapan data sebelum build.
 */
export function isBriefBusinessComplete(session: MockupSessionState): BriefCompleteness {
  const missing: string[] = [];
  if (!session.roles.selected || session.roles.selected.length === 0) {
    missing.push('Minimal 1 peran aplikasi dipilih');
  }
  if (!session.flow.selectedId) {
    missing.push('Alur kerja utama belum dipilih');
  }
  if (!session.features.selected || session.features.selected.length === 0) {
    missing.push('Minimal 1 fitur aplikasi dipilih');
  }

  return {
    complete: missing.length === 0,
    missing
  };
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
