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
  requiresInput?: boolean;
  inputPlaceholder?: string;
}

export type GuidedStepId =
  | 'STORYTELLING'
  | 'DOMAIN_PROFILE'
  | 'ROLE'
  | 'ALUR'
  | 'RBAC'
  | 'FORMULA'
  | 'SKEMA_DATA'
  | 'SIMULASI_DB'
  | 'REVIEW_FINAL';

export interface EntityDataCardItem {
  id: string;
  name: string;
  description: string;
  ownerRole?: string;
}

export interface DomainProfile {
  modelOperasional: 'DI_TEMPAT' | 'PENGIRIMAN_LOGISTIK' | 'DIGITAL';
  modelTarif: 'SEWA_DURASI' | 'BERAT_TIMBANGAN' | 'PER_ITEM' | 'BIAYA_JASA';
  adaJaminanDeposit: boolean;
  fungsiDeposit?: string;
  entitasKatalogMaster: string[];
  entitasPencatatanTransaksi: string[];
  komponenBiayaYangLazim: string[]; // WHITELIST SAJA — strict whitelist tanpa blocklist
  referensiAlurKerjaLazim?: ReferensiModulRole[];
  catatanOperasional?: string;
  markdownMindMap?: string;
  statusKonfirmasi?: 'disetujui' | 'dikoreksi';
  revisiCount?: number;
}

export interface ReferensiModulItem {
  nama: string;
  deskripsi?: string;
}

export interface ReferensiModulRole {
  role: string;
  modul: ReferensiModulItem[];
}

export interface RoleModuleChecklistItem {
  id: string;
  nama: string;
  deskripsi?: string;
  role: string;
  termasukDiAlur: boolean;
  disarankan?: boolean;
  checked: boolean;
  isCustom?: boolean;
  catatanTambahan?: string;
  cakupanAksi?: string[];
}

export interface RoleModuleChecklistGroup {
  role: string;
  items: RoleModuleChecklistItem[];
}

export interface AnalyzeCustomModuleResult {
  canMerge: boolean;
  targetModuleName?: string;
  targetModuleId?: string;
  mergeExplanation?: string;
  enhancedTargetDescription?: string;
  independentModuleName?: string;
  independentModuleDescription?: string;
}

export interface ViewAggregateField {
  key: string;
  label: string;
  op: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  sourceKey?: string;
  format?: 'rupiah' | 'angka' | 'teks';
}

export interface ViewConfig {
  id: string;
  label: string;
  icon?: string;
  targetRoles?: string[];
  sourceTable: string;
  groupByField: string;
  groupByLabel: string;
  aggregates: ViewAggregateField[];
  keterangan?: string;
}

export interface GuidedStepPayload {
  stepId: GuidedStepId;
  title: string;
  multi: boolean;
  allowOther: boolean;
  options: GuidedStepOption[];
  backNavOption?: GuidedStepOption;
  entityDataList?: EntityDataCardItem[];
  domainProfile?: DomainProfile;
  roleModuleChecklist?: RoleModuleChecklistGroup[];
  rbacStage?: 'CHECKLIST' | 'MATRIX';
}

export type SessionStep =
  | 'STORYTELLING'
  | 'DOMAIN_PROFILE'
  | 'ROLE'
  | 'ALUR'
  | 'RBAC'
  | 'FORMULA'
  | 'SKEMA_DATA'
  | 'SIMULASI_DB'
  | 'REVIEW_FINAL';

export type KondisiArahBisnis = 'SATU_ARAH' | 'DUA_ARAH' | 'AMBIGU' | 'BUKAN_IDE_BISNIS';

export interface PemisahanRoleResult {
  keputusan: 'PISAH' | 'GABUNG';
  alasan: string;
  roleKasusA?: string;
  roleKasusB?: string;
}

export interface AnalisisArahResult {
  kondisi: KondisiArahBisnis;
  alasan: string;
  duaArah?: {
    prosesA: string;
    prosesB: string;
    entitasBersama?: string;
    pemisahanRole?: PemisahanRoleResult;
  };
  klarifikasiAmbigu?: {
    sapaan?: string;
    pertanyaan: string;
    opsiA: string;
    opsiB: string;
    opsiBoth?: string;
  };
  klarifikasiBukanIde?: {
    pesanKlarifikasi: string;
  };
}

