import { PROCESS_PATTERNS } from './patterns';
import { INDUSTRY_OVERLAYS } from './industries';
import { TEMPLATE_PROCESS_MAP } from './templateProcessMap';
import {
  ADVANCE_ROLE_THRESHOLD,
  type BusinessTier,
  type IndustryOverlay,
  type ProcessPattern,
  type TemplateProcessMap
} from './types';

/**
 * Registry repository proses bisnis.
 * Batch 1: lookup pola + deteksi tier.
 * Batch 6: deteksi overlay + formatter prompt/checklist.
 */

export function getProcessPatternById(id: string): ProcessPattern | undefined {
  return PROCESS_PATTERNS.find((p) => p.id === id);
}

export function getProcessPatternsByIds(ids: string[]): ProcessPattern[] {
  return ids
    .map((id) => getProcessPatternById(id))
    .filter((p): p is ProcessPattern => Boolean(p));
}

export function getIndustryOverlayById(id: string): IndustryOverlay | undefined {
  return INDUSTRY_OVERLAYS.find((o) => o.id === id);
}

export function getIndustryOverlaysByIds(ids: string[]): IndustryOverlay[] {
  return ids
    .map((id) => getIndustryOverlayById(id))
    .filter((o): o is IndustryOverlay => Boolean(o));
}

export function getTemplateProcessMap(templateId: string): TemplateProcessMap | undefined {
  return TEMPLATE_PROCESS_MAP.find((m) => m.templateId === templateId);
}

/**
 * Deteksi overlay industri dari teks bebas, diurutkan berdasarkan jumlah keyword cocok.
 */
