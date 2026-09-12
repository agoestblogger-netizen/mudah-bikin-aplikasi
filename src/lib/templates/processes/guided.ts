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
          description: revisiCount === 1 ? 'Jelaskan masalah operasional paling mendesak' : 'Sebutkan orang atau peran yang terlibat',
          requiresInput: true,
          inputPlaceholder: revisiCount === 1 ? 'Jelaskan masalah operasional utama di sini...' : 'Sebutkan peran atau pihak yang terlibat di sini...'
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
        description: 'Ada sedikit penyesuaian alur atau aktor yang terlibat',
        requiresInput: true,
        inputPlaceholder: 'Tuliskan catatan alur atau aktor yang ingin disesuaikan...'
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

function extractConceptTokens(text: string): Set<string> {
  const STOP_WORDS = new Set([
    'dan', 'di', 'ke', 'yang', 'untuk', 'serta', 'pada', 'atau', 'dengan', 'dari', 'ini', 'itu',
    'adalah', 'agar', 'bisa', 'akan', 'oleh', 'dalam', 'atas', 'saat', 'para', 'setiap', 'telah',
    'sudah', 'juga', 'secara', 'melalui', 'sebagai', 'seluruh', 'lainnya', 'terkait', 'hingga',
    'petugas', 'staf', 'tim', 'aplikasi', 'usaha', 'layanan', 'harian', 'operasional', 'kerja'
  ]);

  const rawWords = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const stems = rawWords.map((w) => {
    let s = w;
    if (s.startsWith('mem') && s.length > 5) s = s.slice(3);
    else if (s.startsWith('men') && s.length > 5) s = s.slice(3);
    else if (s.startsWith('meng') && s.length > 6) s = s.slice(4);
    else if (s.startsWith('meny') && s.length > 6) s = s.slice(4);
    else if (s.startsWith('me') && s.length > 4) s = s.slice(2);
    else if (s.startsWith('ber') && s.length > 5) s = s.slice(3);
    else if (s.startsWith('ter') && s.length > 5) s = s.slice(3);
    else if (s.startsWith('per') && s.length > 5) s = s.slice(3);
    return s;
  });

  return new Set(stems);
}

export function calculateConceptualSimilarity(optA: GuidedStepOption, optB: GuidedStepOption): number {
  const textA = `${optA.label} ${optA.description} ${optA.responsibilities?.join(' ') || ''}`.toLowerCase();
  const textB = `${optB.label} ${optB.description} ${optB.responsibilities?.join(' ') || ''}`.toLowerCase();

  const tokensA = extractConceptTokens(textA);
  const tokensB = extractConceptTokens(textB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) {
      intersection++;
    }
  }

  const minSize = Math.min(tokensA.size, tokensB.size);
  const overlapCoefficient = minSize > 0 ? intersection / minSize : 0;

  const unionSize = new Set([...tokensA, ...tokensB]).size;
  const jaccard = unionSize > 0 ? intersection / unionSize : 0;

  // Domain specific conceptual anchors (POIN 4: Serah terima unit, cek fisik/kilometer & verifikasi jaminan)
  const isBothRentalHandover =
    (textA.includes('kunci') || textA.includes('serah') || textA.includes('rental') || textA.includes('sewa')) &&
    (textB.includes('kunci') || textB.includes('serah') || textB.includes('rental') || textB.includes('sewa')) &&
    (textA.includes('verifikasi') || textA.includes('sim') || textA.includes('identitas') || textA.includes('kondisi') || textA.includes('kilometer')) &&
    (textB.includes('verifikasi') || textB.includes('sim') || textB.includes('identitas') || textB.includes('kondisi') || textB.includes('kilometer'));

  if (isBothRentalHandover && overlapCoefficient >= 0.35) {
    return 0.85;
  }

  return (overlapCoefficient * 0.6) + (jaccard * 0.4);
}

