import {
  getProcessPatternsByIds,
  getIndustryOverlaysByIds,
  buildBusinessProcessChecklist
} from './registry';
import { getMasterTemplateById } from '../masterTemplates';
import { getRoleCategory } from '../../rolePolicy';
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
  'STORYTELLING',
  'ROLE',
  'ALUR',
  'RBAC',
  'SKEMA_DATA',
  'SIMULASI_DB',
  'REVIEW_FINAL'
];

export function nextSessionStep(step: GuidedStepId | SessionStep): SessionStep {
  const idx = SESSION_STEP_ORDER.indexOf(step as SessionStep);
  if (idx < 0) return 'STORYTELLING';
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
 * Kelompok makna peran agar tidak ada duplikat seperti "Pelanggan" vs "Customer",
 * atau "Super Admin" vs "Pemilik".
 * CATATAN PENTING: ROLE_GROUPS cakupannya terbatas murni untuk deduplikasi sinonim peran wajib saja,
 * BUKAN sebagai sumber saran role baru!
 */
const ROLE_GROUPS: Array<{ key: string; re: RegExp }> = [
  { key: 'super-admin', re: /^(super\s*admin|owner|pemilik|pengurus|direktur|director|founder|yayasan)$/i },
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
  { key: 'manager', re: /manager|manajer|supervisor|pengawas|kepala|principal/i },
  { key: 'admin-staff', re: /\badmin\b|administrator/i },
];

/**
 * Validasi grounding konseptual peran: memastikan peran calon memiliki kaitan semantik
 * dengan narasi dan domain, serta menolak peran artefak template generik yang tidak berdasar.
 */
export function isRoleSemanticallyGrounded(role: string, storylineText: string, businessCategory: string): boolean {
  const clean = role.trim();
  if (!clean) return false;
  // Peran artefak generik template yang tidak berdasar ditolak kecuali secara eksplisit dibahas di cerita
  if (/^(viewer|operator|peninjau|pengamat|user|pengguna|staf operasional)$/i.test(clean)) {
    return new RegExp(`\\b${clean}\\b`, 'i').test(storylineText);
  }
  return true;
}

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

function isExternalRole(label: string): boolean {
  return canonicalRoleKey(label) === 'customer';
}

function buildStorytellingStep(session: MockupSessionState): GuidedStepPayload {
  const revisiCount = session.storyline?.revisiCount || 0;
  const isClarifying = revisiCount > 0 && session.storyline?.statusKonfirmasi === 'dikoreksi';

  if (isClarifying) {
    return {
      stepId: 'STORYTELLING',
      title: revisiCount === 1 ? 'Klarifikasi: Apa masalah operasional utama yang ingin diselesaikan?' : 'Klarifikasi: Siapa saja pihak yang terlibat langsung?',
      multi: false,
      allowOther: true,
      options: [
        {
          id: 'clarify_input',
          label: '✏️ Berikan tanggapan / catatan penjelasan di bawah',
          recommended: true,
          description: revisiCount === 1 ? 'Jelaskan masalah operasional paling mendesak' : 'Sebutkan orang atau peran yang terlibat'
        },
        {
          id: 'confirm_story',
          label: '✅ Lanjut saja ke penetapan peran (Role)',
          description: 'Gunakan pemahaman saat ini dan sesuaikan nanti'
        }
      ]
    };
  }

  return {
    stepId: 'STORYTELLING',
    title: 'Konfirmasi gambaran proses bisnis aplikasi Anda',
    multi: false,
    allowOther: true,
    options: [
      {
        id: 'confirm_story',
        label: '✅ Sudah sesuai, lanjut ke Role',
        recommended: true,
        description: 'Alur proses bisnis sudah tepat menggambarkan operasional'
      },
      {
        id: 'minor_adjust',
        label: '✏️ Ada koreksi / catatan alur',
        description: 'Ada sedikit penyesuaian alur atau aktor yang terlibat'
      },
      {
        id: 'mismatch_story',
        label: '❌ Meleset jauh dari proses bisnis saya',
        description: 'Perlu penyesuaian mendasar pada masalah atau alur'
      }
    ]
  };
}

export interface RoleDetailDefinition {
  narasi: string;
  tanggungJawab: string[];
}

export function detectCoreOperationalRole(session: MockupSessionState): string {
  // 1. Dari aktor cerita bisnis (asumsiAktor) - Prioritas tunggal dari hasil AI cerita
  const actors = session.storyline?.asumsiAktor || session.match.contextualRoles || [];
  for (const a of actors) {
    const clean = a.trim();
    const key = canonicalRoleKey(clean);
    if (key !== 'super-admin' && key !== 'customer' && !GENERIC_ROLE_RE.test(clean)) {
      return EN_ROLE_LABEL_MAP[clean.toLowerCase()] || clean;
    }
  }

  // Fallback netral jika tidak ada aktor alur inti khusus
  return 'Staf Layanan';
}

export interface StorylineContext {
  narasi?: string;
  asumsiAlurUtama?: string;
  detailAktor?: Record<string, { narasi: string; tanggungJawab: string[] }>;
}

export function getRoleNarrativeAndResponsibilities(
  roleLabel: string,
  businessCategory?: string,
  storylineContext?: StorylineContext
): RoleDetailDefinition {
  const clean = roleLabel.trim();
  const cat = businessCategory || 'bisnis ini';

  // 1. PRIORITAS UTAMA: Gunakan detailAktor hasil AI yang sudah digrounding dari cerita
  if (storylineContext?.detailAktor) {
    const directMatch = storylineContext.detailAktor[clean];
    if (directMatch && directMatch.narasi && directMatch.tanggungJawab?.length) {
      return directMatch;
    }
    const lowerClean = clean.toLowerCase();
    for (const [k, v] of Object.entries(storylineContext.detailAktor)) {
      if (k.toLowerCase() === lowerClean && v && v.narasi && v.tanggungJawab?.length) {
        return v;
      }
    }
  }

  // 2. FALLBACK KONTEKSTUAL CERITA:
  // Membaca teks narasi dan alur utama secara langsung, BUKAN kembali ke switch-case kata kunci statis.
  const fullStory = `${storylineContext?.narasi || ''} ${storylineContext?.asumsiAlurUtama || ''}`.trim();
  const lowerStory = fullStory.toLowerCase();
  const lowerRole = clean.toLowerCase();

  // A. Super Admin / Owner
  if (canonicalRoleKey(clean) === 'super-admin' || /^(super\s*admin|pemilik|owner)$/i.test(clean)) {
    return {
      narasi: `Pemilik usaha atau penanggung jawab utama operasional ${cat}. Memastikan seluruh aktivitas harian berjalan tertib, memantau pergerakan omzet dan laporan transaksi, serta mengelola akun staf yang bertugas.`,
      tanggungJawab: [
        `Memantau ringkasan omzet dan transaksi harian ${cat}`,
        'Mendaftarkan dan mengelola hak akses akun staf yang bertugas',
        'Meninjau performa keseluruhan operasional dan pengaturan aplikasi'
      ]
    };
  }

  // B. Pelanggan / Konsumen / Penyewa / Pasien (Grounded sesuai domain cerita)
  if (canonicalRoleKey(clean) === 'customer' || /^(pelanggan|penyewa|pasien|pembeli|tamu)$/i.test(clean)) {
    let customerNarasi = `Pihak yang menggunakan dan menikmati layanan di ${cat}, memilih paket atau kebutuhan layanan, serta menerima bukti transaksi resmi.`;
    const customerTasks = [
      `Memilih dan mengajukan kebutuhan layanan di ${cat}`,
      'Melakukan pembayaran dan memverifikasi data transaksi',
      'Menerima bukti layanan atau kuitansi resmi'
    ];

    if (lowerStory.includes('sewa') || lowerStory.includes('rental') || lowerRole.includes('penyewa')) {
      customerNarasi = `Penyewa armada di ${cat} yang memilih unit kendaraan lepas kunci atau dengan sopir, menyerahkan dokumen persyaratan dan jaminan, serta menikmati perjalanan berkendara.`;
      customerTasks[0] = 'Memilih armada kendaraan dan durasi waktu sewa';
      customerTasks[1] = 'Menyerahkan dokumen identitas (SIM/KTP) dan jaminan sewa';
      customerTasks[2] = 'Melakukan pembayaran dan menerima serah-terima unit armada';
    } else if (lowerStory.includes('gigi') || lowerStory.includes('dental') || lowerRole.includes('pasien')) {
      customerNarasi = `Pasien yang mendaftar pemeriksaan di ${cat}, menyampaikan keluhan kesehatan rongga mulut, dan menjalani tindakan medis di kursi periksa dokter.`;
      customerTasks[0] = 'Mendaftar antrean dan menyampaikan keluhan gigi/rongga mulut';
      customerTasks[1] = 'Menjalani tindakan medis di dental chair bersama dokter';
      customerTasks[2] = 'Menerima resep obat dan menyelesaikan administrasi pembayaran';
    } else if (lowerStory.includes('cuci') || lowerStory.includes('mobil') || lowerStory.includes('motor')) {
      customerNarasi = `Pelanggan yang membawa kendaraannya ke ${cat} untuk mendapatkan layanan pencucian serta pembersihan interior/eksterior hingga bersih dan rapi.`;
      customerTasks[0] = 'Memilih paket pencucian atau perawatan kendaraan';
      customerTasks[1] = 'Melakukan pembayaran transaksi di meja kasir';
      customerTasks[2] = 'Memeriksa hasil pembersihan dan menerima kembali kendaraan';
    }

    return {
      narasi: customerNarasi,
      tanggungJawab: customerTasks
    };
  }

  // C. Peran Staf Lapangan & Spesifik (Membaca aktivitas konkret di narasi)
  const tasks: string[] = [];
  let roleNarrative = '';

  if (lowerRole.includes('sopir') || lowerRole.includes('driver')) {
    // Grounding khusus sopir perjalanan kendaraan (BUKAN kurir pengantar barang/paket)
    roleNarrative = `Pengemudi armada di ${cat} yang mendampingi dan mengantarkan penumpang dengan aman dan nyaman ke tempat tujuan sesuai kesepakatan perjalanan.`;
    tasks.push('Memastikan unit kendaraan siap pakai dan dalam kondisi bersih sebelum menjemput');
    tasks.push('Mendampingi penumpang dan mengemudikan kendaraan secara aman sesuai rute');
    tasks.push('Melaporkan status penyelesaian perjalanan dan kondisi kilometer armada');
  } else if (lowerRole.includes('kunci') || lowerRole.includes('serah terima') || (lowerRole.includes('petugas') && (lowerStory.includes('sewa') || lowerStory.includes('rental')))) {
    // Petugas serah-terima unit rental
    roleNarrative = `Petugas garis depan di ${cat} yang memverifikasi persyaratan administrasi penyewa, mengecek kondisi fisik dan kilometer armada, serta melakukan serah-terima kunci.`;
    if (lowerStory.includes('sim') || lowerStory.includes('bpkb') || lowerStory.includes('ktp')) {
      tasks.push('Memverifikasi kelengkapan dokumen identitas dan jaminan penyewa (SIM & KTP/BPKB)');
    } else {
      tasks.push('Memverifikasi dokumen identitas dan jaminan sewa pelanggan');
    }
    if (lowerStory.includes('kilometer')) {
      tasks.push('Mencatat kondisi fisik unit serta angka kilometer awal dan akhir');
    } else {
      tasks.push('Mengecek kondisi fisik armada sebelum dan sesudah digunakan');
    }
    tasks.push('Mengurus serah-terima kunci armada dan bukti tanda terima sewa');
  } else if (lowerRole.includes('cuci') || lowerRole.includes('vakum') || lowerRole.includes('lap')) {
    // Petugas cuci mobil/motor
    roleNarrative = `Petugas operasional yang mengerjakan pembersihan langsung pada unit kendaraan di ${cat}, mulai dari penyemprotan air bertekanan, sabun salju, hingga pemvakuman interior.`;
    tasks.push('Menerima antrean slot kendaraan yang masuk ke area cuci');
    tasks.push('Menyemprotkan sabun, membersihkan bodi, dan memvakum interior kendaraan');
    tasks.push('Mengeringkan bodi dengan lap chamois dan memastikan unit bersih mengilap');
  } else if (lowerRole.includes('kasir') || lowerRole.includes('resepsionis') || lowerRole.includes('loket')) {
    roleNarrative = `Petugas meja depan di ${cat} yang menyambut kedatangan pelanggan, mencatat pesanan atau registrasi layanan, serta memproses transaksi pembayaran.`;
    tasks.push('Menyambut pelanggan dan mencatat pesanan paket layanan yang dipilih');
    tasks.push('Menerima pembayaran transaksi tunai maupun nontunai dan mencetak struk');
    tasks.push('Membuat rekapitulasi data transaksi harian di akhir giliran kerja');
  } else if (lowerRole.includes('dokter') || lowerRole.includes('perawat') || lowerRole.includes('medis')) {
    roleNarrative = `Tenaga profesional kesehatan di ${cat} yang melakukan tindakan pemeriksaan klinis, mengoperasikan peralatan medis higienis, dan merawat pasien di kursi periksa.`;
    tasks.push('Mencatat riwayat keluhan dan melakukan pemeriksaan medis secara langsung');
    tasks.push('Menyiapkan dan mengoperasikan peralatan medis yang telah disterilisasi');
    tasks.push('Menentukan catatan tindakan perawatan medis dan resep obat yang diperlukan');
  } else {
    // Grounding umum berbasis narasi cerita pengguna
    roleNarrative = `Petugas operasional di ${cat} yang bertanggung jawab menjalankan aktivitas kerja untuk ${clean} sesuai alur operasional harian yang teratur.`;
    tasks.push(`Mencatat dan mengelola aktivitas operasional terkait ${clean}`);
    tasks.push(`Memastikan pelaksanaan tugas operasional ${clean} di lapangan berjalan tertib`);
    tasks.push('Melaporkan penyelesaian tugas dan kendala kerja kepada penanggung jawab');
  }

  return {
    narasi: roleNarrative,
    tanggungJawab: tasks
  };
}

function isSuperAdminRole(role: string): boolean {
  const key = canonicalRoleKey(role);
  return key === 'super-admin' || key === 'owner' || role === REQUIRED_ROLE;
}

export function renderRoleSummaryTable(
  rolesState: MockupSessionState['roles'],
  businessCategory?: string,
  storyline?: MockupSessionState['storyline']
): string {
  const lines: string[] = [];
  lines.push('| Peran | Status | Tanggung Jawab Utama |');
  lines.push('|---|---|---|');

  const selected = rolesState?.selected || [];
  const delegations = rolesState?.tugasDilimpahkan || [];

  for (const role of selected) {
    const isOwner = isSuperAdminRole(role);
    const status = isOwner ? 'Wajib (Owner)' : 'Aktif';
    const delegation = delegations.find((d) => d.keRole.toLowerCase() === role.toLowerCase());
    const extra = delegation ? ` *(+ melimpahkan tugas ${delegation.dariRole})*` : '';
    const details = getRoleNarrativeAndResponsibilities(role, businessCategory, storyline);
    const responsibilitiesCol = details.tanggungJawab.slice(0, 2).join('; ') + extra;
    lines.push(`| ${role} | ${status} | ${responsibilitiesCol} |`);
  }

  return lines.join('\n');
}

function buildRoleStep(session: MockupSessionState): GuidedStepPayload {
  const seen = new Set<string>([canonicalRoleKey(REQUIRED_ROLE)]);
  const candidateLabels: string[] = [];

  const fullStory = `${session.storyline?.narasi || ''} ${session.storyline?.asumsiAlurUtama || ''}`;

  const addCandidate = (label: string) => {
    const clean = label.trim();
    if (!clean || GENERIC_ROLE_RE.test(clean)) return;
    const key = canonicalRoleKey(clean);
    if (seen.has(key)) return;

    // Grounding check: pastikan peran relevan secara konseptual dengan narasi/domain
    if (!isRoleSemanticallyGrounded(clean, fullStory, session.match.businessCategory || '')) {
      return;
    }

    seen.add(key);
    candidateLabels.push(EN_ROLE_LABEL_MAP[clean.toLowerCase()] || clean);
  };

  // 1. Peran HANYA dari asumsi cerita bisnis (storyline)
  // CATATAN REVISI 2: Injeksi katalog Master Template, Overlay Industri, dan fallback Universal DIHAPUS TOTAL.
  if (session.storyline?.asumsiAktor && session.storyline.asumsiAktor.length > 0) {
    session.storyline.asumsiAktor.forEach(addCandidate);
  }

  // Tentukan Role Wajib Kedua (Alur Inti)
  const coreRole = detectCoreOperationalRole(session);

  const options: GuidedStepOption[] = [];

  // Super Admin (Owner) selalu wajib & locked
  const ownerDetails = getRoleNarrativeAndResponsibilities(REQUIRED_ROLE, session.match.businessCategory, session.storyline);
  options.push({
    id: REQUIRED_ROLE,
    label: REQUIRED_ROLE,
    description: ownerDetails.narasi,
    responsibilities: ownerDetails.tanggungJawab,
    recommended: true,
    locked: true,
    roleStatus: 'WAJIB_OWNER'
  });

  // Tambahkan role lainnya murni dari kandidat cerita yang lolos grounding
  for (const label of candidateLabels) {
    const isCore = label === coreRole;
    const details = getRoleNarrativeAndResponsibilities(label, session.match.businessCategory, session.storyline);
    options.push({
      id: label,
      label: label,
      description: details.narasi,
      responsibilities: details.tanggungJawab,
      recommended: isCore || !isExternalRole(label),
      roleStatus: isCore ? 'WAJIB_INTI' : 'TAMBAHAN'
    });
  }

  return {
    stepId: 'ROLE',
    title: 'Pilih peran pengguna & pembagian tanggung jawab aplikasi',
    multi: true,
    allowOther: true,
    options: options.slice(0, 10)
  };
}

export interface FlowStepItem {
  step: number;
  pelaku: string;
  aksi: string;
}

export interface SupportingFlowItem {
  id: string;
  nama: string;
  steps: { pelaku: string; aksi: string }[];
}

export interface SupportingFeatureItem {
  id: string;
  label: string;
  description?: string;
}

export interface DomainFlowData {
  alurInti: FlowStepItem[];
  alurPendukung: SupportingFlowItem[];
  fiturPendukung: SupportingFeatureItem[];
}

/**
 * Resolves an actor role for a workflow step, obeying task delegation.
 * If a role was removed/unselected in Step ROLE, it automatically maps to the delegated role (Super Admin / Owner).
 */
export function resolveActorForStep(
  targetRole: string,
  rolesState?: MockupSessionState['roles']
): string {
  if (!rolesState) return targetRole;

  const targetKey = canonicalRoleKey(targetRole);

  // Jika role pelanggan/tamu/eksternal, tetap apa adanya
  if (
    targetKey === 'customer' ||
    targetKey === 'guest' ||
    /^(pelanggan|pembeli|tamu|pasien|siswa|murid|wali|penyewa|klien)\b/i.test(targetRole)
  ) {
    return targetRole;
  }

  // 1. Cek apakah ada tugas yang dilimpahkan dari role ini
  const delegation = rolesState.tugasDilimpahkan?.find(
    (d) =>
      canonicalRoleKey(d.dariRole) === targetKey ||
      d.dariRole.trim().toLowerCase() === targetRole.trim().toLowerCase()
  );
  if (delegation) {
    return delegation.keRole;
  }

  // 2. Cek apakah role target ada di selected roles
  const isSelected = rolesState.selected?.some(
    (r) =>
      canonicalRoleKey(r) === targetKey ||
      r.trim().toLowerCase() === targetRole.trim().toLowerCase()
  );
  if (!isSelected) {
    return REQUIRED_ROLE; // 'Super Admin'
  }

  return targetRole;
}

/**
 * Menghasilkan Alur Inti (5-7 langkah), Alur Pendukung (1-2 alur), dan Fitur Pendukung (3-5 fitur)
 * berdasarkan session storyline, industry overlay, dan status peran (termasuk tugas dilimpahkan).
 */
export function getDomainFlowDetails(session: MockupSessionState): DomainFlowData {
  const category = (session.match.businessCategory || '').toLowerCase();
  const templateId = (session.match.templateId || '').toLowerCase();
  const overlays = getIndustryOverlaysByIds(session.match.overlayIds);
  const overlayText = overlays.map((o) => `${o.nama} ${o.keywords.join(' ')}`).join(' ').toLowerCase();
  const storylineText = `${session.storyline?.narasi || ''} ${session.storyline?.asumsiAlurUtama || ''}`.toLowerCase();
  const allContext = `${category} ${templateId} ${overlayText} ${storylineText}`;

  // Prioritaskan role wajib kedua yang sudah ditetapkan di POIN 3 (session.roles.wajib)
  let coreRole = session.roles?.wajib?.find((r) => r !== REQUIRED_ROLE);
  if (!coreRole) {
    coreRole = detectCoreOperationalRole(session);
  }
  const activeCore = resolveActorForStep(coreRole, session.roles);
  const activeOwner = REQUIRED_ROLE; // 'Super Admin'

  // 1. Servis / Bengkel / Reparasi
  if (/servis|bengkel|reparasi|montir|mekanik|otomotif|gadget|elektronik|teknisi/i.test(allContext)) {
    const actorTeknisi = activeCore;
    return {
      alurInti: [
        { step: 1, pelaku: 'Pelanggan', aksi: 'Datang membawa perangkat/kendaraan dan menjelaskan keluhan kerusakan' },
        { step: 2, pelaku: actorTeknisi, aksi: 'Menerima unit, memeriksa kerusakan fisik/mesin, dan mengestimasi biaya' },
        { step: 3, pelaku: 'Pelanggan', aksi: 'Menyetujui estimasi biaya dan menerima tanda terima pendaftaran servis' },
        { step: 4, pelaku: actorTeknisi, aksi: 'Melakukan perbaikan dan penggantian suku cadang yang rusak' },
        { step: 5, pelaku: actorTeknisi, aksi: 'Menguji fungsi hingga normal dan mengubah status servis menjadi siap diambil' },
        { step: 6, pelaku: 'Pelanggan', aksi: 'Mengambil barang yang telah diperbaiki dan melakukan pelunasan biaya' },
        { step: 7, pelaku: activeOwner, aksi: 'Memverifikasi pelunasan transaksi dan mencatat garansi servis di sistem' }
      ],
      alurPendukung: [
        {
          id: 'alur_sparepart',
          nama: 'Pengadaan Suku Cadang (Sparepart)',
          steps: [
            { pelaku: actorTeknisi, aksi: 'Mencatat suku cadang khusus yang perlu dipesan ke distributor' },
            { pelaku: activeOwner, aksi: 'Melakukan persetujuan pembelian dan memesan ke suplier' },
            { pelaku: actorTeknisi, aksi: 'Menerima suku cadang dan mencatat pemasangan pada unit servis' }
          ]
        },
        {
          id: 'alur_garansi',
          nama: 'Klaim Garansi Servis',
          steps: [
            { pelaku: 'Pelanggan', aksi: 'Datang kembali membawa nota klaim karena kendala yang sama berulang' },
            { pelaku: actorTeknisi, aksi: 'Mengecek keabsahan kartu garansi dan melakukan perbaikan ulang' }
          ]
        }
      ],
      fiturPendukung: [
        { id: 'feat_wa_servis', label: 'Notifikasi WhatsApp otomatis saat perbaikan selesai' },
        { id: 'feat_tanda_terima', label: 'Cetak tanda terima & nota servis dengan barcode/QR' },
        { id: 'feat_filter_plat', label: 'Filter riwayat servis berdasarkan plat nomor / nama pelanggan' },
        { id: 'feat_reminder_servis', label: 'Pengingat otomatis jadwal perawatan rutin berkala' },
        { id: 'feat_ekspor_omzet', label: 'Ekspor laporan omzet jasa dan penggunaan suku cadang' }
      ]
    };
  }

  // 2. Restoran / Kafe / F&B / Kuliner
  if (/resto|kafe|cafe|kopi|coffee|kuliner|f&b|makanan|minuman|katering|catering|dapur/i.test(allContext)) {
    const actorKasir = activeCore;
    const actorDapur = resolveActorForStep('Staf Dapur', session.roles);
    return {
      alurInti: [
        { step: 1, pelaku: 'Pelanggan', aksi: 'Datang dan memilih menu makanan/minuman yang diinginkan' },
        { step: 2, pelaku: actorKasir, aksi: 'Mencatat pesanan meja dan meneruskan tiket order ke bagian dapur' },
        { step: 3, pelaku: actorDapur, aksi: 'Menyiapkan hidangan sesuai antrean dan menyajikannya ke meja pelanggan' },
        { step: 4, pelaku: 'Pelanggan', aksi: 'Menikmati hidangan dan meminta total tagihan pembayaran' },
        { step: 5, pelaku: actorKasir, aksi: 'Menerima pembayaran tunai atau digital (QRIS) dan memberikan struk' },
        { step: 6, pelaku: activeOwner, aksi: 'Melihat rekap omzet harian dan memantau menu makanan terlaris' }
      ],
      alurPendukung: [
        {
          id: 'alur_belanja_dapur',
          nama: 'Belanja Bahan Baku Dapur Harian',
          steps: [
            { pelaku: actorDapur, aksi: 'Mencatat bahan makanan yang menipis menjelang tutup gerai' },
            { pelaku: activeOwner, aksi: 'Melakukan pembelian bahan baku segar ke suplier pasar' }
          ]
        },
        {
          id: 'alur_cancel_menu',
          nama: 'Pembatalan / Perubahan Menu Pesanan',
          steps: [
            { pelaku: 'Pelanggan', aksi: 'Meminta pembatalan atau pergantian menu sebelum diproses dapur' },
            { pelaku: actorKasir, aksi: 'Menyesuaikan tiket pesanan dapur dan memperbarui total tagihan' }
          ]
        }
      ],
      fiturPendukung: [
        { id: 'feat_kitchen_ticket', label: 'Cetak tiket pesanan otomatis untuk dapur & kasir' },
        { id: 'feat_table_mgmt', label: 'Manajemen nomor meja & status pesanan (Dine-in / Takeaway)' },
        { id: 'feat_best_seller', label: 'Filter laporan menu terlaris (Best Seller) mingguan' },
        { id: 'feat_shift_rekap', label: 'Rekap kas masuk harian per giliran shift kasir' },
        { id: 'feat_stok_bahan', label: 'Peringatan otomatis stok bahan baku utama menipis' }
      ]
    };
  }

  // 3. Laundry / Cuci Kiloan
  if (/laundry|cuci|dry\s*clean|kiloan|setrika|pakaian/i.test(allContext)) {
    const actorLaundry = activeCore;
    return {
      alurInti: [
        { step: 1, pelaku: 'Pelanggan', aksi: 'Menyerahkan pakaian kotor di meja penerimaan laundry' },
        { step: 2, pelaku: actorLaundry, aksi: 'Menimbang berat pakaian, mencatat paket cuci, dan memberikan nota' },
        { step: 3, pelaku: actorLaundry, aksi: 'Menjalankan proses pencucian, pengeringan, dan penyetrikaan pakaian' },
        { step: 4, pelaku: actorLaundry, aksi: 'Melakukan pengepakan rapi dan mengubah status menjadi siap diambil' },
        { step: 5, pelaku: 'Pelanggan', aksi: 'Mengambil cucian bersih dan melakukan pelunasan tagihan' },
        { step: 6, pelaku: activeOwner, aksi: 'Memeriksa total timbangan harian dan rekap pemasukan kas toko' }
      ],
      alurPendukung: [
        {
          id: 'alur_laundry_supplies',
          nama: 'Restock Deterjen & Parfum Laundry',
          steps: [
            { pelaku: actorLaundry, aksi: 'Mencatat deterjen, pewangi, dan plastik kemasan yang menipis' },
            { pelaku: activeOwner, aksi: 'Melakukan pembelian stok deterjen dan perlengkapan cuci' }
          ]
        },
        {
          id: 'alur_laundry_complaint',
          nama: 'Penanganan Komplain Pakaian',
          steps: [
            { pelaku: 'Pelanggan', aksi: 'Melaporkan pakaian tertukar atau noda yang belum bersih' },
            { pelaku: actorLaundry, aksi: 'Melacak nomor nota pengerjaan dan mencuci ulang tanpa biaya' }
          ]
        }
      ],
      fiturPendukung: [
        { id: 'feat_wa_laundry', label: 'Kirim notifikasi WhatsApp otomatis saat cucian siap diambil' },
        { id: 'feat_label_barcode', label: 'Cetak label barcode / nomor nota pada bungkusan pakaian' },
        { id: 'feat_filter_nota', label: 'Filter riwayat transaksi berdasarkan nomor telepon atau nota' },
        { id: 'feat_catatan_biaya', label: 'Pencatatan pengeluaran harian (sabun, parfum, listrik)' },
        { id: 'feat_ekspor_laundry', label: 'Ekspor laporan kilogram cuci dan pendapatan bulanan' }
      ]
    };
  }

  // 4. Pendidikan / Bimbel / Kursus / Sekolah
  if (/sekolah|kursus|bimbel|les|guru|siswa|murid|edukasi|pelatihan|akademi/i.test(allContext)) {
    const actorGuru = activeCore;
    return {
      alurInti: [
        { step: 1, pelaku: 'Siswa / Peserta', aksi: 'Mendaftar program belajar dan memilih jadwal sesi kelas' },
        { step: 2, pelaku: actorGuru, aksi: 'Membuka sesi kelas dan mencatat absensi kehadiran siswa' },
        { step: 3, pelaku: actorGuru, aksi: 'Menyampaikan materi pembelajaran dan memberikan latihan tugas' },
        { step: 4, pelaku: 'Siswa / Peserta', aksi: 'Mengerjakan latihan dan mengumpulkan tugas belajar' },
        { step: 5, pelaku: actorGuru, aksi: 'Memeriksa tugas, memberikan nilai, dan mencatat evaluasi belajar' },
        { step: 6, pelaku: activeOwner, aksi: 'Memantau rekap kemajuan belajar dan absensi berkala siswa' }
      ],
      alurPendukung: [
        {
          id: 'alur_spp',
          nama: 'Pembayaran Iuran / SPP Belajar',
          steps: [
            { pelaku: 'Siswa / Peserta', aksi: 'Menyerahkan bukti pembayaran iuran bulanan kelas' },
            { pelaku: activeOwner, aksi: 'Memverifikasi pembayaran dan menerbitkan kwitansi resmi' }
          ]
        },
        {
          id: 'alur_izin_siswa',
          nama: 'Pengajuan Izin / Cuti Siswa',
          steps: [
            { pelaku: 'Siswa / Peserta', aksi: 'Mengajukan surat keterangan izin atau sakit ke sekolah' },
            { pelaku: actorGuru, aksi: 'Menyetujui izin dan menandai dispensasi di buku absensi' }
          ]
        }
      ],
      fiturPendukung: [
        { id: 'feat_rapor_pdf', label: 'Unduh rapor & sertifikat evaluasi belajar siswa (PDF)' },
        { id: 'feat_wa_absen', label: 'Kirim rekap absensi otomatis ke kontak orang tua/peserta' },
        { id: 'feat_jadwal_kelas', label: 'Kalender interaktif jadwal pertemuan kelas & evaluasi' },
        { id: 'feat_filter_spp', label: 'Filter riwayat pembayaran dan tunggakan iuran kursus' },
        { id: 'feat_ekspor_nilai', label: 'Ekspor rekap nilai per kelas ke format spreadsheet' }
      ]
    };
  }

  // 5. Klinik / Kesehatan / Dokter
  if (/klinik|dokter|pasien|obat|apotek|perawat|kesehatan|medis/i.test(allContext)) {
    const actorMedis = activeCore;
    return {
      alurInti: [
        { step: 1, pelaku: 'Pasien', aksi: 'Mendaftar di loket penerimaan dan mengambil nomor antrean' },
        { step: 2, pelaku: actorMedis, aksi: 'Memeriksa tanda vital awal (tensi, suhu) dan mencatat keluhan' },
        { step: 3, pelaku: actorMedis, aksi: 'Melakukan pemeriksaan medis mendalam dan menentukan diagnosis' },
        { step: 4, pelaku: actorMedis, aksi: 'Meresepkan obat dan memberikan tindakan medis yang diperlukan' },
        { step: 5, pelaku: 'Pasien', aksi: 'Melakukan pembayaran dan menerima obat di bagian farmasi' },
        { step: 6, pelaku: activeOwner, aksi: 'Memeriksa rekap kunjungan pasien dan inventaris obat harian' }
      ],
      alurPendukung: [
        {
          id: 'alur_restock_obat',
          nama: 'Pengadaan & Restock Obat Farmasi',
          steps: [
            { pelaku: actorMedis, aksi: 'Mencatat persediaan obat yang hampir habis atau mendekati kedaluwarsa' },
            { pelaku: activeOwner, aksi: 'Melakukan pemesanan ke distributor farmasi resmi' }
          ]
        },
        {
          id: 'alur_rujukan',
          nama: 'Penerbitan Surat Rujukan Pasien',
          steps: [
            { pelaku: actorMedis, aksi: 'Membuat surat rujukan medis dengan riwayat diagnosis lengkap' },
            { pelaku: activeOwner, aksi: 'Mengonfirmasi surat rujukan resmi untuk diserahkan ke pasien' }
          ]
        }
      ],
      fiturPendukung: [
        { id: 'feat_surat_dokter', label: 'Cetak surat keterangan dokter & kwitansi pembayaran (PDF)' },
        { id: 'feat_exp_alert', label: 'Peringatan otomatis obat mendekati kedaluwarsa (expired alert)' },
        { id: 'feat_rekam_medis', label: 'Pencarian cepat rekam medis pasien via nomor NIK / nama' },
        { id: 'feat_alergi_obat', label: 'Catatan riwayat alergi obat dan keluhan pasien' },
        { id: 'feat_ekspor_pasien', label: 'Ekspor laporan kunjungan dan diagnosis terbanyak bulanan' }
      ]
    };
  }

  // 6. Properti / Kos / Sewa
  if (/kos|kost|kontrakan|sewa|properti|kamar|penyewa|apartemen|rental/i.test(allContext)) {
    const actorStaf = activeCore;
    return {
      alurInti: [
        { step: 1, pelaku: 'Penyewa', aksi: 'Memilih unit kamar/properti dan mengajukan durasi sewa' },
        { step: 2, pelaku: actorStaf, aksi: 'Mengecek ketersediaan unit dan menyiapkan draft perjanjian sewa' },
        { step: 3, pelaku: 'Penyewa', aksi: 'Membayar uang sewa periode pertama dan deposit jaminan' },
        { step: 4, pelaku: actorStaf, aksi: 'Menyerahkan kunci unit dan mencatat meteran awal listrik/air' },
        { step: 5, pelaku: 'Penyewa', aksi: 'Menempati unit kamar dan menikmati fasilitas hunian' },
        { step: 6, pelaku: activeOwner, aksi: 'Mencatat pembayaran masuk dan mengatur jadwal jatuh tempo sewa' }
      ],
      alurPendukung: [
        {
          id: 'alur_keluhan_unit',
          nama: 'Pelaporan Keluhan & Perbaikan Fasilitas',
          steps: [
            { pelaku: 'Penyewa', aksi: 'Melaporkan kerusakan fasilitas (AC, kran, listrik) di sistem' },
            { pelaku: actorStaf, aksi: 'Melakukan pengecekan fisik unit dan memperbaiki kendala' }
          ]
        },
        {
          id: 'alur_checkout',
          nama: 'Pengembalian Kunci & Selesai Sewa (Check-out)',
          steps: [
            { pelaku: 'Penyewa', aksi: 'Mengonfirmasi rencana selesai masa sewa properti' },
            { pelaku: actorStaf, aksi: 'Memeriksa kelayakan kondisi kamar dan mengembalikan deposit' }
          ]
        }
      ],
      fiturPendukung: [
        { id: 'feat_wa_tagihan', label: 'Pengingat otomatis jatuh tempo tagihan sewa ke WhatsApp penyewa' },
        { id: 'feat_kwitansi_sewa', label: 'Cetak kwitansi tanda terima pembayaran sewa resmi (PDF)' },
        { id: 'feat_status_kamar', label: 'Dasbor status hunian unit kamar (Terisi / Kosong / Perbaikan)' },
        { id: 'feat_meteran_air', label: 'Catatan riwayat pencatatan meteran listrik & air per unit' },
        { id: 'feat_ekspor_sewa', label: 'Ekspor rekapitulasi pendapatan sewa tahunan' }
      ]
    };
  }

  // 7. Retail / Toko / Minimarket / POS (Default untuk retail & toko)
  if (/retail|toko|kasir|pos|warung|minimarket|sembako|butik|petshop|jual|dagang/i.test(allContext)) {
    const actorKasir = activeCore;
    const actorGudang = resolveActorForStep('Staf Gudang', session.roles);
    return {
      alurInti: [
        { step: 1, pelaku: 'Pelanggan', aksi: 'Datang ke toko dan membawa barang belanjaan ke meja kasir' },
        { step: 2, pelaku: actorKasir, aksi: 'Memindai barcode atau mencari item barang di sistem kasir' },
        { step: 3, pelaku: actorKasir, aksi: 'Mengonfirmasi rincian belanja, diskon, dan total tagihan' },
        { step: 4, pelaku: 'Pelanggan', aksi: 'Melakukan pembayaran via uang tunai, transfer, atau QRIS' },
        { step: 5, pelaku: actorKasir, aksi: 'Memproses pembayaran dan mencetak struk belanja untuk pembeli' },
        { step: 6, pelaku: activeOwner, aksi: 'Memeriksa rekap total transaksi harian dan menutup buku kas' }
      ],
      alurPendukung: [
        {
          id: 'alur_restock',
          nama: 'Pengadaan & Restock Barang',
          steps: [
            { pelaku: actorGudang, aksi: 'Memeriksa stok barang yang menipis dan mencatat kebutuhan restock' },
            { pelaku: activeOwner, aksi: 'Menerima kiriman barang dari suplier dan memperbarui jumlah stok' }
          ]
        },
        {
          id: 'alur_retur',
          nama: 'Retur & Penukaran Barang Cacat',
          steps: [
            { pelaku: 'Pelanggan', aksi: 'Membawa barang rusak beserta struk belanja untuk ditukar' },
            { pelaku: actorKasir, aksi: 'Memeriksa kelayakan kondisi barang dan bukti pembelian' },
            { pelaku: activeOwner, aksi: 'Menyetujui penggantian barang atau pengembalian dana' }
          ]
        }
      ],
      fiturPendukung: [
        { id: 'feat_cetak_struk', label: 'Cetak struk belanja kasir & invoice digital (PDF)' },
        { id: 'feat_stok_menipis', label: 'Peringatan otomatis saat stok barang mencapai batas minimum' },
        { id: 'feat_cari_produk', label: 'Filter pencarian cepat nama produk & kategori barang' },
        { id: 'feat_rekap_shift', label: 'Rekap laporan omzet dan kas masuk per shift' },
        { id: 'feat_ekspor_excel', label: 'Ekspor laporan transaksi harian ke format Excel' }
      ]
    };
  }

  // 8. Universal Fallback (Manajemen Tugas / Operasional Umum)
  return {
    alurInti: [
      { step: 1, pelaku: 'Pelanggan / Pemohon', aksi: 'Mengajukan kebutuhan pesanan atau permintaan layanan baru' },
      { step: 2, pelaku: activeCore, aksi: 'Memeriksa rincian permohonan dan mencatat data tugas di sistem' },
      { step: 3, pelaku: activeCore, aksi: 'Mengonfirmasi estimasi waktu pelaksanaan dan rincian biaya' },
      { step: 4, pelaku: 'Pelanggan / Pemohon', aksi: 'Menyetujui rincian tugas dan mengonfirmasi kesepakatan' },
      { step: 5, pelaku: activeCore, aksi: 'Melaksanakan aktivitas pekerjaan hingga selesai dengan baik' },
      { step: 6, pelaku: activeOwner, aksi: 'Memeriksa rekapitulasi laporan aktivitas dan menutup tiket pekerjaan' }
    ],
    alurPendukung: [
      {
        id: 'alur_approval',
        nama: 'Pengajuan & Persetujuan Khusus (Approval)',
        steps: [
          { pelaku: activeCore, aksi: 'Mengajukan penyesuaian biaya atau kebutuhan anggaran khusus' },
          { pelaku: activeOwner, aksi: 'Memeriksa permohonan dan memberikan persetujuan (approval)' }
        ]
      },
      {
        id: 'alur_revisi',
        nama: 'Penanganan Komplain & Revisi Pekerjaan',
        steps: [
          { pelaku: 'Pelanggan / Pemohon', aksi: 'Mengajukan catatan perbaikan jika hasil belum sesuai' },
          { pelaku: activeCore, aksi: 'Menindaklanjuti perbaikan hingga permohonan tuntas' }
        ]
      }
    ],
    fiturPendukung: [
      { id: 'feat_deadline_alert', label: 'Notifikasi pengingat tenggat waktu (deadline) otomatis' },
      { id: 'feat_filter_arsip', label: 'Filter pencarian cepat data transaksi & riwayat aktivitas' },
      { id: 'feat_ekspor_rekap', label: 'Ekspor ringkasan laporan operasional ke format Excel' },
      { id: 'feat_cetak_bukti', label: 'Cetak lembar bukti penyelesaian tugas & invoice (PDF)' },
      { id: 'feat_audit_log', label: 'Riwayat log catatan perubahan aktivitas (audit log)' }
    ]
  };
}

/**
 * Merender Alur Sistem & Fitur Pendukung ke format Markdown bersih langsung poin bernomor,
 * tanpa narasi pembuka tambahan.
 */
export function renderFlowMarkdown(flowData: DomainFlowData): string {
  const lines: string[] = [];

  lines.push('### Bagian B: Alur Sistem & Fitur Pendukung\n');

  lines.push('#### 1. Alur Inti (Aktivitas Utama)');
  flowData.alurInti.forEach((st) => {
    lines.push(`${st.step}. *(${st.pelaku})* ${st.aksi}`);
  });
  lines.push('\n*(Catatan: Alur inti di atas adalah aktivitas utama sistem yang tidak bisa dihapus, tetapi dapat disesuaikan lewat chat)*\n');

  if (flowData.alurPendukung.length > 0) {
    lines.push('#### 2. Alur Pendukung');
    flowData.alurPendukung.forEach((ap) => {
      lines.push(`- **${ap.nama}:**`);
      ap.steps.forEach((st, idx) => {
        lines.push(`  ${idx + 1}. *(${st.pelaku})* ${st.aksi}`);
      });
    });
    lines.push('');
  }

  if (flowData.fiturPendukung.length > 0) {
    lines.push('#### 3. Fitur Pendukung (MVP)');
    flowData.fiturPendukung.forEach((fp) => {
      lines.push(`- ${fp.label}`);
    });
  }

  return lines.join('\n');
}

function buildAlurStep(session: MockupSessionState): GuidedStepPayload {
  const flowData = getDomainFlowDetails(session);
  const options: GuidedStepOption[] = [];

  // 1. Alur Inti (Wajib, locked)
  options.push({
    id: 'alur_inti',
    label: 'Alur Inti (Aktivitas Utama)',
    description: `Alur proses utama dari awal hingga selesai (${flowData.alurInti.length} tahapan). Tidak dapat dihapus karena menjadi fondasi operasional.`,
    recommended: true,
    locked: true,
    roleStatus: 'WAJIB_INTI',
    category: 'ALUR_INTI',
    steps: flowData.alurInti
  });

  // 2. Alur Pendukung (1-2 opsi, selectable)
  flowData.alurPendukung.forEach((ap) => {
    options.push({
      id: ap.id,
      label: `Alur: ${ap.nama}`,
      description: ap.steps.map((s) => `(${s.pelaku}) ${s.aksi}`).join(' → '),
      recommended: true,
      locked: false,
      category: 'ALUR_PENDUKUNG',
      steps: ap.steps
    });
  });

  // 3. Fitur Pendukung (3-5 opsi, selectable)
  flowData.fiturPendukung.forEach((fp) => {
    options.push({
      id: fp.id,
      label: `Fitur: ${fp.label}`,
      description: 'Fitur pelengkap langsung masuk ke rilis MVP tanpa pemilahan V1/V2.',
      recommended: true,
      locked: false,
      category: 'FITUR_PENDUKUNG'
    });
  });

  return {
    stepId: 'ALUR',
    title: 'Alur Sistem & Fitur Pendukung',
    multi: true,
    allowOther: true,
    options
  };
}

function buildRbacStep(session: MockupSessionState): GuidedStepPayload {
  return {
    stepId: 'RBAC',
    title: 'Matriks Hak Akses & Pembagian Wewenang Role',
    multi: true,
    allowOther: false,
    options: [
      {
        id: 'rbac_confirm',
        label: 'Setujui matriks hak akses per role',
        recommended: true,
        description: 'Tampilan Depan, Penjaga Akses, dan Database'
      }
    ]
  };
}

function buildSkemaDataStep(session: MockupSessionState): GuidedStepPayload {
  return {
    stepId: 'SKEMA_DATA',
    title: 'Skema Tabel & Relasi Data Aplikasi',
    multi: true,
    allowOther: false,
    options: [
      {
        id: 'schema_confirm',
        label: 'Setujui struktur tabel & relasi data',
        recommended: true,
        description: 'Field, tipe data, dan relasi entitas utama'
      }
    ]
  };
}

function buildSimulasiDbStep(session: MockupSessionState): GuidedStepPayload {
  return {
    stepId: 'SIMULASI_DB',
    title: 'Simulasi Data Awal & Akun Demo Login',
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'simulasi_confirm',
        label: 'Setujui data contoh & akun demo',
        recommended: true,
        description: '3 baris contoh data & kredensial login per role'
      }
    ]
  };
}