export function detectIndustryOverlays(text: string): IndustryOverlay[] {
  const lower = (text || '').toLowerCase();
  if (!lower) return [];

  return INDUSTRY_OVERLAYS
    .map((overlay) => ({
      overlay,
      score: overlay.keywords.filter((k) => lower.includes(k.toLowerCase())).length
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.overlay);
}

export interface TierDetectionInput {
  patternIds: string[];
  roleCount?: number;
  selectedFeatureIds?: string[];
}

export interface TierDetectionResult {
  tier: BusinessTier;
  reasons: string[];
}

/**
 * Aturan tier (disepakati):
 * ADVANCE jika salah satu terpenuhi:
 * - memakai >1 pola universal
 * - jumlah peran >= ADVANCE_ROLE_THRESHOLD
 * - punya alur approval/persetujuan inti
 * - >= 2 fitur kompleks (HIGH) yang menandai tier terpilih
 */
export function detectTier(input: TierDetectionInput): TierDetectionResult {
  const patterns = getProcessPatternsByIds(input.patternIds);
  const reasons: string[] = [];

  if (patterns.length > 1) {
    reasons.push(`Menggunakan ${patterns.length} pola proses bisnis`);
  }

  if (input.roleCount !== undefined && input.roleCount >= ADVANCE_ROLE_THRESHOLD) {
    reasons.push(`Melibatkan ${input.roleCount} peran`);
  }

  const hasApprovalChain = patterns.some(
    (p) =>
      p.businessRules.some((r) => r.type === 'approval' && r.severity === 'core') ||
      p.tierSignals.some((t) => /approval|persetujuan|berjenjang/i.test(t.label))
  );
  if (hasApprovalChain) {
    reasons.push('Memiliki alur persetujuan/approval');
  }

  if (input.selectedFeatureIds && input.selectedFeatureIds.length > 0) {
    const selected = new Set(input.selectedFeatureIds);
    const complexCount = patterns
      .flatMap((p) => p.features)
      .filter((f) => selected.has(f.id) && f.countsForTier && f.complexity === 'HIGH')
      .length;
    if (complexCount >= 2) {
      reasons.push(`${complexCount} fitur kompleks terpilih`);
    }
  }

  return { tier: reasons.length > 0 ? 'ADVANCE' : 'BASIC', reasons };
}

/**
 * Ringkasan satu pola universal untuk disuntikkan ke prompt AI.
 */
export function formatProcessPatternForIdeation(pattern: ProcessPattern): string {
  const lines: string[] = [];
  lines.push(`${pattern.id} ${pattern.nama} — ${pattern.tujuan}`);
  lines.push(`  Entitas: ${pattern.entities.map((e) => e.name).join(', ')}`);
  lines.push(`  Tahapan: ${pattern.stages.map((s) => s.label).join(' -> ')}`);
  lines.push(`  Aktor: ${pattern.actors.map((a) => a.role).join(', ')}`);

  const coreRules = pattern.businessRules.filter((r) => r.severity === 'core');
  if (coreRules.length) {
    lines.push(`  Aturan Inti: ${coreRules.map((r) => r.label).join('; ')}`);
  }
  const coreEdges = pattern.edgeCases.filter((e) => e.severity === 'core');
  if (coreEdges.length) {
    lines.push(`  Edge Case Inti: ${coreEdges.map((e) => `${e.scenario} -> ${e.handling}`).join('; ')}`);
  }
  const coreFeatures = pattern.features.filter((f) => f.severity === 'core');
  if (coreFeatures.length) {
    lines.push(`  Fitur Inti: ${coreFeatures.map((f) => f.label).join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Ringkasan satu overlay industri untuk disuntikkan ke prompt AI.
 */
export function formatIndustryOverlayForIdeation(overlay: IndustryOverlay): string {
  const lines: string[] = [];
  lines.push(`${overlay.id} ${overlay.nama}`);
  if (overlay.patternIds.length) {
    lines.push(`  Pola relevan: ${overlay.patternIds.join(', ')}`);
  }
  if (overlay.extraEntities.length) {
    lines.push(`  Entitas tambahan: ${overlay.extraEntities.map((e) => e.name).join(', ')}`);
  }
  if (overlay.notes.length) {
    lines.push(`  Catatan khas: ${overlay.notes.join('; ')}`);
  }
  if (overlay.coreItems.length) {
    lines.push(`  Wajib ada: ${overlay.coreItems.join('; ')}`);
  }
  return lines.join('\n');
}

/**
 * Gabungan konteks proses bisnis (pola + overlay) untuk prompt AI.
 */
export function formatBusinessProcessForIdeation(
  patternIds: string[],
  overlayIds: string[] = []
): string {
  const patterns = getProcessPatternsByIds(patternIds);
  const overlays = getIndustryOverlaysByIds(overlayIds);
  if (patterns.length === 0 && overlays.length === 0) return '';

  const sections: string[] = [];
  if (patterns.length) {
    sections.push(
      '=== POLA PROSES BISNIS UNIVERSAL (SUMBER KEBENARAN) ===\n' +
        patterns.map(formatProcessPatternForIdeation).join('\n')
    );
  }
  if (overlays.length) {
    sections.push(
      '=== KEKHASAN INDUSTRI (OVERLAY) ===\n' +
        overlays.map(formatIndustryOverlayForIdeation).join('\n')
    );
  }
  sections.push(
    'ATURAN PROSES: Pastikan brief memuat peran, entitas, tahapan, aturan inti, dan edge case inti di atas. ' +
      'Jangan menghilangkan langkah penting (mis. pengembalian, pembayaran, persetujuan) hanya karena pengguna tidak menyebutkannya.'
  );
  return sections.join('\n\n');
}

export interface BusinessProcessChecklist {
  coreTransitions: string[];
  coreRules: string[];
  coreEdgeCases: string[];
  coreFeatures: string[];
  coreItems: string[];
  advisoryItems: string[];
  roles: string[];
}

/**
 * Checklist core/advisory dari pola + overlay (+ coreTransitions template), dipakai brief editor & gate.
 */
export function buildBusinessProcessChecklist(
  patternIds: string[],
  overlayIds: string[] = [],
  templateId?: string
): BusinessProcessChecklist {
  const patterns = getProcessPatternsByIds(patternIds);
  const overlays = getIndustryOverlaysByIds(overlayIds);
  const templateMap = templateId ? getTemplateProcessMap(templateId) : undefined;

  const coreTransitions = patterns.flatMap((p) =>
    p.flowVariants[0] ? p.flowVariants[0].stagePath : []
  );

  return {
    coreTransitions: Array.from(
      new Set([...(templateMap?.coreTransitions || []), ...coreTransitions])
    ),
    coreRules: Array.from(
      new Set(patterns.flatMap((p) => p.businessRules.filter((r) => r.severity === 'core').map((r) => r.label)))
    ),
    coreEdgeCases: Array.from(
      new Set(
        patterns
          .flatMap((p) => p.edgeCases.filter((e) => e.severity === 'core').map((e) => e.scenario))
          .concat(overlays.flatMap((o) => o.painPoints.filter((p) => p.severity === 'core').map((p) => p.label)))
      )
    ),
    coreFeatures: Array.from(
      new Set([
        ...patterns.flatMap((p) => p.features.filter((f) => f.severity === 'core').map((f) => f.label)),
        ...overlays.flatMap((o) => o.extraFeatures.filter((f) => f.severity === 'core').map((f) => f.label))
      ])
    ),
    coreItems: Array.from(new Set(overlays.flatMap((o) => o.coreItems))),
    advisoryItems: Array.from(new Set(overlays.flatMap((o) => o.advisoryItems))),
    roles: Array.from(
      new Set([
        ...patterns.flatMap((p) => p.actors.map((a) => a.role)),
        ...overlays.flatMap((o) => o.roleLabels)
      ])
    )
  };
}