export interface ActorClassification {
  actor: string;
  category: 'PENGGUNA_SISTEM' | 'ENTITAS_DATA';
  reason?: string;
  ownerRole?: string; // hanya untuk ENTITAS_DATA — role yang mencatat/mengelolanya
  actionOwners?: { action: string; role: string }[]; // aksi lain selain create, kalau disebutkan di alur
  confidence?: 'high' | 'low';
  matchSource?: 'EXPLICIT_OWNER' | 'EXPLICIT_STAFF_TITLE' | 'PREDICATE_SEMANTIC_MATCH' | 'AI_SEMANTIC' | 'INCONCLUSIVE_FALLBACK';
}

export interface BusinessFormula {
  namaField: string;
  labelField: string;
  targetTable: string;
  deskripsi: string;
  formulaText: string;
  komponenInput: string[];
  tipeOperasi?: 'perkalian' | 'penjumlahan' | 'pengurangan' | 'pembagian' | 'kombinasi' | 'custom';
  formulaExpression?: string;
}

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
  actorsClassification?: ActorClassification[];
  domainProfile?: DomainProfile;
  pendingOwnerRoleClarification?: {
    entity: string;
    suggestedOwnerRoles: string[];
    actionDescriptions?: string[];
  };
  storyline?: {
    narasi: string;
    asumsiMasalah: string;
    asumsiAktor: string[];
    asumsiAlurUtama: string;
    detailAktor?: Record<string, { narasi: string; tanggungJawab: string[] }>;
    statusKonfirmasi: 'disetujui' | 'dikoreksi';
    revisiCount?: number;
    /**
     * Riwayat semua masukan / koreksi pengguna yang terakumulasi secara kumulatif.
     */
    riwayatKoreksi?: string[];
    /**
     * True jika user sedang dalam sesi tanya jawab bertahap (mismatch_story).
     * Jika false/undefined, kartu konfirmasi narasi standar yang ditampilkan.
     */
    modeKlarifikasiBertahap?: boolean;
    /**
     * Menyimpan sub-step klarifikasi peran pelaku (Pengguna Sistem vs Entitas Data).
     */
    pendingActorClarification?: {
      actors: ActorClassification[];
      ownerActor: string;
      currentIndex?: number;
    };
    /**
     * Hasil analisis konseptual arah bisnis dari AI (SATU_ARAH, DUA_ARAH, atau AMBIGU).
     */
    analisisArah?: AnalisisArahResult;
    /**
     * Menyimpan data klarifikasi arah bisnis yang sedang menunggu jawaban user
     * sebelum narasi storytelling difinalkan oleh AI.
     */
    pendingDirectionClarification?: {
      patternId?: string;
      originalPrompt: string;
      pertanyaan?: string;
      opsiA?: string;
      opsiB?: string;
      opsiBoth?: string;
      nameA?: string;
      nameB?: string;
    };
    /**
     * Menyimpan data klarifikasi jika input pengguna dinilai bukan ide proses bisnis/aplikasi.
     */
    pendingNonBusinessClarification?: {
      originalPrompt: string;
      pesanKlarifikasi: string;
    };
    /**
     * Sub-step pertanyaan variasi produk/layanan.
     * Ditampilkan SETELAH klarifikasi aktor selesai, SEBELUM lanjut ke step ROLE.
     * Jawaban user diappend ke narasi sebagai konteks heuristik skema data.
     */
    pendingProductVariantQuestion?: {
      /** Nama entitas bisnis utama yang ditanyakan variannya (contoh: "kursus", "layanan", "paket") */
      entityLabel: string;
    };
  };
  roles: {
    selected: string[];
    other?: string;
    wajib?: string[];
    tambahan?: string[];
    tugasDilimpahkan?: { dariRole: string; keRole: string; daftarTugas: string[] }[];
    removedExternalRoles?: string[];
  };
  flow: {
    selectedId?: string;
    other?: string;
    alurInti?: { step: number; pelaku: string; aksi: string }[];
    alurPendukung?: { nama: string; steps: { pelaku: string; aksi: string }[] }[];
    fiturPendukung?: string[];
    /**
     * Aktif hanya jika user memilih "dua alur terpisah" untuk proses inti yang setara.
     * Mutual exclusive dengan alurInti untuk rendering — kalau kasusGanda.length > 0,
     * alurInti dibiarkan kosong/tidak dipakai di renderFlowMarkdown.
     */
    kasusGanda?: {
      nama: string;
      alurInti: { step: number; pelaku: string; aksi: string }[];
    }[];
    /**
     * true saat sistem mendeteksi dua proses setara dan menunggu jawaban user
     * ("dua alur terpisah" vs "satu alur utama + fitur tambahan").
     */
    dualFlowPending?: boolean;
    /**
     * Nama proses A dan B yang terdeteksi — disimpan bersama dualFlowPending
     * agar handler jawaban bisa membacanya tanpa perlu deteksi ulang.
     */
    dualProcessNames?: { processA: string; processB: string };
    /**
     * true jika user sudah memilih "Dua-duanya" saat klarifikasi arah bisnis di step STORYTELLING.
     * Saat bernilai true, transisi ke step ALUR langsung memproses kasus ganda TANPA bertanya lagi.
     */
    dualFlowPreDecided?: boolean;
  };
  rbac?: {
    modul: {
      nama: string;
      deskripsiFungsional?: string;
      izinPerRole: { role: string; level: string; keterangan?: string }[];
    }[];
    markdownTable?: string;
    catatanPelimpahan?: string[];
    statusKonfirmasi?: 'disetujui' | 'dikoreksi';
    revisiCount?: number;
    checklistPerRole?: RoleModuleChecklistGroup[];
    confirmedModulesPerRole?: Record<string, string[]>;
    stage?: 'CHECKLIST' | 'MATRIX';
  };
  formulas?: {
    daftar: BusinessFormula[];
    markdownTable?: string;
    statusKonfirmasi?: 'disetujui' | 'dikoreksi';
    revisiCount?: number;
  };
  dataSchema?: {
    tabel: {
      nama: string;
      keterangan?: string;
      displayField?: string;
      compositeFields?: string[];
      field: {
        nama: string;
        tipe: string;
        keterangan: string;
        targetRole?: string;
        targetTable?: string;
        isFormula?: boolean;
        formulaExpression?: string;
      }[];
    }[];
    views?: ViewConfig[];
    korelasiRingkas?: string;
    markdownTable?: string;
    statusKonfirmasi?: 'disetujui' | 'dikoreksi';
    revisiCount?: number;
  };
  simulasiDb?: {
    contohData: {
      tabel: {
        nama: string;
        keterangan?: string;
        field?: { nama: string; tipe: string; keterangan?: string; targetRole?: string }[];
        baris: Record<string, any>[];
      }[];
    };
    akunLogin: {
      nama: string;
      role: string;
      username: string;
      password: string;
    }[];
    markdownTable?: string;
    instruksiGenerator?: string[];
    statusKonfirmasi?: 'disetujui' | 'dikoreksi';
    revisiCount?: number;
  };
  painPoints: { selected: string[]; other?: string };
  features: {
    selected: { id: string; priority: 'WAJIB' | 'NYUSUL' }[];
    other?: string;
  };
  compiledBrief?: string;
  reviewFinalApproved?: boolean;
  statusKonfirmasi?: 'disetujui' | 'dikoreksi';
  review?: { statusKonfirmasi?: 'disetujui' | 'dikoreksi' };
  changeSnapshots?: {
    lastModifiedStep?: SessionStep;
    prevRoles?: string[];
    prevAlurInti?: { step: number; pelaku: string; aksi: string }[];
    prevRbacModul?: string[];
    prevDataSchemaTabel?: string[];
    prevSimulasiDbTabel?: string;
    prevSimulasiDbRoles?: string[];
    changeNote?: string;
  };
}

export const BASIC_FEATURE_TIER_THRESHOLD = 6;
export const ADVANCE_ROLE_THRESHOLD = 3;