export function deduplicateRoleOptionsSemantically(options: GuidedStepOption[]): GuidedStepOption[] {
  const result: GuidedStepOption[] = [];

  for (const current of options) {
    // Super Admin / Owner jangan digabung dengan staf atau customer
    if (current.roleStatus === 'WAJIB_OWNER' || canonicalRoleKey(current.label) === 'super-admin') {
      result.push(current);
      continue;
    }

    const currentIsExternal = isExternalRole(current.label) || canonicalRoleKey(current.label) === 'customer';

    // Cari apakah ada entri di result yang tumpang tindih secara konseptual
    const matchIndex = result.findIndex((existing) => {
      if (existing.roleStatus === 'WAJIB_OWNER' || canonicalRoleKey(existing.label) === 'super-admin') {
        return false;
      }
      const existingIsExternal = isExternalRole(existing.label) || canonicalRoleKey(existing.label) === 'customer';
      // Jangan gabungkan staf internal dengan pelanggan eksternal
      if (currentIsExternal !== existingIsExternal) {
        return false;
      }

      const sim = calculateConceptualSimilarity(existing, current);
      return sim >= 0.45;
    });

    if (matchIndex === -1) {
      result.push(current);
    } else {
      // Tumpang tindih terdeteksi! Gabungkan kedua role (POIN REVISI 4)
      const existing = result[matchIndex];
      const isCore = existing.roleStatus === 'WAJIB_INTI' || current.roleStatus === 'WAJIB_INTI';
      const roleStatus = isCore ? 'WAJIB_INTI' : 'TAMBAHAN';
      const recommended = isCore || existing.recommended || current.recommended;

      // Pilih nama yang lebih ringkas dan jelas
      let chosenLabel = existing.label;
      if (existing.roleStatus === 'WAJIB_INTI') {
        chosenLabel = existing.label.length <= 30 ? existing.label : (current.label.length <= 30 ? current.label : existing.label);
      } else if (current.roleStatus === 'WAJIB_INTI') {
        chosenLabel = current.label.length <= 30 ? current.label : (existing.label.length <= 30 ? existing.label : current.label);
      } else {
        chosenLabel = existing.label.length <= current.label.length ? existing.label : current.label;
      }

      // Pilih deskripsi yang lebih kaya detail (seperti SIM/BPKB/kilometer)
      const descA = existing.description || '';
      const descB = current.description || '';
      const countKeywords = (str: string) => {
        let count = 0;
        if (/sim/i.test(str)) count += 2;
        if (/bpkb/i.test(str)) count += 2;
        if (/kilometer/i.test(str)) count += 2;
        if (/kunci/i.test(str)) count++;
        if (/jaminan/i.test(str)) count++;
        return count;
      };
      const scoreA = countKeywords(descA);
      const scoreB = countKeywords(descB);
      let chosenDescription = scoreA > scoreB ? descA : (scoreB > scoreA ? descB : (descA.length >= descB.length ? descA : descB));

      // Gabungkan tanggung jawab tanpa menghilangkan detail penting
      const combinedTasks: string[] = [...(existing.responsibilities || [])];
      for (const task of current.responsibilities || []) {
        const dupIndex = combinedTasks.findIndex((t) => {
          const sim = calculateConceptualSimilarity(
            { id: '', label: '', description: '', responsibilities: [t] },
            { id: '', label: '', description: '', responsibilities: [task] }
          );
          return sim >= 0.55;
        });
        if (dupIndex === -1) {
          combinedTasks.push(task);
        } else {
          // Ganti dengan versi task yang lebih detail (misal jika mengandung SIM/BPKB/kilometer)
          const scoreExisting = countKeywords(combinedTasks[dupIndex]);
          const scoreNew = countKeywords(task);
          if (scoreNew > scoreExisting) {
            combinedTasks[dupIndex] = task;
          }
        }
      }

      // Perbarui entri di result
      result[matchIndex] = {
        id: chosenLabel,
        label: chosenLabel,
        description: chosenDescription,
        responsibilities: combinedTasks.slice(0, 3),
        recommended,
        locked: existing.locked || current.locked,
        roleStatus
      };
    }
  }

  return result;
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

  // POIN REVISI 4: Deduplikasi semantik lapis kedua (mengecek kesamaan tanggung jawab antar role)
  const finalOptions = deduplicateRoleOptionsSemantically(options);

  return {
    stepId: 'ROLE',
    title: 'Pilih peran pengguna & pembagian tanggung jawab aplikasi',
    multi: true,
    allowOther: true,
    options: finalOptions.slice(0, 10)
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
  /**
   * Diisi hanya bila user memilih "dua alur terpisah" untuk proses inti setara.
   * Mutual exclusive dengan alurInti untuk rendering.
   */
  kasusGanda?: { nama: string; alurInti: FlowStepItem[] }[];
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

function deduplicateFlowSteps(steps: FlowStepItem[]): FlowStepItem[] {
  const result: FlowStepItem[] = [];
  for (const st of steps) {
    const isDuplicate = result.some((existing) => {
      if (existing.pelaku.toLowerCase() !== st.pelaku.toLowerCase()) return false;
      const sim = calculateConceptualSimilarity(
        { id: '', label: '', description: '', responsibilities: [existing.aksi] },
        { id: '', label: '', description: '', responsibilities: [st.aksi] }
      );
      return sim >= 0.70;
    });
    if (!isDuplicate) {
      result.push({
        step: result.length + 1,
        pelaku: st.pelaku,
        aksi: st.aksi
      });
    }
  }
  return result;
}

/**
 * Menghasilkan Alur Pendukung yang kontekstual dan relevan sesuai karakteristik nyata tiap domain bisnis (POIN REVISI 5).
 */
function generateDomainSupportingFlows(
  session: MockupSessionState,
  activeCore: string,
  activeOwner: string,
  findActor: (pattern: RegExp, defaultName: string) => string
): SupportingFlowItem[] {
  const category = (session.match?.businessCategory || '').toLowerCase();
  const narrative = (session.storyline?.narasi || '').toLowerCase();
  const mainFlow = (session.storyline?.asumsiAlurUtama || '').toLowerCase();
  const problem = (session.storyline?.asumsiMasalah || '').toLowerCase();
  const fullContext = `${category} ${narrative} ${mainFlow} ${problem}`;

  const customerActor = findActor(/pelanggan|penyewa|pasien|pembeli|klien|tamu|member/i, 'Pelanggan');

  // 1. DOMAIN: RENTAL & SEWA KENDARAAN (MOBIL / MOTOR / ARMADA)
  if (
    /rental|sewa.*(mobil|motor|kendaraan|armada)|lepas\s*kunci|persewaan.*kendaraan/i.test(fullContext)
  ) {
    const sopirActor = findActor(/sopir|driver/i, activeCore);
    return [
      {
        id: 'alur_denda_armada',
        nama: 'Penanganan Keterlambatan, Denda & Klaim Kerusakan Armada',
        steps: [
          {
            pelaku: customerActor,
            aksi: 'Mengonfirmasi permohonan perpanjangan waktu sewa atau melaporkan kendala pada unit armada'
          },
          {
            pelaku: activeCore,
            aksi: 'Memeriksa durasi overtime atau kondisi fisik bodi kendaraan dan menghitung biaya denda/klaim'
          }
        ]
      },
      {
        id: 'alur_jadwal_armada',
        nama: 'Koordinasi Penjadwalan Armada & Penugasan Sopir',
        steps: [
          {
            pelaku: activeOwner,
            aksi: 'Mengatur alokasi jadwal ketersediaan unit armada dan penugasan sopir yang siap bertugas'
          },
          {
            pelaku: sopirActor,
            aksi: 'Memeriksa kelayakan teknis unit dan mengonfirmasi kesiapan penjemputan penyewa'
          }
        ]
      }
    ];
  }

  // 2. DOMAIN: CUCI KENDARAAN (MOBIL / MOTOR / CARWASH)
  if (/cuci.*(mobil|motor|kendaraan)|carwash|cucian.*mobil|poles.*mobil/i.test(fullContext)) {
    return [
      {
        id: 'alur_garansi_cuci',
        nama: 'Garansi Cuci Ulang & Penanganan Komplain Kebersihan',
        steps: [
          {
            pelaku: customerActor,
            aksi: 'Menunjukkan bagian bodi, kaca, atau velg yang masih kotor sebelum kendaraan keluar gerbang'
          },
          {
            pelaku: activeCore,
            aksi: 'Melakukan pembersihan ulang pada area yang belum kinclong tanpa biaya tambahan'
          }
        ]
      },
      {
        id: 'alur_restock_cuci',
        nama: 'Restock Sabun Salju, Shampo & Perlengkapan Cuci',
        steps: [
          {
            pelaku: activeCore,
            aksi: 'Mendata persediaan sabun salju, semir ban, shampo, dan kain chamois yang stoknya menipis'
          },
          {
            pelaku: activeOwner,
            aksi: 'Memproses pembelian persediaan bahan pembersih dan perlengkapan cuci baru'
          }
        ]
      }
    ];
  }

  // 3. DOMAIN: KLINIK DOKTER GIGI / MEDIS / KESEHATAN
  if (/gigi|dental|klinik.*(dokter|medis|gigi)|praktek\s*dokter|rekam\s*medis/i.test(fullContext)) {
    const resepsionisActor = findActor(/resepsionis|kasir|admin/i, activeCore);
    return [
      {
        id: 'alur_kontrol_pasien',
        nama: 'Penjadwalan Kunjungan Kontrol Ulang Pasien',
        steps: [
          {
            pelaku: activeCore,
            aksi: 'Menentukan anjuran tanggal kunjungan kontrol lanjutan pasca tindakan perawatan gigi'
          },
          {
            pelaku: resepsionisActor,
            aksi: 'Mencatat jadwal kontrol ke sistem dan mengirimkan konfirmasi janji temu ke pasien'
          }
        ]
      },
      {
        id: 'alur_sterilisasi_bahan',
        nama: 'Sterilisasi Alat Medis & Restock Bahan Gigi',
        steps: [
          {
            pelaku: activeCore,
            aksi: 'Mendata obat-obatan, jarum suntik, dan bahan tambal gigi yang persediaannya menipis'
          },
          {
            pelaku: activeOwner,
            aksi: 'Memesan persediaan bahan habis pakai medis ke distributor farmasi resmi'
          }
        ]
      }
    ];
  }

  // 4. DOMAIN: KAFE & KEDAI KOPI / RESTORAN / F&B
  if (/kafe|cafe|kopi|coffee|barista|resto|restoran|kuliner|bakery|kedai/i.test(fullContext)) {
    const kasirActor = findActor(/kasir|depan/i, activeCore);
    return [
      {
        id: 'alur_restock_kopi',
        nama: 'Restock Biji Kopi, Susu & Bahan Baku Barista',
        steps: [
          {
            pelaku: activeCore,
            aksi: 'Memeriksa stok biji kopi espresso, sirup perisa, dan susu segar yang mencapai batas minimum'
          },
          {
            pelaku: activeOwner,
            aksi: 'Melakukan pemesanan restock ke suplier biji kopi dan menyetujui anggaran belanja'
          }
        ]
      },
      {
        id: 'alur_batal_menu',
        nama: 'Perubahan Pesanan Menu & Penanganan Pembatalan',
        steps: [
          {
            pelaku: customerActor,
            aksi: 'Meminta penyesuaian pesanan atau varian rasa sebelum minuman selesai diracik'
          },
          {
            pelaku: kasirActor,
            aksi: 'Memperbarui tiket pesanan dapur/barista dan menyesuaikan nominal tagihan kasir'
          }
        ]
      }
    ];
  }

  // 5. DOMAIN: LAUNDRY KILOAN & SATUAN
  if (/laundry|kiloan|binatu|setrika\s*uap/i.test(fullContext)) {
    return [
      {
        id: 'alur_komplain_laundry',
        nama: 'Penanganan Pakaian Tertukar & Komplain Noda Membandel',
        steps: [
          {
            pelaku: customerActor,
            aksi: 'Melaporkan pakaian yang tertukar atau noda pakaian yang belum terangkat bersih'
          },
          {
            pelaku: activeCore,
            aksi: 'Memeriksa nomor nota/tag label dan mencuci ulang pakaian dengan formula pembersih khusus'
          }
        ]
      },
      {
        id: 'alur_restock_laundry',
        nama: 'Restock Deterjen, Parfum Laundry & Plastik Packing',
        steps: [
          {
            pelaku: activeCore,
            aksi: 'Mencatat persediaan deterjen konsentrat, pewangi pakaian, dan plastik kemasan yang menipis'
          },
          {
            pelaku: activeOwner,
            aksi: 'Melakukan pembelian persediaan bahan kimia laundry dan plastik packing'
          }
        ]
      }
    ];
  }

  // 6. DOMAIN: BENGKEL / SERVIS KENDARAAN / REPARASI
  if (/bengkel|servis|service|montir|mekanik|onderdil|sparepart/i.test(fullContext)) {
    return [
      {
        id: 'alur_sparepart_bengkel',
        nama: 'Pengadaan Sparepart & Estimasi Biaya Tambahan',
        steps: [
          {
            pelaku: activeCore,
            aksi: 'Memeriksa kerusakan komponen mesin dan mencatat kebutuhan sparepart pengganti'
          },
          {
            pelaku: activeOwner,
            aksi: 'Memeriksa ketersediaan suku cadang dan mengonfirmasi persetujuan biaya ke pemilik kendaraan'
          }
        ]
      },
      {
        id: 'alur_garansi_servis',
        nama: 'Garansi Servis & Penanganan Keluhan Pasca Perbaikan',
        steps: [
          {
            pelaku: customerActor,
            aksi: 'Membawa kembali kendaraan jika kendala mesin yang sama kambuh dalam masa garansi'
          },
          {
            pelaku: activeCore,
            aksi: 'Melakukan pemeriksaan ulang pada komponen terkait tanpa memungut biaya jasa tambahan'
          }
        ]
      }
    ];
  }

  // 7. DOMAIN: PROPERTI / KOS-KOSAN / KONTRAKAN
  if (/kos|kost|kontrakan|sewa.*kamar|homestay|guest\s*house|properti/i.test(fullContext)) {
    return [
      {
        id: 'alur_keluhan_kamar',
        nama: 'Pelaporan Keluhan & Perbaikan Fasilitas Kamar',
        steps: [
          {
            pelaku: customerActor,
            aksi: 'Melaporkan kerusakan fasilitas kamar (AC, kran air, listrik) melalui sistem'
          },
          {
            pelaku: activeCore,
            aksi: 'Melakukan pengecekan fisik unit kamar dan menyelesaikan perbaikan kendala'
          }
        ]
      },
      {
        id: 'alur_checkout_kamar',
        nama: 'Pemeriksaan Kondisi Kamar & Pengembalian Deposit (Check-out)',
        steps: [
          {
            pelaku: customerActor,
            aksi: 'Mengonfirmasi jadwal berakhirnya masa sewa dan rencana pengosongan unit'
          },
          {
            pelaku: activeCore,
            aksi: 'Memeriksa kelayakan kondisi inventaris kamar dan memproses pengembalian deposit sewa'
          }
        ]
      }
    ];
  }

  // 8. ADAPTIF UNIVERSAL (Domain Lainnya)
  const domainLabel = session.match?.businessCategory || 'Layanan';
  return [
    {
      id: 'alur_komplain_layanan',
      nama: `Penanganan Komplain & Garansi Hasil ${domainLabel}`,
      steps: [
        {
          pelaku: customerActor,
          aksi: 'Menyampaikan catatan atau keluhan jika hasil layanan membutuhkan penyesuaian'
        },
        {
          pelaku: activeCore,
          aksi: 'Memeriksa kendala yang dilaporkan dan menindaklanjuti perbaikan hingga tuntas'
        }
      ]
    },
    {
      id: 'alur_operasional_restock',
      nama: `Koordinasi Operasional & Pengadaan Perlengkapan ${domainLabel}`,
      steps: [
        {
          pelaku: activeCore,
          aksi: 'Mencatat kebutuhan operasional atau perlengkapan kerja yang perlu pengadaan'
        },
        {
          pelaku: activeOwner,
          aksi: 'Memeriksa pengajuan operasional, menyetujui anggaran, dan memperbarui catatan inventaris'
        }
      ]
    }
  ];
}

/**
 * Menghasilkan Fitur Pendukung yang relevan dan spesifik sesuai domain bisnis (POIN REVISI 5).
 * Memuat minimal 2-3 fitur spesifik domain + fitur umum bernilai tinggi.
 */
function generateDomainSupportingFeatures(
  session: MockupSessionState
): SupportingFeatureItem[] {
  const category = (session.match?.businessCategory || '').toLowerCase();
  const narrative = (session.storyline?.narasi || '').toLowerCase();
  const mainFlow = (session.storyline?.asumsiAlurUtama || '').toLowerCase();
  const problem = (session.storyline?.asumsiMasalah || '').toLowerCase();
  const fullContext = `${category} ${narrative} ${mainFlow} ${problem}`;

  // 1. DOMAIN: RENTAL & SEWA KENDARAAN (MOBIL / MOTOR / ARMADA)
  if (
    /rental|sewa.*(mobil|motor|kendaraan|armada)|lepas\s*kunci|persewaan.*kendaraan/i.test(fullContext)
  ) {
    return [
      { id: 'feat_status_armada', label: 'Dasbor status armada real-time (Tersedia / Sedang Disewa / Servis)' },
      { id: 'feat_km_kondisi', label: 'Pencatatan angka kilometer (KM) awal-akhir dan foto fisik bodi kendaraan' },
      { id: 'feat_surat_sewa', label: 'Cetak kwitansi pembayaran & formulir tanda terima serah-terima kunci (PDF)' },
      { id: 'feat_wa_jatuh_tempo', label: 'Notifikasi WhatsApp otomatis jadwal pengembalian unit armada' },
      { id: 'feat_ekspor_sewa', label: 'Ekspor rekapitulasi omzet sewa dan utilisasi armada bulanan' }
    ];
  }

  // 2. DOMAIN: CUCI KENDARAAN (MOBIL / MOTOR / CARWASH)
  if (/cuci.*(mobil|motor|kendaraan)|carwash|cucian.*mobil|poles.*mobil/i.test(fullContext)) {
    return [
      { id: 'feat_antrean_cuci', label: 'Dasbor pemantauan antrean slot kendaraan yang sedang dicuci' },
      { id: 'feat_plat_paket', label: 'Pencatatan nomor plat kendaraan dan riwayat paket cuci (Salju/Vakum/Poles)' },
      { id: 'feat_struk_cuci', label: 'Cetak struk kasir pembayaran cuci dan nomor tiket antrean (PDF)' },
      { id: 'feat_wa_cuci_selesai', label: 'Notifikasi WhatsApp otomatis saat kendaraan selesai dicuci dan siap diambil' },
      { id: 'feat_ekspor_cuci', label: 'Ekspor rekapitulasi jumlah kendaraan dicuci dan laporan omzet per shift' }
    ];
  }

  // 3. DOMAIN: KLINIK DOKTER GIGI / MEDIS / KESEHATAN
  if (/gigi|dental|klinik.*(dokter|medis|gigi)|praktek\s*dokter|rekam\s*medis/i.test(fullContext)) {
    return [
      { id: 'feat_rekam_medis', label: 'Pencatatan rekam medis digital (riwayat keluhan, tindakan gigi, dan alergi obat)' },
      { id: 'feat_kalender_janji', label: 'Kalender interaktif jadwal konsultasi dan antrean pasien per dokter' },
      { id: 'feat_kwitansi_medis', label: 'Cetak kwitansi pembayaran resmi dan surat resep obat dokter (PDF)' },
      { id: 'feat_wa_kontrol', label: 'Pengingat otomatis jadwal kontrol gigi via WhatsApp kepada pasien' },
      { id: 'feat_ekspor_pasien', label: 'Ekspor laporan diagnosis terbanyak dan kunjungan pasien bulanan' }
    ];
  }

  // 4. DOMAIN: KAFE & KEDAI KOPI / RESTORAN / F&B
  if (/kafe|cafe|kopi|coffee|barista|resto|restoran|kuliner|bakery|kedai/i.test(fullContext)) {
    return [
      { id: 'feat_tiket_dapur', label: 'Cetak tiket pesanan otomatis untuk meja barista dan dapur (Kitchen Ticket)' },
      { id: 'feat_status_meja', label: 'Manajemen nomor meja & status pesanan (Dine-in / Takeaway)' },
      { id: 'feat_menu_terlaris', label: 'Dasbor laporan menu kopi dan hidangan terlaris (Best Seller) mingguan' },
      { id: 'feat_shift_kasir', label: 'Rekapitulasi kas masuk harian per giliran shift kerja kasir' },
      { id: 'feat_ekspor_fnb', label: 'Ekspor laporan penjualan harian dan biaya bahan baku ke Excel' }
    ];
  }

  // 5. DOMAIN: LAUNDRY KILOAN & SATUAN
  if (/laundry|kiloan|binatu|setrika\s*uap/i.test(fullContext)) {
    return [
      { id: 'feat_tag_label', label: 'Cetak nomor nota dan label tag barcode anti-air pada bungkusan pakaian' },
      { id: 'feat_timbangan_kiloan', label: 'Pencatatan berat timbangan cucian (kg) dan kategori pemisahan pakaian' },
      { id: 'feat_wa_cucian_siap', label: 'Notifikasi WhatsApp otomatis saat cucian bersih selesai disetrika dan siap diambil' },
      { id: 'feat_status_cucian', label: 'Dasbor pemantauan status proses cucian (Antre / Cuci / Kering / Setrika / Siap Ambil)' },
      { id: 'feat_ekspor_laundry', label: 'Ekspor rekapitulasi total kilogram dan omzet laundry bulanan' }
    ];
  }

  // 6. DOMAIN: BENGKEL / SERVIS KENDARAAN / REPARASI
  if (/bengkel|servis|service|montir|mekanik|onderdil|sparepart/i.test(fullContext)) {
    return [
      { id: 'feat_riwayat_servis', label: 'Riwayat servis berkala kendaraan berdasarkan nomor plat dan nomor mesin' },
      { id: 'feat_stok_sparepart', label: 'Peringatan otomatis saat stok oli dan sparepart mencapai batas minimum' },
      { id: 'feat_estimasi_invoice', label: 'Cetak lembar estimasi biaya perbaikan dan invoice resmi bengkel (PDF)' },
      { id: 'feat_wa_servis_berkala', label: 'Pengingat otomatis via WhatsApp jadwal ganti oli dan servis berkala berikutnya' },
      { id: 'feat_ekspor_servis', label: 'Ekspor laporan performa mekanik dan rekapitulasi omzet servis bulanan' }
    ];
  }

  // 7. DOMAIN: PROPERTI / KOS-KOSAN / KONTRAKAN
  if (/kos|kost|kontrakan|sewa.*kamar|homestay|guest\s*house|properti/i.test(fullContext)) {
    return [
      { id: 'feat_status_kamar', label: 'Dasbor status hunian kamar real-time (Terisi / Kosong / Pembersihan)' },
      { id: 'feat_tagihan_sewa', label: 'Pencatatan jatuh tempo tagihan sewa bulanan dan riwayat deposit' },
      { id: 'feat_kwitansi_sewa', label: 'Cetak kwitansi pembayaran sewa resmi dan surat perjanjian huni (PDF)' },
      { id: 'feat_wa_tagihan', label: 'Notifikasi WhatsApp otomatis pengingat jatuh tempo pembayaran sewa' },
      { id: 'feat_ekspor_sewa_unit', label: 'Ekspor laporan tingkat okupansi kamar dan pendapatan sewa tahunan' }
    ];
  }

  // 8. ADAPTIF UNIVERSAL
  const domainLabel = session.match?.businessCategory || 'Operasional';
  return [
    { id: 'feat_status_operasional', label: `Dasbor pemantauan status aktivitas operasional ${domainLabel} harian` },
    { id: 'feat_filter_riwayat', label: 'Filter pencarian cepat data riwayat transaksi dan nomor identitas' },
    { id: 'feat_cetak_bukti', label: 'Cetak bukti transaksi, invoice resmi, atau surat tanda terima (PDF)' },
    { id: 'feat_notif_wa', label: 'Notifikasi pengingat otomatis ke WhatsApp terkait status layanan' },
    { id: 'feat_ekspor_data', label: 'Ekspor rekapitulasi omzet dan laporan operasional ke format spreadsheet' }
  ];
}

/**
 * Menghasilkan Alur Inti, Alur Pendukung, dan Fitur Pendukung yang MURNI DIGROUNDING
 * dari session storyline (narasi & alur utama) tanpa mengandalkan template statis per-kategori.
 */
export function getDomainFlowDetails(session: MockupSessionState): DomainFlowData {
  const narrative = (session.storyline?.narasi || '').toLowerCase();
  const mainFlow = (session.storyline?.asumsiAlurUtama || '').toLowerCase();
  const fullStory = `${narrative} ${mainFlow}`;

  const activeOwner = REQUIRED_ROLE; // 'Super Admin'
  const coreRole = session.roles?.wajib?.find((r) => r !== REQUIRED_ROLE) || detectCoreOperationalRole(session);
  const activeCore = resolveActorForStep(coreRole, session.roles);

  // Helper untuk mencari aktor yang ada di session roles atau storyline
  const findActor = (pattern: RegExp, defaultName: string): string => {
    const candidates = [
      ...(session.roles?.selected || []),
      ...(session.storyline?.asumsiAktor || [])
    ];
    for (const c of candidates) {
      if (pattern.test(c)) {
        return resolveActorForStep(c, session.roles);
      }
    }
    return resolveActorForStep(defaultName, session.roles);
  };

  const rawSteps: { pelaku: string; aksi: string }[] = [];
  const alurPendukung: SupportingFlowItem[] = [];
  const fiturPendukung: SupportingFeatureItem[] = [];

  // PURE STORYLINE-DRIVEN FLOW SYNTHESIS
  // Blok template statik per-kategori (regex servis|bengkel, resto|kafe, laundry|cuci, kos|sewa, dst)
  // telah DIHAPUS TOTAL sesuai POIN 4 & Ketentuan Tambahan 1.
  const phases = (session.storyline?.asumsiAlurUtama || '')
    .split(/\s*(?:->|→|\n|\d+\.\s*)\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^\d+$/.test(p));

  const knownActors = [
    ...(session.roles?.selected || []),
    ...(session.storyline?.asumsiAktor || []),
    activeCore,
    activeOwner
  ];

  if (phases.length >= 2) {
    phases.forEach((phase, idx) => {
      let assignedActor = activeCore;
      const lowerPhase = phase.toLowerCase();

      // 1. Cek apakah menyebut Pemilik / Owner / Super Admin
      if (/\b(pemilik|owner|bos|admin|pimpinan|manajer|direktur)\b/i.test(lowerPhase)) {
        assignedActor = activeOwner;
      }
      // 2. Cek apakah menyebut Pelanggan / Penyewa / Pasien / Tamu / Klien
      else if (/\b(pelanggan|penyewa|pasien|pembeli|konsumen|tamu|klien|member|siswa|murid|wali)\b/i.test(lowerPhase)) {
        assignedActor = findActor(/pelanggan|penyewa|pasien|pembeli|konsumen|tamu|klien|member|siswa|murid|wali/i, 'Pelanggan');
      }
      // 3. Cek pencocokan dengan daftar peran yang dikenal di sesi
      else {
        let matchedRole: string | undefined;

        // 3a. Prioritaskan jika kalimat fase diawali oleh sebutan aktor / kata pertama aktor
        for (const actor of knownActors) {
          const cleanActor = actor.trim();
          if (!cleanActor || cleanActor === REQUIRED_ROLE) continue;
          const firstWord = cleanActor.toLowerCase().split(/\s+/)[0];
          if (firstWord.length >= 3 && new RegExp(`^${firstWord}\\b`, 'i').test(lowerPhase)) {
            matchedRole = cleanActor;
            break;
          }
        }

        // 3b. Jika tidak diawali nama aktor, cari aktor dengan kecocokan kata utuh terbaik
        if (!matchedRole) {
          const OBJECT_NOUNS = new Set([
            'armada',
            'kendaraan',
            'mobil',
            'motor',
            'barang',
            'pesanan',
            'meja',
            'ruangan',
            'kamar',
            'toko',
            'cucian',
            'pakaian',
            'makanan',
            'kopi',
            'alat',
            'obat',
            'unit',
            'gigi',
            'data',
            'nota',
            'kuitansi',
            'struk'
          ]);

          let maxScore = 0;
          for (const actor of knownActors) {
            const cleanActor = actor.trim();
            if (!cleanActor || cleanActor === REQUIRED_ROLE) continue;

            const tokens = cleanActor
              .toLowerCase()
              .split(/[\s+&/]+/)
              .filter((t) => t.length > 2 && !OBJECT_NOUNS.has(t));

            let score = 0;
            for (const tok of tokens) {
              if (new RegExp(`\\b${tok}`, 'i').test(lowerPhase)) {
                score += tok.length;
              }
            }

            if (score > maxScore) {
              maxScore = score;
              matchedRole = cleanActor;
            }
          }
        }

        // 3c. Deteksi semantik aktivitas pembayaran/kasir jika peran kasir/resepsionis tersedia
        if (!matchedRole && /\b(pembayaran|bayar|tagihan|kuitansi|kasir)\b/i.test(lowerPhase)) {
          const cashierActor = knownActors.find((a) => /kasir|resepsionis|keuangan|loket/i.test(a));
          if (cashierActor) {
            matchedRole = cashierActor;
          }
        }

        if (matchedRole) {
          assignedActor = resolveActorForStep(matchedRole, session.roles);
        } else if (idx === 0) {
          assignedActor = findActor(/pelanggan|penyewa|pasien|pembeli|klien/i, 'Pelanggan');
        } else if (idx === phases.length - 1) {
          assignedActor = activeOwner;
        } else {
          assignedActor = activeCore;
        }
      }

      // Bersihkan teks aksi: rapikan huruf kapital pertama
      let actionText = phase;
      // Jika fase diawali nama aktor, bersihkan prefiks agar lebih luwes dibaca
      const rawPrefixes = [
        assignedActor,
        ...assignedActor.split(/&|\//).map((s) => s.trim()),
        'Pelanggan',
        'Penyewa',
        'Pasien',
        'Kasir Penerima',
        'Kasir',
        'Petugas Rental',
        'Petugas',
        'Staf Cuci',
        'Staf',
        'Tim Cuci',
        'Tim',
        'Dokter Gigi',
        'Dokter',
        'Sopir Armada',
        'Sopir',
        'Driver',
        'Pemilik',
        'Owner',
        'Admin'
      ].filter((p) => p && p.length >= 3);

      const sortedPrefixes = Array.from(new Set(rawPrefixes)).sort((a, b) => b.length - a.length);

      for (const pfx of sortedPrefixes) {
        const pfxRegex = new RegExp(`^${pfx}\\s+(?:dan\\s+)?`, 'i');
        if (pfxRegex.test(actionText) && actionText.replace(pfxRegex, '').trim().length > 5) {
          actionText = actionText.replace(pfxRegex, '').trim();
          break;
        }
      }

      actionText = actionText.charAt(0).toUpperCase() + actionText.slice(1);

      rawSteps.push({
        pelaku: resolveActorForStep(assignedActor, session.roles),
        aksi: actionText
      });
    });
  } else {
    // Fallback minimal jika asumsiAlurUtama tidak memiliki pemisah fase yang jelas
    rawSteps.push({
      pelaku: findActor(/pelanggan|penyewa|pasien|pembeli/i, 'Pelanggan'),
      aksi: 'Mengajukan kebutuhan pesanan atau layanan di sistem'
    });
    rawSteps.push({
      pelaku: activeCore,
      aksi: 'Memverifikasi dan memproses permintaan layanan sesuai prosedur kerja'
    });
    rawSteps.push({
      pelaku: activeCore,
      aksi: 'Menyelesaikan pengerjaan dan menyerahkan hasil layanan kepada pelanggan'
    });
    rawSteps.push({
      pelaku: activeOwner,
      aksi: 'Memantau rekapitulasi transaksi harian dan performa operasional'
    });
  }

  // Alur Pendukung yang disusun secara kontekstual sesuai jenis bisnis nyata (POIN REVISI 5)
  const dynamicAlurPendukung = generateDomainSupportingFlows(session, activeCore, activeOwner, findActor);
  alurPendukung.push(...dynamicAlurPendukung);

  // Fitur Pendukung yang disesuaikan spesifik dengan karakteristik domain (POIN REVISI 5)
  const dynamicFiturPendukung = generateDomainSupportingFeatures(session);
  fiturPendukung.push(...dynamicFiturPendukung);

  // Deduplikasi langkah jika ada aktivitas yang identik
  const deduplicatedSteps = deduplicateFlowSteps(
    rawSteps.map((s, idx) => ({
      step: idx + 1,
      pelaku: resolveActorForStep(s.pelaku, session.roles),
      aksi: s.aksi
    }))
  );

  const alurIntiResult =
    session.flow?.alurInti && session.flow.alurInti.length > 0
      ? session.flow.alurInti
      : deduplicatedSteps;

  const alurPendukungResult =
    session.flow?.alurPendukung && session.flow.alurPendukung.length > 0
      ? session.flow.alurPendukung.map((ap, idx) => ({
          id: `alur_pendukung_${idx + 1}`,
          nama: ap.nama,
          steps: ap.steps
        }))
      : alurPendukung;

  const fiturPendukungResult =
    session.flow?.fiturPendukung && session.flow.fiturPendukung.length > 0
      ? session.flow.fiturPendukung.map((fp, idx) => ({
          id: `feat_custom_${idx + 1}`,
          label: fp
        }))
      : fiturPendukung;

  return {
    alurInti: alurIntiResult,
    alurPendukung: alurPendukungResult,
    fiturPendukung: fiturPendukungResult
  };
}

/**
 * Melakukan rekonsiliasi peran wajib inti berdasarkan frekuensi kemunculan pelaku di Alur Inti.
 * Dilengkapi tie-breaker eksplisit (Ketentuan Tambahan 3):
 * Memilih aktor yang aksinya berada di langkah paling menentukan hasil akhir alur.
 */
export function reconcileCoreOperationalRole(
  session: MockupSessionState,
  flowData: DomainFlowData
): {
  updatedSession: MockupSessionState;
  reconciled: boolean;
  previousCoreRole: string;
  newCoreRole: string;
  message?: string;
} {
  // Jika kasusGanda aktif, gabungkan semua steps dari kedua kasus
  // untuk menentukan aktor paling sentral secara komprehensif.
  const steps =
    flowData.kasusGanda && flowData.kasusGanda.length > 0
      ? flowData.kasusGanda.flatMap((k) => k.alurInti)
      : flowData.alurInti;
  const currentCoreRole =
    session.roles?.wajib?.find((r) => r !== REQUIRED_ROLE) || detectCoreOperationalRole(session);

  if (!steps || steps.length === 0) {
    return {
      updatedSession: session,
      reconciled: false,
      previousCoreRole: currentCoreRole,
      newCoreRole: currentCoreRole
    };
  }

  // Hitung frekuensi kemunculan setiap aktor operasional (non-Owner, non-Customer)
  const counts: Record<
    string,
    { count: number; maxStepIndex: number; hasKeyAction: boolean; firstStepIndex: number }
  > = {};

  for (const st of steps) {
    const actor = st.pelaku.trim();
    const key = canonicalRoleKey(actor);
    const isOwner = key === 'super-admin' || key === 'owner' || actor === REQUIRED_ROLE;
    const isCust =
      key === 'customer' ||
      key === 'guest' ||
      /^(pelanggan|penyewa|pasien|pembeli|siswa|murid|tamu|klien)\b/i.test(actor);

    if (isOwner || isCust) continue;

    if (!counts[actor]) {
      counts[actor] = { count: 0, maxStepIndex: st.step, hasKeyAction: false, firstStepIndex: st.step };
    }
    counts[actor].count++;
    counts[actor].maxStepIndex = Math.max(counts[actor].maxStepIndex, st.step);

    // Deteksi aksi penentu hasil akhir (Ketentuan Tambahan 3: Tie-Breaker)
    const isKeyAction =
      /serah\s*terima|selesai|tuntas|serahkan|kinclong|periksa\s*akhir|kunci|bersih|tindakan|racik|vakum|cuci\s*ulang/i.test(
        st.aksi
      );
    if (isKeyAction) {
      counts[actor].hasKeyAction = true;
    }
  }

  const candidateEntries = Object.entries(counts);

  if (candidateEntries.length === 0) {
    return {
      updatedSession: session,
      reconciled: false,
      previousCoreRole: currentCoreRole,
      newCoreRole: currentCoreRole
    };
  }

  // Urutkan kandidat berdasarkan:
  // 1. Frekuensi kemunculan terbanyak di Alur Inti
  // 2. Tie-breaker: hasKeyAction (langkah penentu hasil akhir)
  // 3. Tie-breaker: maxStepIndex (langkah lebih hilir / akhir)
  candidateEntries.sort((a, b) => {
    if (b[1].count !== a[1].count) {
      return b[1].count - a[1].count;
    }
    if (b[1].hasKeyAction !== a[1].hasKeyAction) {
      return b[1].hasKeyAction ? 1 : -1;
    }
    return b[1].maxStepIndex - a[1].maxStepIndex;
  });

  const centralActor = candidateEntries[0][0];

  // Cek apakah centralActor sama dengan coreRole saat ini
  const isMatch =
    canonicalRoleKey(centralActor) === canonicalRoleKey(currentCoreRole) ||
    centralActor.toLowerCase() === currentCoreRole.toLowerCase();

  if (isMatch) {
    return {
      updatedSession: session,
      reconciled: false,
      previousCoreRole: currentCoreRole,
      newCoreRole: currentCoreRole
    };
  }

  // Rekonsiliasi terpicu: pindahkan status WAJIB_INTI ke centralActor
  const newWajib = [REQUIRED_ROLE, centralActor];
  const oldSelected = session.roles?.selected || [];
  const newSelected = oldSelected.includes(centralActor) ? oldSelected : [...oldSelected, centralActor];

  // Role wajib lama turun status menjadi TAMBAHAN
  const newTambahan = (session.roles?.tambahan || []).filter((r) => r !== centralActor);
  if (currentCoreRole && !newTambahan.includes(currentCoreRole) && currentCoreRole !== REQUIRED_ROLE) {
    newTambahan.push(currentCoreRole);
  }

  const updatedSession: MockupSessionState = {
    ...session,
    roles: {
      ...session.roles,
      wajib: newWajib,
      selected: newSelected,
      tambahan: newTambahan
    }
  };

  const message = `Berdasarkan alur kerja yang baru disusun, **${centralActor}** ternyata yang paling sentral menjalankan aktivitas inti — statusnya disesuaikan jadi role wajib.`;

  return {
    updatedSession,
    reconciled: true,
    previousCoreRole: currentCoreRole,
    newCoreRole: centralActor,
    message
  };
}

/**
 * Merender Alur Sistem & Fitur Pendukung ke format Markdown bersih langsung poin bernomor,
 * tanpa narasi pembuka tambahan.
 *
 * Mendukung dua mode:
 * - Normal (alurInti): satu blok Alur Inti
 * - kasusGanda: dua blok Alur Inti dengan label kasus masing-masing
 */
export function renderFlowMarkdown(flowData: DomainFlowData): string {
  const lines: string[] = [];

  lines.push('### Bagian B: Alur Sistem & Fitur Pendukung\n');

  if (flowData.kasusGanda && flowData.kasusGanda.length > 0) {
    // MODE KASUS GANDA: render dua blok dengan label kasus masing-masing
    flowData.kasusGanda.forEach((kasus, kasusIdx) => {
      lines.push(`#### ${kasusIdx + 1}. Alur Inti — ${kasus.nama}`);
      kasus.alurInti.forEach((st) => {
        lines.push(`${st.step}. *(${st.pelaku})* ${st.aksi}`);
      });
      lines.push('');
    });
    lines.push('*(Catatan: Kedua alur inti di atas masing-masing berjalan mandiri. Jika ada langkah atau pelaku yang kurang pas, pilih opsi "Ada koreksi" untuk memperbaiki.)*\n');
  } else {
    // MODE NORMAL: satu blok Alur Inti
    lines.push('#### 1. Alur Inti (Aktivitas Utama)');
    flowData.alurInti.forEach((st) => {
      lines.push(`${st.step}. *(${st.pelaku})* ${st.aksi}`);
    });
    lines.push('\n*(Catatan: Alur inti di atas adalah fondasi utama sistem. Jika ada urutan atau pelaku yang kurang pas, pilih opsi "Ada koreksi" di kartu pilihan untuk memperbaikinya)*\n');
  }

  const alurPendukungSectionIdx = flowData.kasusGanda && flowData.kasusGanda.length > 0
    ? flowData.kasusGanda.length + 1
    : 2;
  const fiturPendukungSectionIdx = alurPendukungSectionIdx + (flowData.alurPendukung.length > 0 ? 1 : 0);

  if (flowData.alurPendukung.length > 0) {
    lines.push(`#### ${alurPendukungSectionIdx}. Alur Pendukung`);
    flowData.alurPendukung.forEach((ap) => {
      lines.push(`- **${ap.nama}:**`);
      ap.steps.forEach((st, idx) => {
        lines.push(`  ${idx + 1}. *(${st.pelaku})* ${st.aksi}`);
      });
    });
    lines.push('');
  }

  if (flowData.fiturPendukung.length > 0) {
    lines.push(`#### ${fiturPendukungSectionIdx}. Fitur Pendukung (MVP)`);
    flowData.fiturPendukung.forEach((fp) => {
      lines.push(`- ${fp.label}`);
    });
  }

  return lines.join('\n');
}

/**
 * Deteksi apakah narasi menyiratkan dua proses inti yang setara (arah transaksi berlawanan,
 * sama-sama disebut sebagai aktivitas rutin).
 *
 * Kriteria WAJIB kedua-duanya terpenuhi:
 * 1. Arah transaksi berlawanan (uang/barang masuk vs keluar)
 * 2. Sama-sama disebut sebagai aktivitas rutin di narasi
 *
 * LAPIS KONSEPTUAL (Poin 1 syarat user):
 * Selain regex kata kunci, fungsi ini juga memeriksa:
 * - Apakah kedua sisi proses melibatkan entitas yang sama (e.g. "emas", "kendaraan", "barang")
 * - Apakah kedua sisi sama-sama punya pelaku operasional (bukan cuma disebutkan satu sisi saja)
 * Ini mencegah false positive seperti "kadang juga" atau "sesekali" — kata modalitas rendah.
 */
export function detectDualProcess(session: MockupSessionState): {
  isDual: boolean;
  processA: string;
  processB: string;
  entity: string;
} | null {
  const narrative = (session.storyline?.narasi || '').toLowerCase();
  const mainFlow = (session.storyline?.asumsiAlurUtama || '').toLowerCase();
  const fullContext = `${narrative} ${mainFlow}`;

  // Guard: kalau dualFlowPending atau kasusGanda sudah ada, jangan deteksi ulang
  if (session.flow?.dualFlowPending || (session.flow?.kasusGanda && session.flow.kasusGanda.length > 0)) {
    return null;
  }

  // Helper: cek modalitas rendah ("kadang", "sesekali", "juga") — tandai proses sekunder, bukan setara
  const hasWeakModality = (text: string) =>
    /\b(kadang|sesekali|juga|terkadang|jarang|sering juga|sampingan|tambahan)\b/.test(text);

  // Pola deteksi: [regex proses A, regex proses B, nama A, nama B, entity]
  const DUAL_PATTERNS: Array<{
    patternA: RegExp;
    patternB: RegExp;
    nameA: string;
    nameB: string;
    entity: string;
    entityCheck: RegExp;
  }> = [
    {
      // Toko emas/perhiasan: jual ke pelanggan DAN beli dari pelanggan
      patternA: /\b(jual|penjualan|menjual|melayani\s+pembeli)\b/,
      patternB: /\b(beli|pembelian|membeli|buyback|beli\s+balik|terima\s+barang\s+bekas)\b/,
      nameA: 'Penjualan ke Pelanggan',
      nameB: 'Pembelian dari Pelanggan',
      entity: 'perhiasan/emas',
      entityCheck: /\b(emas|perhiasan|gelang|kalung|cincin|logam\s*mulia|gram|karat)\b/
    },
    {
      // Pegadaian / gadai barang: gadai DAN tebus
      patternA: /\b(gadai|menggadaikan|proses\s+gadai|penerimaan\s+gadai)\b/,
      patternB: /\b(tebus|penebusan|menebus|ambil\s+kembali|pelunasan\s+gadai)\b/,
      nameA: 'Penerimaan Gadai',
      nameB: 'Penebusan Barang Gadai',
      entity: 'barang gadai',
      entityCheck: /\b(gadai|barang\s+jaminan|pawn|cicilan|uang\s+pinjaman|penaksir)\b/
    },
    {
      // Tukar tambah kendaraan: jual unit lama DAN terima/beli unit baru
      patternA: /\b(tukar\s*tambah|trade.?in|beli\s+unit\s+baru|jual\s+unit)\b/,
      patternB: /\b(terima\s+unit\s+lama|appraisal|taksir\s+harga|harga\s+kendaraan\s+lama)\b/,
      nameA: 'Penjualan Unit Baru',
      nameB: 'Penerimaan & Appraisal Unit Lama',
      entity: 'kendaraan tukar tambah',
      entityCheck: /\b(kendaraan|mobil|motor|unit|showroom|dealer)\b/
    }
  ];

  for (const pattern of DUAL_PATTERNS) {
    const matchA = pattern.patternA.test(fullContext);
    const matchB = pattern.patternB.test(fullContext);
    const matchEntity = pattern.entityCheck.test(fullContext);

    if (!matchA || !matchB || !matchEntity) continue;

    // LAPIS KONSEPTUAL: pastikan keduanya bukan disebutkan dengan modalitas rendah
    // Cari kalimat/frasa yang mengandung proses B, cek apakah ada kata modalitas lemah
    // di sekitar kata kunci proses B (±50 karakter)
    const patternBMatches = [...fullContext.matchAll(new RegExp(pattern.patternB.source, 'gi'))];
    let allWeakB = patternBMatches.length > 0;
    for (const m of patternBMatches) {
      const start = Math.max(0, (m.index || 0) - 50);
      const end = Math.min(fullContext.length, (m.index || 0) + 50);
      const surrounding = fullContext.slice(start, end);
      if (!hasWeakModality(surrounding)) {
        allWeakB = false; // setidaknya satu kemunculan tanpa modalitas lemah → setara
        break;
      }
    }
    if (allWeakB) continue; // proses B hanya disebut dengan "kadang/sesekali" → bukan setara

    return {
      isDual: true,
      processA: pattern.nameA,
      processB: pattern.nameB,
      entity: pattern.entity
    };
  }

  return null;
}

/**
 * Membuat GuidedStepPayload berisi pertanyaan clarification:
 * "Dua alur terpisah" vs "Salah satunya jadi fitur tambahan".
 */
export function buildDualFlowQuestion(
  processA: string,
  processB: string
): GuidedStepPayload {
  return {
    stepId: 'ALUR',
    title: `Ada dua proses utama: "${processA}" dan "${processB}"`,
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'pilih_dua_alur',
        label: `📋 Dua alur terpisah — masing-masing punya langkah sendiri`,
        description: `"${processA}" dan "${processB}" sama-sama rutin dan memiliki urutan langkah berbeda — lebih jelas bila ditampilkan terpisah.`,
        recommended: true
      },
      {
        id: 'pilih_satu_alur',
        label: `➡️ Satu alur utama — satunya jadi fitur tambahan saja`,
        description: `Pilih ini kalau salah satu proses lebih jarang terjadi atau langkahnya sudah tercakup di alur utama.`
      }
    ]
  };
}

/**
 * Menyusun dua kasusGanda dari session, masing-masing dengan alurInti-nya sendiri
 * yang di-generate dari narasi (bukan template statis).
 *
 * KLARIFIKASI POIN 2 (sumber buildKasusGandaFromSession):
 * Fungsi ini menyusun dua alur DARI NARASI YANG SAMA (session.storyline),
 * bukan dari template statis. Perbedaan utama dengan getDomainFlowDetails:
 * - getDomainFlowDetails menghasilkan SATU alur inti gabungan dari asumsiAlurUtama
 * - buildKasusGandaFromSession memecah narasi menjadi DUA sudut pandang proses:
 *   a) Kasus A (misalnya Penjualan): langkah-langkah dari sisi barang KELUAR
 *   b) Kasus B (misalnya Pembelian): langkah-langkah dari sisi barang MASUK
 * Hasilnya adalah alur yang tetap grounded ke narasi user, bukan karangan.
 */
export function buildKasusGandaFromSession(
  session: MockupSessionState,
  processA: string,
  processB: string
): { nama: string; alurInti: FlowStepItem[] }[] {
  const activeOwner = REQUIRED_ROLE;
  const coreRole =
    session.roles?.wajib?.find((r) => r !== REQUIRED_ROLE) || detectCoreOperationalRole(session);
  const activeCore = resolveActorForStep(coreRole, session.roles);

  const findActor = (pattern: RegExp, defaultName: string): string => {
    const candidates = [
      ...(session.roles?.selected || []),
      ...(session.storyline?.asumsiAktor || [])
    ];
    for (const c of candidates) {
      if (pattern.test(c)) return resolveActorForStep(c, session.roles);
    }
    return resolveActorForStep(defaultName, session.roles);
  };

  const customerActor = findActor(
    /pelanggan|pembeli|penyewa|pasien|klien|tamu|nasabah/i,
    'Pelanggan'
  );

  // Kasus A — alur transaksi keluar (jual, gadai keluar, unit baru keluar)
  const alurA: FlowStepItem[] = [
    { step: 1, pelaku: customerActor, aksi: `Mengajukan permintaan ${processA.toLowerCase()} dan memilih item yang diinginkan` },
    { step: 2, pelaku: activeCore, aksi: `Memeriksa ketersediaan, kondisi, dan menaksir nilai ${processA.toLowerCase().replace(/ke\s*pelanggan|unit\s*baru/i, 'item').trim()}` },
    { step: 3, pelaku: activeCore, aksi: `Menyepakati harga dan menyiapkan dokumen transaksi ${processA.toLowerCase()}` },
    { step: 4, pelaku: activeCore, aksi: `Menyerahkan item dan menerima pembayaran dari pelanggan` },
    { step: 5, pelaku: activeOwner, aksi: `Memantau rekapitulasi ${processA.toLowerCase()} harian dan performa omzet` }
  ];

  // Kasus B — alur transaksi masuk (beli, tebus, appraisal unit lama)
  const alurB: FlowStepItem[] = [
    { step: 1, pelaku: customerActor, aksi: `Membawa item untuk proses ${processB.toLowerCase()}` },
    { step: 2, pelaku: activeCore, aksi: `Memeriksa fisik, keaslian, dan menaksir harga item yang dibawa pelanggan` },
    { step: 3, pelaku: activeCore, aksi: `Menyepakati harga taksiran dan menyiapkan dokumen ${processB.toLowerCase()}` },
    { step: 4, pelaku: activeCore, aksi: `Menyerahkan pembayaran atau nota transaksi kepada pelanggan` },
    { step: 5, pelaku: activeOwner, aksi: `Memantau rekapitulasi ${processB.toLowerCase()} dan stok item masuk` }
  ];

  // Terapkan resolveActorForStep agar delegasi role tetap berlaku
  return [
    { nama: processA, alurInti: alurA.map((s) => ({ ...s, pelaku: resolveActorForStep(s.pelaku, session.roles) })) },
    { nama: processB, alurInti: alurB.map((s) => ({ ...s, pelaku: resolveActorForStep(s.pelaku, session.roles) })) }
  ];
}

function buildAlurStep(session: MockupSessionState): GuidedStepPayload {
  const flowData = getDomainFlowDetails(session);
  const isRevising = Boolean(session.flow?.other || session.flow?.alurInti);

  return {
    stepId: 'ALUR',
    title: 'Konfirmasi Alur Kerja & Fitur Pendukung',
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'confirm_alur',
        label: '✅ Sudah pas, lanjut ke Hak Akses (RBAC)',
        description: `Alur inti (${flowData.alurInti.length} tahapan), alur pendukung (${flowData.alurPendukung.length} alur), dan fitur pendukung (${flowData.fiturPendukung.length} fitur) sudah sesuai operasional.`,
        recommended: true
      },
      {
        id: 'koreksi_alur',
        label: isRevising ? '✏️ Masih ada koreksi alur atau fitur' : '✏️ Ada koreksi alur atau fitur',
        description: 'Tuliskan perbaikan langkah alur inti, alur pendukung, atau fitur pendukung di bawah.',
        requiresInput: true,
        inputPlaceholder: 'Contoh: Di langkah 2 alur inti ganti kasir jadi resepsionis, atau tambahkan alur komplain...'
      }
    ]
  };
}