function buildReviewFinalStep(session: MockupSessionState): GuidedStepPayload | null {
  return null; // REVIEW_FINAL dirangkum dalam kartu final di chat sebelum eksekusi build
}

export function buildGuidedStep(session: MockupSessionState): GuidedStepPayload | null {
  switch (session.step) {
    case 'STORYTELLING':
      return buildStorytellingStep(session);
    case 'ROLE':
      return buildRoleStep(session);
    case 'ALUR':
      return buildAlurStep(session);
    case 'RBAC':
      return buildRbacStep(session);
    case 'SKEMA_DATA':
      return buildSkemaDataStep(session);
    case 'SIMULASI_DB':
      return buildSimulasiDbStep(session);
    case 'REVIEW_FINAL':
      return buildReviewFinalStep(session);
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

  if (stepId === 'STORYTELLING') {
    const isConfirm =
      selected.includes('confirm_story') ||
      (!other && selected.length === 0 && !selected.includes('mismatch_story') && !selected.includes('minor_adjust'));
    const isMismatch = selected.includes('mismatch_story');
    const existingStory = next.storyline || {
      narasi: other || selected.join(' '),
      asumsiMasalah: '',
      asumsiAktor: next.match.contextualRoles || ['Super Admin', 'Staf', 'Pelanggan'],
      asumsiAlurUtama: '',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0
    };

    if (isMismatch && (existingStory.revisiCount || 0) < 2) {
      next.storyline = {
        ...existingStory,
        statusKonfirmasi: 'dikoreksi',
        revisiCount: (existingStory.revisiCount || 0) + 1
      };
      next.step = 'STORYTELLING';
      return next;
    }

    next.storyline = {
      ...existingStory,
      narasi: other ? `${existingStory.narasi} (Catatan: ${other})` : existingStory.narasi,
      statusKonfirmasi: isConfirm ? 'disetujui' : 'dikoreksi',
      revisiCount: existingStory.revisiCount || 0
    };
    next.step = 'ROLE';
    return next;
  } else if (stepId === 'ROLE') {
    const coreRole = detectCoreOperationalRole(session);
    let selectedRoles = dedupeRoleLabels(selected.length > 0 ? selected : [REQUIRED_ROLE, coreRole]);
    if (!selectedRoles.includes(REQUIRED_ROLE)) {
      selectedRoles = [REQUIRED_ROLE, ...selectedRoles];
    }
    if (other && other.trim() && !selectedRoles.includes(other.trim())) {
      selectedRoles.push(other.trim());
    }

    const wajib = [REQUIRED_ROLE];
    if (coreRole && coreRole !== REQUIRED_ROLE && !wajib.includes(coreRole)) {
      wajib.push(coreRole);
    }

    const tambahan = selectedRoles.filter((r) => !wajib.includes(r));

    // Cek role yang ditawarkan tapi tidak dipilih (dihapus/dideselect oleh user)
    const offeredStep = buildRoleStep(session);
    const offeredRoles = offeredStep.options.map((o) => o.id);
    const removedRoles = offeredRoles.filter((r) => !selectedRoles.includes(r) && r !== REQUIRED_ROLE);

    const tugasDilimpahkan: { dariRole: string; keRole: string; daftarTugas: string[] }[] = [];
    for (const r of removedRoles) {
      const details = getRoleNarrativeAndResponsibilities(r, session.match.businessCategory, session.storyline);
      if (details.tanggungJawab.length > 0) {
        tugasDilimpahkan.push({
          dariRole: r,
          keRole: REQUIRED_ROLE,
          daftarTugas: details.tanggungJawab
        });
      }
    }

    next.roles = {
      selected: selectedRoles,
      wajib,
      tambahan,
      tugasDilimpahkan,
      ...(other ? { other } : {})
    };
  } else if (stepId === 'ALUR') {
    const flowData = getDomainFlowDetails(session);

    // Alur inti selalu disertakan (tidak bisa dihapus)
    const alurInti =
      session.flow?.alurInti && session.flow.alurInti.length > 0
        ? session.flow.alurInti
        : flowData.alurInti;

    // Alur pendukung yang dipilih
    const selectedPendukung = flowData.alurPendukung.filter(
      (ap) =>
        selected.includes(ap.id) ||
        selected.some((s) => s.includes(ap.id) || s.includes(ap.nama))
    );

    // Fitur pendukung yang dipilih
    const selectedFitur = flowData.fiturPendukung
      .filter((fp) => selected.includes(fp.id) || selected.some((s) => s.includes(fp.label)))
      .map((fp) => fp.label);

    // Jika user menambahkan item kustom melalui "other"
    if (other && other.trim()) {
      const customItems = other
        .split(/[,;\n]+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && !/^(ya|oke|ok|lanjut|setuju|mantap)\b/i.test(x));
      customItems.forEach((ci) => {
        if (!selectedFitur.includes(ci)) {
          selectedFitur.push(ci);
        }
      });
    }

    next.flow = {
      alurInti,
      alurPendukung: selectedPendukung.map((ap) => ({
        nama: ap.nama,
        steps: ap.steps
      })),
      fiturPendukung: selectedFitur,
      ...(other ? { other } : {})
    };
  } else if (stepId === 'RBAC') {
    // Diproses di Poin 5
  } else if (stepId === 'SKEMA_DATA') {
    // Diproses di Poin 6
  } else if (stepId === 'SIMULASI_DB') {
    // Diproses di Poin 7
  } else if (stepId === 'REVIEW_FINAL') {
    // Diproses di Poin 8
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
  if (!session.roles?.selected || session.roles.selected.length === 0) {
    missing.push('Minimal 1 peran aplikasi dipilih');
  }
  if (!session.flow?.selectedId && (!session.flow?.alurInti || session.flow.alurInti.length === 0)) {
    missing.push('Alur kerja utama belum dipilih');
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
  const wajib = session.features?.selected?.filter((f) => f.priority === 'WAJIB') || [];
  const nyusul = session.features?.selected?.filter((f) => f.priority === 'NYUSUL') || [];

  const appName =
    (meta.appName && meta.appName.trim()) ||
    (session.match.businessCategory
      ? (session.match.businessCategory.toLowerCase().startsWith('aplikasi')
          ? session.match.businessCategory
          : `Aplikasi ${session.match.businessCategory}`)
      : (overlays[0] ? `Aplikasi ${overlays[0].nama}` : meta.templateName ? `Aplikasi ${meta.templateName}` : 'Aplikasi Baru'));

  const tierLabel = session.match.tier === 'ADVANCE' ? 'ADVANCE' : 'BASIC';

  const stateLabels: string[] = [];
  patterns.forEach((p) => p.stages.slice(0, 6).forEach((s) => stateLabels.push(s.label)));
  const uniqueStates = Array.from(new Set(stateLabels));

  const lines: string[] = [];
  lines.push('📋 **Brief Kebutuhan**');
  lines.push(`- **Nama App**: ${appName}`);
  if (session.storyline?.narasi) {
    const cleanNarasi = session.storyline.narasi
      .replace(/Apakah ini sudah menggambarkan[\s\S]*$/i, '')
      .trim();
    if (cleanNarasi) {
      lines.push(`- **Gambaran Proses Bisnis**: ${cleanNarasi}`);
    }
  }
  if (session.storyline?.asumsiMasalah) {
    lines.push(`- **Masalah Utama**: ${session.storyline.asumsiMasalah}`);
  }
  if (session.storyline?.asumsiAlurUtama) {
    lines.push(`- **Alur Utama (Storyline)**: ${session.storyline.asumsiAlurUtama}`);
  }
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

  if (session.flow?.alurInti && session.flow.alurInti.length > 0) {
    lines.push('- **Alur Inti (Aktivitas Utama)**:');
    session.flow.alurInti.forEach((s) => {
      lines.push(`  ${s.step}. *(${s.pelaku})* ${s.aksi}`);
    });
  }

  if (session.flow?.alurPendukung && session.flow.alurPendukung.length > 0) {
    lines.push('- **Alur Pendukung**:');
    session.flow.alurPendukung.forEach((ap) => {
      lines.push(`  * **${ap.nama}**:`);
      ap.steps.forEach((s, idx) => {
        lines.push(`    ${idx + 1}. *(${s.pelaku})* ${s.aksi}`);
      });
    });
  }

  if (session.flow?.fiturPendukung && session.flow.fiturPendukung.length > 0) {
    lines.push('- **Fitur Pendukung (MVP)**:');
    session.flow.fiturPendukung.forEach((fp, idx) => {
      lines.push(`  ${idx + 1}. ${fp}`);
    });
  } else if (wajib.length) {
    lines.push('- **Fitur Pendukung (MVP)**:');
    wajib.forEach((f, i) => {
      const info = features.find((x) => x.id === f.id);
      lines.push(`  ${i + 1}. ${info?.label ?? f.id}`);
    });
  }

  const roles = session.roles.selected;
  if (roles.length) {
    lines.push('- **Ringkasan Role & Status Wewenang**:');
    lines.push(`  - **Role Wajib**: ${(session.roles.wajib || [REQUIRED_ROLE]).join(', ')}`);
    if (session.roles.tambahan && session.roles.tambahan.length > 0) {
      lines.push(`  - **Role Tambahan**: ${session.roles.tambahan.join(', ')}`);
    }
    if (session.roles.tugasDilimpahkan && session.roles.tugasDilimpahkan.length > 0) {
      lines.push('  - **Pelimpahan Tugas Role**:');
      session.roles.tugasDilimpahkan.forEach((d) => {
        lines.push(`    * Dari ${d.dariRole} ke ${d.keRole}: ${d.daftarTugas.join('; ')}`);
      });
    }
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
        const cat = getRoleCategory(role);
        let pageName = 'Operasional & Layanan (default)';
        let roleSections: string[] = [];

        if (cat === 'external') {
          if (/sewa|nyewa|rental|booking|peminjam/i.test(role)) {
            pageName = 'Katalog & Sewa Mandiri (default)';
          } else if (/pasien|klinik|antri/i.test(role)) {
            pageName = 'Pendaftaran & Antrean Mandiri (default)';
          } else if (/siswa|murid|pelajar/i.test(role)) {
            pageName = 'Portal Belajar & Jadwal (default)';
          } else if (/anggota|member/i.test(role)) {
            pageName = 'Kartu Digital & Iuran (default)';
          } else {
            pageName = 'Layanan & Pemesanan Mandiri (default)';
          }

          // Filter fitur yang relevan untuk pengguna eksternal / pelanggan (hilangkan fitur khusus staf)
          const customerFeatures = wajib
            .map((f) => features.find((x) => x.id === f.id)?.label)
            .filter((lbl): lbl is string => Boolean(lbl))
            .filter((lbl) => {
              const isStaffOnly = /akun staf|staf|karyawan|serah terima|cek fisik|pengembalian unit|kalkulator denda|opname|disposal|mutasi|audit|omset/i.test(lbl);
              return !isStaffOnly;
            });

          if (customerFeatures.length > 0) {
            roleSections = customerFeatures.slice(0, 4);
          } else {
            roleSections = ['Katalog & Ketersediaan', 'Form Pemesanan / Sewa Mandiri', 'Status & Riwayat Saya'];
          }
        } else if (cat === 'business') {
          pageName = 'Dashboard & Laporan (default)';
          const businessFeatures = wajib
            .map((f) => features.find((x) => x.id === f.id)?.label)
            .filter((lbl): lbl is string => Boolean(lbl))
            .filter((lbl) => /laporan|omset|rekap|analisis|dashboard|statistik|performa|ringkasan/i.test(lbl));

          if (businessFeatures.length > 0) {
            roleSections = businessFeatures.slice(0, 4);
          } else {
            roleSections = ['Ringkasan Performa & Omset', 'Laporan Transaksi', 'Monitoring Operasional'];
          }
        } else {
          // Operational role (Petugas Rental, Kasir, Washer, Montir, dll)
          if (/rental|sewa/i.test(role)) {
            pageName = 'Operasional Rental (default)';
          } else if (/kasir|cashier/i.test(role)) {
            pageName = 'Kasir & Transaksi (default)';
          } else if (/washer|cuci/i.test(role)) {
            pageName = 'Antrean Pengerjaan Cuci (default)';
          } else if (/gudang|stok|warehouse/i.test(role)) {
            pageName = 'Stok & Gudang (default)';
          } else {
            pageName = `Operasional ${role.trim()} (default)`;
          }

          const opFeatures = wajib
            .map((f) => features.find((x) => x.id === f.id)?.label)
            .filter((lbl): lbl is string => Boolean(lbl))
            .filter((lbl) => {
              const isCustomerOnly = /mandiri|kartu saya|pesanan saya|portal belajar/i.test(lbl);
              return !isCustomerOnly;
            });

          if (opFeatures.length > 0) {
            roleSections = opFeatures.slice(0, 5);
          } else {
            roleSections = ['Katalog & Ketersediaan Unit', 'Pencatatan Transaksi', 'Update Status & Proses'];
          }
        }

        const sectionText = roleSections.length
          ? `: section ${roleSections.join(', section ')}`
          : '';
        lines.push(`    - ${pageName}${sectionText}`);
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
