import type { RoleCategory } from '../../rolePolicy';

/**
 * Skema repository proses bisnis.
 * - ProcessPattern  : pola universal lintas industri (UP-01..UP-10)
 * - IndustryOverlay : kekhasan per industri (IND-01..IND-20)
 * - TemplateProcessMap : jembatan Master Template -> pola + overlay
 * - MockupSessionState : jawaban sesi mockup terpandu
 */

export type BusinessTier = 'BASIC' | 'ADVANCE';
export type OptionComplexity = 'LOW' | 'MEDIUM' | 'HIGH';
export type ProcessSeverity = 'core' | 'advisory';

export interface ProcessProvenance {
  source: string;
  note?: string;
}

export interface ProcessEntity {
  name: string;
  fields?: string[];
  description?: string;
}

export interface ProcessStage {
  id: string;
  label: string;
  description?: string;
  terminal?: boolean;
}

export interface ProcessActor {
  role: string;
  category: RoleCategory;
  goals: string[];
  countsForTier?: boolean;
}

export interface ProcessFlowVariant {
  id: string;
  label: string;
  summary: string;
  stagePath: string[];
}

export interface ProcessFeature {
  id: string;
  label: string;
  description?: string;
  severity: ProcessSeverity;
  complexity: OptionComplexity;
  countsForTier?: boolean;
}

export interface ProcessPainPoint {
  id: string;
  label: string;
  severity: ProcessSeverity;
}

export interface ProcessTierSignal {
  id: string;
  label: string;
}

export type ProcessRuleType = 'money' | 'policy' | 'approval' | 'sla';

export interface ProcessBusinessRule {
  id: string;
  type: ProcessRuleType;
  label: string;
  severity: ProcessSeverity;
}

export interface ProcessEdgeCase {
  id: string;
  scenario: string;
  handling: string;
  severity: ProcessSeverity;
}

export interface ProcessNotification {
  id: string;
  event: string;
  recipient: string;
  channel: string;
}

export interface ProcessPattern {
  id: string;
  nama: string;
  tujuan: string;
  entities: ProcessEntity[];
  stages: ProcessStage[];
  actors: ProcessActor[];
  flowVariants: ProcessFlowVariant[];
  features: ProcessFeature[];
  painPoints: ProcessPainPoint[];
  businessRules: ProcessBusinessRule[];
  edgeCases: ProcessEdgeCase[];
  notifications: ProcessNotification[];
  audit: string[];
  tierSignals: ProcessTierSignal[];
}

export interface IndustryOverlay {
  id: string;
  nama: string;
  keywords: string[];
  patternIds: string[];
  extraEntities: ProcessEntity[];
  notes: string[];
  painPoints: ProcessPainPoint[];
  roleLabels: string[];
  extraFeatures: ProcessFeature[];
  coreItems: string[];
  advisoryItems: string[];
  provenance: ProcessProvenance[];
  version: string;
  lastReviewed: string;
}

export interface TemplateProcessMap {
  templateId: string;
  patternIds: string[];
  overlayIds: string[];
  coreTransitions: string[];
  advisoryNotes: string[];
}

export interface GuidedStepOption {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
  locked?: boolean;
  complexity?: OptionComplexity;
  responsibilities?: string[];
  roleStatus?: 'WAJIB_OWNER' | 'WAJIB_INTI' | 'TAMBAHAN';
  steps?: { step?: number; pelaku: string; aksi: string }[];
  category?: 'ALUR_INTI' | 'ALUR_PENDUKUNG' | 'FITUR_PENDUKUNG' | string;
}

export type GuidedStepId =
  | 'STORYTELLING'
  | 'ROLE'
  | 'ALUR'
  | 'RBAC'
  | 'SKEMA_DATA'
  | 'SIMULASI_DB'
  | 'REVIEW_FINAL';

export interface GuidedStepPayload {
  stepId: GuidedStepId;
  title: string;
  multi: boolean;
  allowOther: boolean;
  options: GuidedStepOption[];
}

export type SessionStep =
  | 'STORYTELLING'
  | 'ROLE'
  | 'ALUR'
  | 'RBAC'
  | 'SKEMA_DATA'
  | 'SIMULASI_DB'
  | 'REVIEW_FINAL';

export interface MockupSessionState {
  step: SessionStep;
  match: {
    templateId: string;
    overlayIds: string[];
    patternIds: string[];
    tier: BusinessTier;
    businessCategory?: string;
    contextualPainPoints?: string[];
    contextualRoles?: string[];
  };
  storyline?: {
    narasi: string;
    asumsiMasalah: string;
    asumsiAktor: string[];
    asumsiAlurUtama: string;
    detailAktor?: Record<string, { narasi: string; tanggungJawab: string[] }>;
    statusKonfirmasi: 'disetujui' | 'dikoreksi';
    revisiCount?: number;
  };
  roles: {
    selected: string[];
    other?: string;
    wajib?: string[];
    tambahan?: string[];
    tugasDilimpahkan?: { dariRole: string; keRole: string; daftarTugas: string[] }[];
  };
  flow: {
    selectedId?: string;
    other?: string;
    alurInti?: { step: number; pelaku: string; aksi: string }[];
    alurPendukung?: { nama: string; steps: { pelaku: string; aksi: string }[] }[];
    fiturPendukung?: string[];
  };
  rbac?: {
    modul: { nama: string; izinPerRole: { role: string; level: string }[] }[];
  };
  dataSchema?: {
    tabel: { nama: string; field: { nama: string; tipe: string; keterangan: string }[] }[];
  };
  painPoints: { selected: string[]; other?: string };
  features: {
    selected: { id: string; priority: 'WAJIB' | 'NYUSUL' }[];
    other?: string;
  };
  compiledBrief?: string;
}

export const BASIC_FEATURE_TIER_THRESHOLD = 6;
export const ADVANCE_ROLE_THRESHOLD = 3;