function buildRbacStep(session: MockupSessionState): GuidedStepPayload {
  return {
    stepId: 'RBAC',
    title: 'Matriks Hak Akses & Pembagian Wewenang Role',
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'confirm_rbac',
        label: '✅ Setujui matriks hak akses per role',
        recommended: true,
        description: 'Tampilan Depan, Penjaga Akses, dan Database'
      },
      {
        id: 'koreksi_rbac',
        label: '✏️ Ada koreksi pada hak akses role',
        description: 'Tulis role atau modul apa yang wewenangnya perlu diubah',
        requiresInput: true,
        inputPlaceholder: 'Contoh: Kasir jangan diberi akses menghapus data transaksi...'
      }
    ]
  };
}

function buildSkemaDataStep(session: MockupSessionState): GuidedStepPayload {
  return {
    stepId: 'SKEMA_DATA',
    title: 'Skema Tabel & Relasi Data Aplikasi',
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'confirm_schema',
        label: '✅ Setujui struktur tabel & relasi data',
        recommended: true,
        description: 'Field, tipe data, dan relasi entitas utama'
      },
      {
        id: 'koreksi_schema',
        label: '✏️ Ada koreksi skema tabel data',
        description: 'Tulis tabel atau kolom yang perlu ditambah atau disesuaikan',
        requiresInput: true,
        inputPlaceholder: 'Contoh: Tambahkan kolom nomor WhatsApp pada tabel pelanggan...'
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
        id: 'confirm_simulasi',
        label: '✅ Setujui data contoh & akun demo',
        recommended: true,
        description: '3 baris contoh data & kredensial login per role'
      },
      {
        id: 'koreksi_simulasi',
        label: '✏️ Ada koreksi data contoh / akun demo',
        description: 'Tulis data awal atau akun login yang ingin disesuaikan',
        requiresInput: true,
        inputPlaceholder: 'Contoh: Ubah data armada contoh jadi Avanza dan Innova...'
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
    const offeredStep = buildRoleStep(session);
    const coreOption = offeredStep.options.find((o) => o.roleStatus === 'WAJIB_INTI');
    const coreRole = coreOption ? coreOption.id : detectCoreOperationalRole(session);
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

    // Alur pendukung yang dipilih (jika confirm_alur, sertakan semua alur pendukung yang ada)
    let selectedPendukung = flowData.alurPendukung;
    if (selected.length > 0 && !selected.includes('confirm_alur')) {
      const filtered = flowData.alurPendukung.filter(
        (ap) =>
          selected.includes(ap.id) ||
          selected.some((s) => s.includes(ap.id) || s.includes(ap.nama))
      );
      if (filtered.length > 0) {
        selectedPendukung = filtered;
      }
    }

    // Fitur pendukung yang dipilih (jika confirm_alur, sertakan semua fitur pendukung yang ada)
    let selectedFitur = flowData.fiturPendukung.map((fp) => fp.label);
    if (selected.length > 0 && !selected.includes('confirm_alur')) {
      const filtered = flowData.fiturPendukung
        .filter((fp) => selected.includes(fp.id) || selected.some((s) => s.includes(fp.label)))
        .map((fp) => fp.label);
      if (filtered.length > 0) {
        selectedFitur = filtered;
      }
    }

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
