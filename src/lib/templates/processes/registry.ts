import { PROCESS_PATTERNS } from './patterns';
import {
  ADVANCE_ROLE_THRESHOLD,
  type BusinessTier,
  type ProcessPattern
} from './types';

/**
 * Registry dasar repository proses bisnis.
 * Batch 1: lookup pola + deteksi tier basic/advance.
 * Batch 6 akan menambah helper prompt/checklist/gate.
 */

export function getProcessPatternById(id: string): ProcessPattern | undefined {
  return PROCESS_PATTERNS.find((p) => p.id === id);
}

export function getProcessPatternsByIds(ids: string[]): ProcessPattern[] {
  return ids
    .map((id) => getProcessPatternById(id))
    .filter((p): p is ProcessPattern => Boolean(p));
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
