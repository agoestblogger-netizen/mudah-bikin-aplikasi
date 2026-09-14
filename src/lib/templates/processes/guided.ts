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
  { key: 'super-admin', re: /^(super\s*admin|owner|pemilik|founder)$/i },
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
  { key: 'customer', re: /^(pelanggan|customer|buyer|pembeli|klien|client|pasien|patient|siswa|student|murid|warga|tamu|guest|member|subscriber|penyewa|tenant|penerima\s*manfaat|pemohon|penumpang|participant|peserta|orang\s*tua|anggota|nasabah|konsumen|\bparent\b)$|\b(pelanggan|penyewa|pasien|klien|konsumen|tamu|murid|siswa|warga|masyarakat|anggota|nasabah)\b/i },
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
  // Perlindungan: Peran staf/petugas/tim internal TIDAK BOLEH dianggap sebagai customer
  const isExplicitStaff = /^(petugas|staf|staff|admin|tim|team|koordinator|operator|kolektor|penaksir)\b/i.test(clean);
  for (const group of ROLE_GROUPS) {
    if (isExplicitStaff && group.key === 'customer') {
      continue;
    }
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

/**
 * Menentukan apakah suatu peran merupakan peran tata kelola (governance/pengambil kebijakan).
 * PRIORITAS: Membaca isi tanggung jawab konseptual dari detailAktor (hasil AI step ROLE).
 * BUKAN semata-mata dari mencocokkan kata kunci pada nama peran.
 */
export function isGovernanceRole(
  label: string,
  detailAktor?: Record<string, { narasi: string; tanggungJawab: string[] }>
): boolean {
  if (!label) return false;
  const clean = label.trim();
  if (isSuperAdminRole(clean) || isExternalRole(clean)) return false;

  // 1. PRIORITAS UTAMA: Analisis Konseptual dari Isi Tanggung Jawab (Hasil AI Step ROLE)
  if (detailAktor) {
    let details = detailAktor[clean];
    if (!details) {
      const lower = clean.toLowerCase();
      for (const [k, v] of Object.entries(detailAktor)) {
        if (k.toLowerCase() === lower) {
          details = v;
          break;
        }
      }
    }

    if (details) {
      const combinedText = `${details.narasi || ''} ${(details.tanggungJawab || []).join(' ')}`.toLowerCase();

      // Cek apakah tanggung jawab memuat peran pengambil keputusan kebijakan, regulasi, otorisasi, pengawasan, evaluasi kepatuhan
      const hasStrategicAuthority = /\b(kebijakan|strategis|regulasi|plafon|otorisasi|persetujuan|menyetujui|mengevaluasi|evaluasi|audit|kepatuhan|pengawasan|mengawasi|anggaran|tata kelola|pertanggungjawaban|skema|likuiditas)\b/i.test(combinedText);
      const isPureFrontlineService = /\b(memotong rambut|mencuci|mengemudi|mengecor|menyeduh|membersihkan|melayani antrean)\b/i.test(combinedText);

      if (hasStrategicAuthority && !isPureFrontlineService) {
        return true;
      }
      return false;
    }
  }

  // 2. FALLBACK DARURAT OFFLINE: Hanya jika detailAktor AI belum tersedia sama sekali
  return /\b(pengurus|pengawas|direksi|direktur|komite|dewan|pembina|yayasan|board|governance)\b/i.test(clean);
}

export function isExternalRole(label: string): boolean {
  const clean = label.trim();
  if (/^(petugas|staf|staff|admin|tim|team|koordinator|operator|kolektor|penaksir|kasir|teller|mekanik|montir)\b/i.test(clean)) {
    return false;
  }
  if (
    /^(pelanggan|customer|buyer|pembeli|klien|client|pasien|patient|siswa|student|murid|warga|tamu|guest|member|subscriber|penyewa|tenant|penerima\s*manfaat|pemohon|penumpang|participant|peserta|orang\s*tua|anggota|nasabah|konsumen)$/i.test(clean) ||
    /\b(pelanggan|penyewa|pasien|klien|konsumen|tamu|murid|siswa|warga|masyarakat|anggota|nasabah)\b/i.test(clean)
  ) {
    return true;
  }
  return canonicalRoleKey(label) === 'customer';
}

function buildStorytellingStep(session: MockupSessionState): GuidedStepPayload {
  // Jika sedang menunggu klarifikasi arah bisnis sebelum narasi dibuat
  if (session.storyline?.pendingDirectionClarification) {
    const pend = session.storyline.pendingDirectionClarification;
    if (pend.pertanyaan && pend.opsiA && pend.opsiB) {
      return buildDirectionClarificationCard({
        pertanyaan: pend.pertanyaan,
        opsiA: pend.opsiA,
        opsiB: pend.opsiB,
        opsiBoth: pend.opsiBoth,
        nameA: pend.nameA,
        nameB: pend.nameB
      });
    }
    if (pend.patternId) {
      const pattern = DUAL_PROCESS_PATTERNS.find(
        (p) => p.id === pend.patternId
      );
      if (pattern) {
        return buildDirectionClarificationCard(pattern);
      }
    }
  }

  const revisiCount = session.storyline?.revisiCount || 0;
  const isClarifying = Boolean(session.storyline?.modeKlarifikasiBertahap);

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
    title: revisiCount > 0 ? 'Konfirmasi narasi proses bisnis hasil penyesuaian' : 'Konfirmasi gambaran proses bisnis aplikasi Anda',
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
    if (key !== 'super-admin' && key !== 'customer' && !isExternalRole(clean) && !GENERIC_ROLE_RE.test(clean)) {
      return EN_ROLE_LABEL_MAP[clean.toLowerCase()] || clean;
    }
  }

  // Fallback netral jika tidak ada aktor alur inti khusus
  return 'Staf Layanan';
}

export interface StorylineContext {
  narasi?: string;
  asumsiAlurUtama?: string;
  asumsiAktor?: string[];
  detailAktor?: Record<string, { narasi: string; tanggungJawab: string[] }>;
}

function isSuperAdminRole(role: string): boolean {
  if (!role) return false;
  const key = canonicalRoleKey(role);
  return key === 'super-admin' || key === 'owner' || role === REQUIRED_ROLE;
}

export function getRoleNarrativeAndResponsibilities(
  roleLabel: string,
  businessCategory?: string,
  storylineContext?: StorylineContext,
  currentRolesState?: MockupSessionState['roles']
): RoleDetailDefinition {
  const clean = roleLabel.trim();
  const cat = businessCategory || 'bisnis ini';

  // Kumpulkan seluruh kandidat peran yang diketahui di sesi untuk deteksi tata kelola (governance)
  const allKnownRoles = [
    ...(currentRolesState?.selected || []),
    ...(currentRolesState?.wajib || []),
    ...(storylineContext?.asumsiAktor || []),
    ...Object.keys(storylineContext?.detailAktor || {})
  ];
  const hasGovernance = allKnownRoles.some((r) => isGovernanceRole(r, storylineContext?.detailAktor));

  // 1. Super Admin / Pemilik Usaha
  if (isSuperAdminRole(clean)) {
    const userManagementTask = 'Mendaftarkan dan mengelola akun pengguna, penugasan staf, serta penetapan hak akses aplikasi';

    // Cari apakah ada definisi awal dari AI di detailAktor
    let rawDetails: RoleDetailDefinition | undefined;
    if (storylineContext?.detailAktor) {
      const directMatch = storylineContext.detailAktor[clean];
      if (directMatch && directMatch.narasi && directMatch.tanggungJawab?.length) {
        rawDetails = directMatch;
      } else {
        const lowerClean = clean.toLowerCase();
        for (const [k, v] of Object.entries(storylineContext.detailAktor)) {
          if (k.toLowerCase() === lowerClean && v && v.narasi && v.tanggungJawab?.length) {
            rawDetails = v;
            break;
          }
        }
      }
    }

    if (hasGovernance) {
      // BAGIAN B: Pemisahan Tanggung Jawab Governance dari Super Admin
      // Pangkas bagian yang menjadi domain kebijakan bisnis, bunga, plafon, anggaran, dll.
      const filteredTasks = (rawDetails?.tanggungJawab || []).filter(
        (t) => !/\b(kebijakan|bunga|plafon|anggaran|strategis|ad\/art|kepengurusan|rapat anggota|produk simpanan|produk pinjaman)\b/i.test(t)
      );

      const nonUserFiltered = filteredTasks.filter(
        (t) => !/\b(user|pengguna|akun|staf|hak\s*akses|peran\s*akses)\b/i.test(t)
      );

      const cleanTasks = [userManagementTask, ...nonUserFiltered].slice(0, 3);
      if (cleanTasks.length < 2) {
        cleanTasks.push('Memantau pengawasan umum operasional sistem, log audit aktivitas, dan rekapitulasi data global');
      }
      if (cleanTasks.length < 3) {
        cleanTasks.push('Mengatur konfigurasi teknis, keamanan akses, dan parameter operasional aplikasi');
      }

      return {
        narasi: `Administrator utama sistem dan penanggung jawab teknis operasional aplikasi di ${cat}. Bertanggung jawab atas pengelolaan akun pengguna, pembagian hak akses staf, serta pengawasan teknis dan kestabilan sistem aplikasi.`,
        tanggungJawab: cleanTasks
      };
    }

    // BAGIAN C: Super Admin pada domain umum (tanpa peran governance terpisah)
    // Tetap memegang tanggung jawab pemilik umum, TETAPI tugas pengaturan user WAJIB selalu ada secara eksplisit
    let baseTasks = rawDetails?.tanggungJawab && rawDetails.tanggungJawab.length > 0
      ? [...rawDetails.tanggungJawab]
      : [
          `Memantau ringkasan omzet dan laporan transaksi harian ${cat}`,
          userManagementTask,
          'Meninjau performa keseluruhan operasional dan pengaturan aplikasi'
        ];

    const hasUserTask = baseTasks.some((t) =>
      /\b(user|pengguna|akun\s+staf|akun\s+pengguna|hak\s*akses|peran\s*akses|manajemen\s*pengguna)\b/i.test(t)
    );

    if (!hasUserTask) {
      baseTasks.splice(1, 0, userManagementTask);
      baseTasks = baseTasks.slice(0, 3);
    } else {
      const userIdx = baseTasks.findIndex((t) =>
        /\b(user|pengguna|akun\s+staf|akun\s+pengguna|hak\s*akses|peran\s*akses|manajemen\s*pengguna)\b/i.test(t)
      );
      if (userIdx !== -1 && baseTasks[userIdx].length < 30) {
        baseTasks[userIdx] = userManagementTask;
      }
    }

    return {
      narasi: rawDetails?.narasi || `Pemilik usaha atau penanggung jawab utama operasional ${cat}. Memastikan seluruh aktivitas harian berjalan tertib, memantau pergerakan omzet dan laporan transaksi, serta mengelola akun staf yang bertugas.`,
      tanggungJawab: baseTasks
    };
  }

  // 2. PRIORITAS UTAMA UNTUK ROLE LAIN: Gunakan detailAktor hasil AI yang sudah digrounding dari cerita
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

  // 3. Fallback Khusus: Peran Tata Kelola / Governance (Pengurus Koperasi, Direksi, Dewan Pengawas)
  if (isGovernanceRole(clean, storylineContext?.detailAktor)) {
    return {
      narasi: `Pengambil kebijakan strategis dan penanggung jawab tata kelola organisasi di ${cat}. Menetapkan regulasi bisnis, jenis produk layanan, plafon, serta mengevaluasi laporan kinerja periodik.`,
      tanggungJawab: [
        `Menetapkan kebijakan operasional bisnis, regulasi bunga/plafon, dan pedoman layanan di ${cat}`,
        'Menyetujui pengajuan transaksi khusus, kerja sama strategis, atau plafon di atas batas normal',
        'Mengevaluasi laporan pertanggungjawaban periodik dan kesehatan operasional organisasi'
      ]
    };
  }

  // 4. Pihak Eksternal / Pelanggan / Warga / Penyewa / Pasien (Pihak yang dilayani)
  if (isExternalRole(clean)) {
    return {
      narasi: `Pihak pengguna atau pelanggan yang menerima dan memanfaatkan layanan di ${cat}, mengajukan kebutuhan transaksi, serta menerima bukti atau hasil layanan resmi.`,
      tanggungJawab: [
        `Memilih atau mengajukan kebutuhan transaksi layanan di ${cat}`,
        'Menyelesaikan transaksi pembayaran dan memverifikasi data layanan',
        'Menerima bukti transaksi atau konfirmasi penyelesaian layanan'
      ]
    };
  }

  // 5. Fallback Netral Konseptual (HANYA jika detailAktor hasil AI belum tersedia)
  return {
    narasi: `Petugas operasional di ${cat} yang bertanggung jawab menjalankan aktivitas kerja harian untuk ${clean} sesuai alur yang disepakati.`,
    tanggungJawab: [
      `Melaksanakan dan mencatat aktivitas operasional terkait ${clean} di ${cat}`,
      'Memverifikasi dan memproses transaksi atau kebutuhan kerja yang masuk',
      'Berkoordinasi dengan tim dan melaporkan rekapitulasi kerja harian ke Pemilik usaha'
    ]
  };
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
  const wajibList = (rolesState?.wajib || []).map((w) => w.toLowerCase());
  const delegations = rolesState?.tugasDilimpahkan || [];

  for (const role of selected) {
    const isOwner = isSuperAdminRole(role);
    let status = 'Aktif';
    if (isOwner) {
      status = 'Wajib (Owner)';
    } else if (wajibList.includes(role.toLowerCase())) {
      status = 'Wajib (Alur Inti)';
    }

    const matchedDelegations = delegations.filter((d) => d.keRole.toLowerCase() === role.toLowerCase());
    const extra = matchedDelegations.length > 0
      ? ` *(+ melimpahkan tugas ${matchedDelegations.map((d) => d.dariRole).join(', ')})*`
      : '';
    const details = getRoleNarrativeAndResponsibilities(role, businessCategory, storyline, rolesState);
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
      // Dilarang menggabungkan dua role WAJIB_INTI yang berbeda (misal role kasus A dan kasus B yang sengaja dipisah)
      if (existing.roleStatus === 'WAJIB_INTI' && current.roleStatus === 'WAJIB_INTI') {
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
  const pemisahanRole = session.storyline?.analisisArah?.duaArah?.pemisahanRole;
  const isDualSeparated = pemisahanRole?.keputusan === 'PISAH';
  const roleKasusA = pemisahanRole?.roleKasusA?.toLowerCase();
  const roleKasusB = pemisahanRole?.roleKasusB?.toLowerCase();
  const coreRole = detectCoreOperationalRole(session);

  const options: GuidedStepOption[] = [];

  // Super Admin (Owner) selalu wajib & locked
  const ownerDetails = getRoleNarrativeAndResponsibilities(REQUIRED_ROLE, session.match.businessCategory, session.storyline, session.roles);
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
    const lowerLabel = label.toLowerCase();
    const isCore = isDualSeparated
      ? (Boolean(roleKasusA) && (lowerLabel.includes(roleKasusA!) || roleKasusA!.includes(lowerLabel))) ||
        (Boolean(roleKasusB) && (lowerLabel.includes(roleKasusB!) || roleKasusB!.includes(lowerLabel)))
      : label === coreRole;
    const details = getRoleNarrativeAndResponsibilities(label, session.match.businessCategory, session.storyline, session.roles);
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
 * Menghasilkan Alur Pendukung berbasis analisis semantik ekstraksi kata kerja & objek narasi (fallback offline jika AI tidak aktif).
 * TIDAK MENGGUNAKAN daftar percabangan domain statis atau template kaku per kategori.
 */
function generateSemanticSupportingFlows(
  session: MockupSessionState,
  activeCore: string,
  activeOwner: string,
  findActor: (pattern: RegExp, defaultName: string) => string
): SupportingFlowItem[] {
  const narrative = (session.storyline?.narasi || '').trim();
  const mainFlow = (session.storyline?.asumsiAlurUtama || '').trim();
  const problem = (session.storyline?.asumsiMasalah || '').trim();
  const domain = ((session as any).domain || session.match?.businessCategory || 'Operasional Bisnis').trim();

  const customerActor = findActor(
    /pelanggan|penyewa|pasien|pembeli|klien|tamu|member|warga|siswa|murid|anggota|nasabah/i,
    'Pelanggan'
  );

  // Periksa peran governance / pengambil keputusan / pengawas
  const governanceCandidate = session.roles?.selected?.find((r) => isGovernanceRole(r, session.storyline?.detailAktor));
  const reviewerActor = governanceCandidate ? resolveActorForStep(governanceCandidate, session.roles) : activeOwner;
  const alur1Actor = customerActor.toLowerCase() !== activeCore.toLowerCase() ? customerActor : activeCore;

  // 1. EKSTRAKSI DETAIL MASALAH OPERASIONAL KONKRET (Untuk Alur Pendukung 1)
  const fullContext = `${domain} ${narrative} ${mainFlow} ${problem}`.toLowerCase();
  
  let cleanProblem = problem
    .replace(/^(masalah|kendala|permasalahan|isu|kesulitan)\s*(utama|operasional)?\s*[:=-]?\s*/i, '')
    .replace(/\b(masih\s+manual|sering\s+terjadi|sulit\s+dipantau|tidak\s+tercatat|kurang\s+efisien|kurang\s+terkoordinasi|menumpuk|sering\s+komplain)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Ekstrak judul & objek masalah konkret berdasarkan analisis semantik kata benda
  let title1 = `Penanganan Kendala Operasional & Penyesuaian Transaksi ${domain}`;
  let specificFocal = domain;

  if (/\b(kredit\s*macet|tunggakan|angsuran|cicilan|gagal\s*bayar|plafon)\b/i.test(fullContext)) {
    title1 = 'Penanganan Tunggakan Angsuran & Penjadwalan Ulang Kredit Bermasalah';
    specificFocal = 'Pinjaman & Simpanan';
  } else if (/\b(armada|mobil|motor|sewa|kendaraan|rental|bodi|lecet|denda|terlambat)\b/i.test(fullContext)) {
    title1 = 'Pemeriksaan Lecet Bodi, Klaim Kerusakan & Perhitungan Denda Keterlambatan';
    specificFocal = 'Unit Armada Kendaraan';
  } else if (/\b(hewan|kucing|anjing|anabul|pakan|kandang|grooming|vaksin)\b/i.test(fullContext)) {
    title1 = 'Penanganan Hewan Sakit, Isolasi Gejala Alergi & Penyesuaian Pakan Khusus';
    specificFocal = 'Hewan Peliharaan & Kandang';
  } else if (/\b(rambut|cukur|potong|barber|kapster|pomade|silet)\b/i.test(fullContext)) {
    title1 = 'Klaim Koreksi Hasil Potongan Rambut & Perapian Ulang';
    specificFocal = 'Potongan Rambut & Styling';
  } else if (/\b(cetak|banner|sablon|offset|tinta|luntur|warna)\b/i.test(fullContext)) {
    title1 = 'Koreksi Cetak Ulang Cepat jika Warna Luntur atau Format Rusak';
    specificFocal = 'Hasil Cetakan & Banner';
  } else if (/\b(kafe|kopi|resto|menu|makanan|dapur|chiller)\b/i.test(fullContext)) {
    title1 = 'Penggantian Pesanan Salah & Garansi Cita Rasa Masakan';
    specificFocal = 'Pesanan Menu Dapur';
  } else if (/\b(bengkel|mesin|motor|servis|sparepart|onderdil)\b/i.test(fullContext)) {
    title1 = 'Garansi Perbaikan Ulang jika Kendala Mesin Kambuh & Uji Kelayakan';
    specificFocal = 'Servis Mesin Kendaraan';
  } else if (cleanProblem.length > 5) {
    title1 = `Penanganan Kendala ${cleanProblem.charAt(0).toUpperCase() + cleanProblem.slice(1)}`;
  }

  // 2. EKSTRAKSI SARANA / AUDIT KERJA KONKRET DARI ALUR KERJA (Untuk Alur Pendukung 2)
  let title2 = `Audit Berkas Transaksi, Rekonsiliasi Harian & Kesiapan Operasional ${domain}`;
  let auditAction1 = `Mendata bukti fisik transaksi harian ${specificFocal.toLowerCase()}, mencocokkan rekonsiliasi catatan operasional, dan memeriksa kelayakan instrumen pendukung`;
  let auditAction2 = `Memeriksa laporan rekonsiliasi berkala, mengotorisasi pengeluaran kas penunjang, dan menyetujui evaluasi kepatuhan tata kelola ${domain.toLowerCase()}`;

  if (/\b(pinjaman|simpanan|koperasi|kredit|brankas|baki\s*debet)\b/i.test(fullContext)) {
    title2 = 'Audit Fisik Brankas Kasir & Rekonsiliasi Kuitansi Akad Pinjaman';
    auditAction1 = 'Menghitung fisik uang tunai di brankas kasir dan mencocokkan totalnya dengan kuitansi akad pencairan serta mutasi harian';
    auditAction2 = 'Memeriksa berita acara kas opname dan mengotorisasi kepatuhan pembukuan likuiditas keuangan koperasi';
  } else if (/\b(armada|mobil|rental|stnk|odometer|oli)\b/i.test(fullContext)) {
    title2 = 'Pemeriksaan Masa Berlaku STNK, Servis Berkala & Kesiapan Kunci Armada';
    auditAction1 = 'Mencatat odometer kilometer unit, memeriksa kebersihan fisik bodi, dan mengecek masa aktif STNK armada';
    auditAction2 = 'Menyetujui jadwal perawatan rutin ke bengkel rekanan dan otorisasi anggaran servis armada';
  } else if (/\b(hewan|kandang|pakan|grooming|vaksin)\b/i.test(fullContext)) {
    title2 = 'Sterilisasi Kebersihan Kandang, Opname Vitamin & Restock Pakan';
    auditAction1 = 'Mencuci baki pasir kotoran dengan desinfektan dan menghitung sisa stok pakan hewan serta vitamin';
    auditAction2 = 'Mengotorisasi pembelian pakan hewan berkualitas dan memastikan standar sanitasi kandang terpenuhi';
  } else if (/\b(rambut|cukur|barber|clipper|pomade)\b/i.test(fullContext)) {
    title2 = 'Sterilisasi Pisau Clipper, Penggantian Silet Cukur & Restock Pomade';
    auditAction1 = 'Memeriksa ketajaman pisau clipper elektrik, ketersediaan silet sekali pakai, dan stok pomade di meja kerja';
    auditAction2 = 'Menyetujui anggaran belanja perlengkapan pangkas dan memesan produk perawatan rambut resmi';
  } else if (/\b(cetak|banner|tinta|head|nozzle)\b/i.test(fullContext)) {
    title2 = 'Pembersihan Nozzle Head Mesin Cetak & Restock Gulungan Banner';
    auditAction1 = 'Memeriksa volume tinta warna cair di tangki mesin dan mendata sisa roll vinyl serta stiker cetak';
    auditAction2 = 'Menyetujui pembelian tinta industri beresolusi tinggi dan memesan bahan baku banner';
  }

  const steps1: { pelaku: string; aksi: string }[] = [
    {
      pelaku: alur1Actor,
      aksi: `Menyampaikan permohonan penanganan seputar kendala ${cleanProblem || specificFocal.toLowerCase()} dan menyerahkan bukti transaksi terkait`
    },
    {
      pelaku: activeCore,
      aksi: `Memeriksa riwayat data ${specificFocal.toLowerCase()}, memvalidasi keabsahan dokumen fisik di sistem, dan merumuskan solusi penanganan`
    }
  ];

  if (governanceCandidate) {
    steps1.push({
      pelaku: reviewerActor,
      aksi: `Mengevaluasi laporan tindak lanjut ${specificFocal.toLowerCase()} dan mengotorisasi keputusan persetujuan adendum kebijakan`
    });
  }

  return [
    {
      id: 'alur_kendala_spesifik',
      nama: title1,
      steps: steps1
    },
    {
      id: 'alur_audit_sarana_spesifik',
      nama: title2,
      steps: [
        {
          pelaku: activeCore,
          aksi: auditAction1
        },
        {
          pelaku: activeOwner,
          aksi: auditAction2
        }
      ]
    }
  ];
}

/**
 * Menghasilkan Fitur Pendukung berbasis analisis semantik murni (fallback offline jika AI tidak aktif).
 * Profil industri statik hardcoded telah DIHAPUS TOTAL untuk mencegah kebocoran domain asing.
 */
function generateSemanticSupportingFeatures(
  session: MockupSessionState
): SupportingFeatureItem[] {
  const domain = ((session as any).domain || session.match?.businessCategory || 'Operasional Bisnis').trim();
  const mainFlow = (session.storyline?.asumsiAlurUtama || '').toLowerCase();
  const slug = domain.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15);

  let focalEntity = domain;
  if (/pinjaman|simpanan|kredit/i.test(mainFlow)) focalEntity = 'Pinjaman & Simpanan';
  else if (/armada|mobil|kendaraan/i.test(mainFlow)) focalEntity = 'Unit Armada';
  else if (/kandang|hewan|pakan/i.test(mainFlow)) focalEntity = 'Penitipan Hewan';
  else if (/potong|cukur|rambut/i.test(mainFlow)) focalEntity = 'Pangkas Rambut';
  else if (/cetak|banner/i.test(mainFlow)) focalEntity = 'Order Cetakan';

  return [
    {
      id: `feat_monitoring_${slug}`,
      label: `Dasbor pemantauan antrean transaksi dan status proses ${focalEntity} secara real-time`
    },
    {
      id: `feat_riwayat_${slug}`,
      label: `Buku besar pencatatan riwayat transaksi, mutasi berkas, dan kartu catatan ${focalEntity}`
    },
    {
      id: `feat_dokumen_${slug}`,
      label: `Cetak lembar bukti transaksi resmi, kuitansi, invoice, dan dokumen berita acara ${focalEntity} (PDF)`
    },
    {
      id: `feat_notifikasi_${slug}`,
      label: `Notifikasi WhatsApp otomatis pengingat jadwal, jatuh tempo, atau pembaruan status pengerjaan ${focalEntity}`
    },
    {
      id: `feat_rekap_${slug}`,
      label: `Rekapitulasi performa harian, ringkasan saldo keuangan/omzet, dan ekspor laporan berkala ${domain}`
    }
  ];
}

export interface GetDomainFlowDetailsOptions {
  forceFresh?: boolean;
  supportingFlows?: SupportingFlowItem[];
  supportingFeatures?: SupportingFeatureItem[];
}

/**
 * Menghasilkan Alur Inti, Alur Pendukung, dan Fitur Pendukung yang MURNI DIGROUNDING
 * dari session storyline (narasi & alur utama) tanpa mengandalkan template statis per-kategori.
 */
export function getDomainFlowDetails(
  session: MockupSessionState,
  options?: GetDomainFlowDetailsOptions
): DomainFlowData {
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
      // 2. Cek apakah menyebut Pelanggan / Penyewa / Pasien / Tamu / Klien / Anggota / Nasabah
      else if (/\b(pelanggan|penyewa|pasien|pembeli|konsumen|tamu|klien|member|siswa|murid|wali|anggota|nasabah)\b/i.test(lowerPhase)) {
        assignedActor = findActor(/pelanggan|penyewa|pasien|pembeli|konsumen|tamu|klien|member|siswa|murid|wali|anggota|nasabah/i, 'Pelanggan');
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

  // Alur Pendukung (Prioritas: options.supportingFlows > session.flow.alurPendukung > semantic fallback)
  if (options?.supportingFlows && options.supportingFlows.length > 0) {
    alurPendukung.push(...options.supportingFlows);
  } else if (!options?.forceFresh && session.flow?.alurPendukung && session.flow.alurPendukung.length > 0) {
    alurPendukung.push(
      ...session.flow.alurPendukung.map((ap, idx) => ({
        id: `alur_pendukung_${idx + 1}`,
        nama: ap.nama,
        steps: ap.steps
      }))
    );
  } else {
    const dynamicAlurPendukung = generateSemanticSupportingFlows(session, activeCore, activeOwner, findActor);
    alurPendukung.push(...dynamicAlurPendukung);
  }

  // Fitur Pendukung (Prioritas: options.supportingFeatures > session.flow.fiturPendukung > semantic fallback)
  if (options?.supportingFeatures && options.supportingFeatures.length > 0) {
    fiturPendukung.push(...options.supportingFeatures);
  } else if (!options?.forceFresh && session.flow?.fiturPendukung && session.flow.fiturPendukung.length > 0) {
    fiturPendukung.push(
      ...session.flow.fiturPendukung.map((fp, idx) => ({
        id: `feat_custom_${idx + 1}`,
        label: fp
      }))
    );
  } else {
    const dynamicFiturPendukung = generateSemanticSupportingFeatures(session);
    fiturPendukung.push(...dynamicFiturPendukung);
  }

  // Deduplikasi langkah jika ada aktivitas yang identik
  const deduplicatedSteps = deduplicateFlowSteps(
    rawSteps.map((s, idx) => ({
      step: idx + 1,
      pelaku: resolveActorForStep(s.pelaku, session.roles),
      aksi: s.aksi
    }))
  );

  const alurIntiResult =
    !options?.forceFresh && session.flow?.alurInti && session.flow.alurInti.length > 0
      ? session.flow.alurInti
      : deduplicatedSteps;

  return {
    alurInti: alurIntiResult,
    alurPendukung,
    fiturPendukung
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
  const currentCoreRole =
    session.roles?.wajib?.find((r) => r !== REQUIRED_ROLE) || detectCoreOperationalRole(session);

  // Jika kasus ganda dan pemisahanRole adalah PISAH, pertahankan kedua role operasional
  const pemisahanRole = session.storyline?.analisisArah?.duaArah?.pemisahanRole;
  if (pemisahanRole?.keputusan === 'PISAH' && flowData.kasusGanda && flowData.kasusGanda.length >= 2) {
    const isExternalOrOwner = (actor: string) => {
      const k = canonicalRoleKey(actor);
      return (
        k === 'super-admin' ||
        k === 'owner' ||
        isExternalRole(actor) ||
        k === 'customer' ||
        k === 'guest' ||
        /^(pelanggan|penyewa|pasien|pembeli|siswa|murid|tamu|klien|anggota|nasabah|warga)\b/i.test(actor)
      );
    };

    const actorA = flowData.kasusGanda[0]?.alurInti.find((s) => !isExternalOrOwner(s.pelaku))?.pelaku;
    const actorB = flowData.kasusGanda[1]?.alurInti.find((s) => !isExternalOrOwner(s.pelaku))?.pelaku;

    const dualCoreWajib = [REQUIRED_ROLE];
    if (actorA && !dualCoreWajib.includes(actorA)) dualCoreWajib.push(actorA);
    if (actorB && !dualCoreWajib.includes(actorB)) dualCoreWajib.push(actorB);

    const currentWajibSet = new Set(session.roles?.wajib || []);
    const hasAll = dualCoreWajib.every((r) => currentWajibSet.has(r));

    if (hasAll) {
      return {
        updatedSession: session,
        reconciled: false,
        previousCoreRole: currentCoreRole,
        newCoreRole: dualCoreWajib.slice(1).join(' & ')
      };
    }

    const oldSelected = session.roles?.selected || [];
    const newSelected = Array.from(new Set([...oldSelected, ...dualCoreWajib]));
    const newTambahan = (session.roles?.tambahan || []).filter((r) => !dualCoreWajib.includes(r));

    const updatedSession: MockupSessionState = {
      ...session,
      roles: {
        ...session.roles,
        wajib: dualCoreWajib,
        selected: newSelected,
        tambahan: newTambahan
      }
    };

    const dualNames = dualCoreWajib.slice(1);
    return {
      updatedSession,
      reconciled: true,
      previousCoreRole: currentCoreRole,
      newCoreRole: dualNames.join(' & '),
      message: `Berdasarkan dua alur transaksi yang berjalan (${flowData.kasusGanda.map((k) => k.nama).join(' & ')}), role operasional inti diselaraskan ke **${dualNames.join('** dan **')}**.`
    };
  }

  // Jika kasusGanda aktif tanpa pemisahan peran, gabungkan semua steps dari kedua kasus
  // untuk menentukan aktor paling sentral secara komprehensif.
  const steps =
    flowData.kasusGanda && flowData.kasusGanda.length > 0
      ? flowData.kasusGanda.flatMap((k) => k.alurInti)
      : flowData.alurInti;

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
      isExternalRole(actor) ||
      /^(pelanggan|penyewa|pasien|pembeli|siswa|murid|tamu|klien|anggota|nasabah|warga)\b/i.test(actor);

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
export interface DualProcessPattern {
  id: string;
  patternA: RegExp;
  patternB: RegExp;
  nameA: string;
  nameB: string;
  entity: string;
  entityCheck: RegExp;
  clarificationQuestion: string;
  optionALabel: string;
  optionBLabel: string;
  optionBothLabel: string;
  directionKeywords: RegExp;
}

/**
 * Single source of truth untuk domain dengan dua proses setara / arah bisnis ganda.
 * Digunakan bersama oleh:
 * 1. detectAmbiguousStorylineDomain (step STORYTELLING sebelum narasi di-generate)
 * 2. detectDualProcess (step ALUR saat meninjau narasi yang sudah lengkap)
 */
export const DUAL_PROCESS_PATTERNS: DualProcessPattern[] = [
  {
    id: 'toko_emas',
    // Toko emas/perhiasan: jual ke pelanggan DAN beli dari pelanggan
    patternA: /\b(jual|penjualan|menjual|melayani\s+pembeli)\b/i,
    patternB: /\b(beli|pembelian|membeli|buyback|beli\s+balik|terima\s+barang\s+bekas)\b/i,
    nameA: 'Penjualan ke Pelanggan',
    nameB: 'Pembelian dari Pelanggan',
    entity: 'perhiasan/emas',
    entityCheck: /\b(emas|perhiasan|gelang|kalung|cincin|logam\s*mulia|gram|karat)\b/i,
    clarificationQuestion: 'Toko emas ini fokusnya menjual perhiasan ke pelanggan, menerima pembelian emas bekas dari pelanggan, atau dua-duanya?',
    optionALabel: 'Jual ke pelanggan (fokus penjualan perhiasan)',
    optionBLabel: 'Beli dari pelanggan (fokus pembelian emas bekas / buyback)',
    optionBothLabel: 'Dua-duanya (melayani jual dan beli emas)',
    directionKeywords: /\b(jual|beli|buyback|beli\s+balik|menjual|membeli|penjualan|pembelian)\b/i
  },
  {
    id: 'pegadaian',
    // Pegadaian / gadai barang: gadai DAN tebus
    patternA: /\b(gadai|menggadaikan|proses\s+gadai|penerimaan\s+gadai)\b/i,
    patternB: /\b(tebus|penebusan|menebus|ambil\s+kembali|pelunasan\s+gadai)\b/i,
    nameA: 'Penerimaan Gadai',
    nameB: 'Penebusan Barang Gadai',
    entity: 'barang gadai',
    entityCheck: /\b(pegadaian|gadai|barang\s+jaminan|pawn|cicilan|uang\s+pinjaman|penaksir)\b/i,
    clarificationQuestion: 'Layanan pegadaian ini fokus ke penerimaan barang gadai, penebusan barang gadai oleh nasabah, atau dua-duanya?',
    optionALabel: 'Penerimaan barang gadai (fokus taksiran & pinjaman)',
    optionBLabel: 'Penebusan barang gadai (fokus pelunasan & tebus barang)',
    optionBothLabel: 'Dua-duanya (terima gadai dan penebusan barang)',
    directionKeywords: /\b(tebus|penebusan|menebus|ambil\s+kembali|pelunasan|hanya\s+terima|hanya\s+gadai|hanya\s+tebus|gadai\s+dan\s+tebus|tebus\s+dan\s+gadai)\b/i
  },
  {
    id: 'tukar_tambah',
    // Tukar tambah kendaraan: jual unit lama DAN terima/beli unit baru
    patternA: /\b(tukar\s*tambah|trade.?in|beli\s+unit\s+baru|jual\s+unit|penjualan)\b/i,
    patternB: /\b(terima\s+unit\s+lama|appraisal|taksir\s+harga|harga\s+kendaraan\s+lama|unit\s+lama|bekas|pembelian)\b/i,
    nameA: 'Penjualan Unit Baru',
    nameB: 'Penerimaan & Appraisal Unit Lama',
    entity: 'kendaraan tukar tambah',
    entityCheck: /\b(tukar\s*tambah|trade.?in)\b/i,
    clarificationQuestion: 'Layanan tukar tambah ini fokus ke penjualan unit baru, penerimaan & appraisal unit lama, atau dua-duanya?',
    optionALabel: 'Penjualan unit baru (fokus transaksi unit baru)',
    optionBLabel: 'Penerimaan unit lama (fokus inspeksi & appraisal unit bekas)',
    optionBothLabel: 'Dua-duanya (penjualan unit baru dan penerimaan unit lama)',
    directionKeywords: /\b(hanya\s+jual|hanya\s+terima|unit\s+baru\s+saja|unit\s+lama\s+saja|jual\s+dan\s+terima|terima\s+dan\s+jual|appraisal\s+saja)\b/i
  }
];

/**
 * Mengecek apakah prompt awal user masuk ke domain yang ambigu arah bisnisnya
 * (toko emas, pegadaian, tukar tambah) tanpa menyebut kata kunci arah spesifik.
 *
 * Single source of truth: menggunakan DUAL_PROCESS_PATTERNS.
 */
export function detectAmbiguousStorylineDomain(prompt: string): {
  pattern: DualProcessPattern;
} | null {
  const clean = prompt.trim().toLowerCase();
  if (!clean) return null;

  for (const pattern of DUAL_PROCESS_PATTERNS) {
    // 1. Cek apakah prompt menyebut entitas / nama domain ini
    if (!pattern.entityCheck.test(clean)) continue;

    // 2. Cek apakah prompt SUDAH menyebut kata kunci arah spesifik
    if (pattern.directionKeywords.test(clean)) continue;

    // Entitas cocok tapi tidak ada arah eksplisit -> domain ambigu!
    return { pattern };
  }

  return null;
}

export interface DynamicClarificationData {
  pertanyaan: string;
  opsiA: string;
  opsiB: string;
  opsiBoth?: string;
  nameA?: string;
  nameB?: string;
}

/**
 * Menyusun GuidedStepPayload kartu klarifikasi arah bisnis sebelum narasi dibuat.
 * Mendukung data dinamis dari analisis AI maupun pattern statis.
 */
export function buildDirectionClarificationCard(
  data: DynamicClarificationData | DualProcessPattern
): GuidedStepPayload {
  const pertanyaan = 'pertanyaan' in data ? data.pertanyaan : data.clarificationQuestion;
  const opsiA = 'opsiA' in data ? data.opsiA : data.optionALabel;
  const opsiB = 'opsiB' in data ? data.opsiB : data.optionBLabel;
  const opsiBoth =
    'opsiBoth' in data && data.opsiBoth
      ? data.opsiBoth
      : 'optionBothLabel' in data
        ? data.optionBothLabel
        : 'Dua-duanya (melayani kedua proses secara setara)';
  const nameA = 'nameA' in data && data.nameA ? data.nameA : opsiA;
  const nameB = 'nameB' in data && data.nameB ? data.nameB : opsiB;

  return {
    stepId: 'STORYTELLING',
    title: pertanyaan,
    multi: false,
    allowOther: true,
    options: [
      {
        id: 'dir_A_only',
        label: `🛒 ${opsiA}`,
        description: `Fokus utama pada alur ${nameA.toLowerCase()}.`
      },
      {
        id: 'dir_B_only',
        label: `📥 ${opsiB}`,
        description: `Fokus utama pada alur ${nameB.toLowerCase()}.`
      },
      {
        id: 'dir_both',
        label: `⚖️ ${opsiBoth}`,
        description: `Melayani kedua proses secara setara dan sama-sama rutin.`,
        recommended: true
      }
    ]
  };
}

/**
 * Mendeteksi apakah narasi/alur yang sudah lengkap memiliki dua proses inti yang setara.
 * SUMBER KEBENARAN TUNGGAL: Hasil analisis konseptual AI di storyline atau session state.
 * Tidak ada lagi hardcoded regex list nama domain.
 */
export function detectDualProcess(session: MockupSessionState): {
  isDual: boolean;
  processA: string;
  processB: string;
  entity: string;
} | null {
  // Guard: kalau dualFlowPending atau kasusGanda sudah ada, jangan deteksi ulang
  if (session.flow?.dualFlowPending || (session.flow?.kasusGanda && session.flow.kasusGanda.length > 0)) {
    return null;
  }

  // 1. Cek dari flag dualFlowPreDecided / dualProcessNames (disimpan saat klarifikasi di STORYTELLING)
  if (session.flow?.dualFlowPreDecided && session.flow?.dualProcessNames) {
    return {
      isDual: true,
      processA: session.flow.dualProcessNames.processA,
      processB: session.flow.dualProcessNames.processB,
      entity: session.match.businessCategory || 'operasional'
    };
  }

  // 2. Cek dari hasil analisis konseptual AI di storyline
  const analisis = session.storyline?.analisisArah;
  if (analisis && analisis.kondisi === 'DUA_ARAH' && analisis.duaArah) {
    return {
      isDual: true,
      processA: analisis.duaArah.prosesA,
      processB: analisis.duaArah.prosesB,
      entity: analisis.duaArah.entitasBersama || session.match.businessCategory || 'operasional'
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

  const findGovernanceStaff = (): string | undefined => {
    const candidates = [
      ...(session.roles?.selected || []),
      ...(session.roles?.wajib || []),
      ...(session.storyline?.asumsiAktor || [])
    ];
    for (const c of candidates) {
      if (isSuperAdminRole(c) || isExternalRole(c)) continue;
      if (isGovernanceRole(c, session.storyline?.detailAktor)) {
        return resolveActorForStep(c, session.roles);
      }
    }
    return undefined;
  };

  const governanceStaff = findGovernanceStaff();

  // Helper mencari role staf operasional (non-Owner, non-eksternal, dan non-governance jika ada pilihan staf operasional)
  const findOperationalStaff = (preferredName?: string): string => {
    const selected = session.roles?.selected || [];
    const wajib = session.roles?.wajib || [];
    const allCandidates = [
      ...wajib.filter((r) => !isSuperAdminRole(r) && !isExternalRole(r)),
      ...selected.filter((r) => !isSuperAdminRole(r) && !isExternalRole(r)),
      ...(session.storyline?.asumsiAktor || []).filter((r) => !isSuperAdminRole(r) && !isExternalRole(r))
    ];

    if (preferredName) {
      const prefClean = preferredName.trim().toLowerCase();
      const match = allCandidates.find((c) => c.toLowerCase().includes(prefClean) || prefClean.includes(c.toLowerCase()));
      if (match) return resolveActorForStep(match, session.roles);
    }

    // Prioritaskan staf operasional murni (bukan governance jika staf operasional tersedia)
    const operationalOnly = allCandidates.filter((c) => !isGovernanceRole(c, session.storyline?.detailAktor));
    const candidates = operationalOnly.length > 0 ? operationalOnly : allCandidates;

    if (candidates.length > 0) {
      return resolveActorForStep(candidates[0], session.roles);
    }

    const detected = detectCoreOperationalRole(session);
    if (!isExternalRole(detected) && !isSuperAdminRole(detected) && !isGovernanceRole(detected, session.storyline?.detailAktor)) {
      return resolveActorForStep(detected, session.roles);
    }

    return 'Kasir Operasional';
  };

  const findCustomerActor = (): string => {
    const candidates = [
      ...(session.roles?.selected || []),
      ...(session.storyline?.asumsiAktor || [])
    ];
    for (const c of candidates) {
      if (/\b(petugas|staf|staff|kasir|sales|admin|montir|mekanik|appraisal|teller)\b/i.test(c)) continue;
      if (isExternalRole(c)) {
        return resolveActorForStep(c, session.roles);
      }
    }
    return 'Pelanggan';
  };

  const customerActor = findCustomerActor();

  const pemisahanRole = session.storyline?.analisisArah?.duaArah?.pemisahanRole;
  let actorA = findOperationalStaff();
  let actorB = findOperationalStaff();

  if (pemisahanRole?.keputusan === 'PISAH') {
    if (pemisahanRole.roleKasusA) {
      actorA = findOperationalStaff(pemisahanRole.roleKasusA);
    }
    if (pemisahanRole.roleKasusB) {
      actorB = findOperationalStaff(pemisahanRole.roleKasusB);
    }
  }

  // Jaminan anti-tabrakan: actorA dan actorB TIDAK BOLEH sama dengan customerActor atau merupakan pihak eksternal
  if (isExternalRole(actorA) || actorA.toLowerCase() === customerActor.toLowerCase()) {
    actorA = findOperationalStaff();
  }
  if (isExternalRole(actorB) || actorB.toLowerCase() === customerActor.toLowerCase()) {
    actorB = findOperationalStaff();
  }

  // Pembangkitan langkah alur inti per-kasus yang kaya dan grounded ke siklus nyata
  const generateCaseSteps = (
    procName: string,
    operActor: string,
    isA: boolean
  ): FlowStepItem[] => {
    const pLower = procName.toLowerCase();

    // 1. Sisi Pinjaman / Kredit (Pengajuan -> Verifikasi -> Akad -> Pencairan -> Monitoring)
    if (/pinjam|kredit|pembiayaan/i.test(pLower)) {
      const approvalActor = governanceStaff || operActor;
      const oversightActor = governanceStaff || activeOwner;
      const approvalAction = governanceStaff
        ? `Menyetujui plafon kredit, tenor bunga, dan menandatangani akad pinjaman bersama ${customerActor.toLowerCase()}`
        : `Menyepakati plafon, tenor bunga, dan menandatangani akad perjanjian pinjaman bersama ${customerActor.toLowerCase()}`;
      const oversightAction = governanceStaff
        ? 'Memantau rekapitulasi penyaluran kredit, total dana dicairkan, dan portofolio pinjaman berkala'
        : 'Memantau rekapitulasi penyaluran kredit, total dana dicairkan, dan pembayaran angsuran';

      return [
        { step: 1, pelaku: customerActor, aksi: 'Mengajukan permohonan pinjaman dana dan melengkapi berkas persyaratan' },
        { step: 2, pelaku: operActor, aksi: 'Memeriksa kelengkapan berkas, riwayat keanggotaan, dan menganalisis kelayakan pinjaman' },
        { step: 3, pelaku: approvalActor, aksi: approvalAction },
        { step: 4, pelaku: operActor, aksi: `Mencairkan dana pinjaman kepada ${customerActor.toLowerCase()} dan mencatat jadwal angsuran berkala` },
        { step: 5, pelaku: oversightActor, aksi: oversightAction }
      ];
    }

    // 2. Sisi Simpanan / Tabungan (Setoran -> Hitung Uang -> Catat Buku -> Struk -> Kas Rekap)
    if (/simpan|tabung|setor/i.test(pLower)) {
      const oversightActor = governanceStaff || activeOwner;
      const oversightAction = governanceStaff
        ? 'Memantau mutasi kas simpanan masuk dan rekapitulasi likuiditas harian koperasi'
        : 'Memantau mutasi kas simpanan masuk dan total saldo likuiditas harian koperasi';

      return [
        { step: 1, pelaku: customerActor, aksi: 'Membawa buku tabungan dan menyerahkan uang tunai untuk setoran simpanan' },
        { step: 2, pelaku: operActor, aksi: 'Menghitung jumlah setoran tunai secara teliti dan memverifikasi data keanggotaan' },
        { step: 3, pelaku: operActor, aksi: `Mencatat transaksi setoran dan mencetak pembaruan saldo di buku tabungan ${customerActor.toLowerCase()}` },
        { step: 4, pelaku: operActor, aksi: `Menyerahkan bukti setoran resmi serta buku tabungan kembali kepada ${customerActor.toLowerCase()}` },
        { step: 5, pelaku: oversightActor, aksi: oversightAction }
      ];
    }

    // 3. Sisi Valas (Money Changer Beli vs Jual)
    if (/valas|kurs|uang asing/i.test(pLower)) {
      if (/beli|pembelian/i.test(pLower)) {
        return [
          { step: 1, pelaku: customerActor, aksi: 'Membawa mata uang asing untuk ditukarkan ke mata uang Rupiah' },
          { step: 2, pelaku: operActor, aksi: 'Memeriksa keaslian pecahan valas menggunakan detektor UV dan menghitung kurs beli' },
          { step: 3, pelaku: operActor, aksi: 'Mengonfirmasi nominal hasil konversi dan mencetak nota transaksi penukaran' },
          { step: 4, pelaku: operActor, aksi: `Menyerahkan uang Rupiah dan nota resmi transaksi kepada ${customerActor.toLowerCase()}` },
          { step: 5, pelaku: activeOwner, aksi: 'Memantau rekapitulasi stok valas masuk dan mutasi kas penukaran harian' }
        ];
      } else {
        return [
          { step: 1, pelaku: customerActor, aksi: 'Mengajukan kebutuhan pecahan mata uang asing dan memeriksa ketersediaan stok' },
          { step: 2, pelaku: operActor, aksi: 'Menghitung total pembayaran Rupiah berdasarkan kurs jual yang berlaku' },
          { step: 3, pelaku: operActor, aksi: 'Menerima pembayaran tunai/transfer dan mencetak bukti penukaran valas resmi' },
          { step: 4, pelaku: operActor, aksi: `Menyerahkan lembaran valas asli sesuai denominasi yang diminta ${customerActor.toLowerCase()}` },
          { step: 5, pelaku: activeOwner, aksi: 'Memantau rekapitulasi penjualan valas harian dan sisa stok brankas' }
        ];
      }
    }

    // 4. Default Kasus A (Transaksi Keluar / Penjualan)
    if (isA) {
      return [
        { step: 1, pelaku: customerActor, aksi: `Mengajukan permintaan ${pLower} dan memilih item yang diinginkan` },
        { step: 2, pelaku: operActor, aksi: `Memeriksa ketersediaan, kondisi, dan kesiapan transaksi ${pLower.replace(/ke\s*pelanggan|unit\s*baru/i, 'item').trim()}` },
        { step: 3, pelaku: operActor, aksi: `Menyepakati nilai transaksi dan menyiapkan dokumen ${pLower}` },
        { step: 4, pelaku: operActor, aksi: `Menyerahkan item/layanan dan menerima pembayaran dari ${customerActor.toLowerCase()}` },
        { step: 5, pelaku: activeOwner, aksi: `Memantau rekapitulasi ${pLower} harian dan performa omzet` }
      ];
    }

    // 5. Default Kasus B (Transaksi Masuk / Pembelian / Appraisal)
    return [
      { step: 1, pelaku: customerActor, aksi: `Membawa item/pengajuan untuk proses ${pLower}` },
      { step: 2, pelaku: operActor, aksi: `Memeriksa fisik, keaslian/kondisi teknis, dan menaksir nilai ${pLower.replace(/dari\s*pelanggan|unit\s*lama/i, 'item').trim()}` },
      { step: 3, pelaku: operActor, aksi: `Menyepakati nilai taksiran dan menyiapkan dokumen transaksi ${pLower}` },
      { step: 4, pelaku: operActor, aksi: `Menyerahkan pembayaran atau nota transaksi kepada ${customerActor.toLowerCase()}` },
      { step: 5, pelaku: activeOwner, aksi: `Memantau rekapitulasi ${pLower} dan pencatatan transaksi masuk` }
    ];
  };

  // Validasi Anti-Nonsense (Safety Guard)
  const sanitizeStep = (step: FlowStepItem, operActor: string): FlowStepItem => {
    let { step: stepNum, pelaku, aksi } = step;

    // 1. Cek kalimat self-referential yang mustahil:
    // Jika pelaku adalah pihak eksternal, tapi aksinya mengarah kepada/dari pihak yang sama
    const targetPattern = new RegExp(`\\b(kepada|ke|dari|untuk|bersama)\\s+${pelaku.toLowerCase()}\\b`, 'i');
    if ((isExternalRole(pelaku) || pelaku.toLowerCase() === customerActor.toLowerCase()) && targetPattern.test(aksi)) {
      pelaku = operActor;
    }

    // 2. Jika pelaku eksternal melakukan tugas operasional staf internal:
    if (isExternalRole(pelaku) || pelaku.toLowerCase() === customerActor.toLowerCase()) {
      const isStaffAction = /\b(memeriksa\s+kelengkapan|menganalisis\s+kelayakan|mencairkan\s+dana|menghitung\s+jumlah|mencatat\s+transaksi|memverifikasi\s+data|menyerahkan\s+(?:bukti|uang|lembaran|item|pembayaran|nota)|menaksir\s+nilai|mencetak\s+(?:pembaruan|bukti|nota))\b/i.test(aksi);
      if (isStaffAction) {
        pelaku = operActor;
      }
    }

    // 3. Jika pelaku operasional staf tertukar melakukan tindakan pemicu awal customer
    if (!isExternalRole(pelaku) && !isSuperAdminRole(pelaku)) {
      const isCustomerTrigger = /\b(membawa\s+buku\s+tabungan|mengajukan\s+permohonan\s+pinjaman|membawa\s+mata\s+uang\s+asing|mengajukan\s+kebutuhan\s+pecahan|mengajukan\s+permintaan|membawa\s+item)\b/i.test(aksi);
      if (isCustomerTrigger) {
        pelaku = customerActor;
      }
    }

    return { step: stepNum, pelaku: resolveActorForStep(pelaku, session.roles), aksi };
  };

  const alurA = generateCaseSteps(processA, actorA, true);
  const alurB = generateCaseSteps(processB, actorB, false);

  return [
    { nama: processA, alurInti: alurA.map((s) => sanitizeStep(s, actorA)) },
    { nama: processB, alurInti: alurB.map((s) => sanitizeStep(s, actorB)) }
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

export function renderRbacMarkdownTable(
  roles: string[],
  modulList: { nama: string; deskripsiFungsional?: string; izinPerRole: { role: string; level: string; keterangan?: string }[] }[],
  catatanPelimpahan?: string[]
): string {
  if (!roles || roles.length === 0 || !modulList || modulList.length === 0) return '';

  const header = `| Modul Fungsional | ${roles.join(' | ')} |`;
  const divider = `| :--- | ${roles.map(() => ':---').join(' | ')} |`;

  const rows = modulList.map((m) => {
    const cells = roles.map((r) => {
      const match = m.izinPerRole.find(
        (ip) => ip.role.trim().toLowerCase() === r.trim().toLowerCase()
      );
      if (!match || !match.level || match.level.trim() === '-' || /tidak ada|tidak memiliki/i.test(match.level)) {
        return '-';
      }
      return match.level.trim();
    });
    const moduleName = m.deskripsiFungsional
      ? `**${m.nama}**<br>*${m.deskripsiFungsional}*`
      : `**${m.nama}**`;
    return `| ${moduleName} | ${cells.join(' | ')} |`;
  });

  let table = `${header}\n${divider}\n${rows.join('\n')}`;

  if (catatanPelimpahan && catatanPelimpahan.length > 0) {
    table +=
      `\n\n> ℹ️ **Catatan Wewenang & Pelimpahan Tugas:**\n` +
      catatanPelimpahan.map((c) => `> - ${c}`).join('\n');
  }

  return table;
}

function buildRbacStep(session: MockupSessionState): GuidedStepPayload {
  const isRevising = Boolean(session.rbac?.revisiCount && session.rbac.revisiCount > 0);
  const totalModul = session.rbac?.modul?.length || 0;
  return {
    stepId: 'RBAC',
    title: 'Matriks Hak Akses & Pembagian Wewenang Role',
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'confirm_rbac',
        label: '✅ Sudah pas, lanjut ke Skema Data',
        recommended: true,
        description:
          totalModul > 0
            ? `Hak akses ${totalModul} modul fungsional per peran sudah sesuai kebutuhan operasional.`
            : 'Pembagian wewenang dan batasan akses antar-peran sudah tepat.'
      },
      {
        id: 'koreksi_rbac',
        label: isRevising ? '✏️ Masih ada koreksi hak akses role' : '✏️ Ada koreksi hak akses role',
        description: 'Tuliskan modul atau peran mana yang hak akses/wewenangnya perlu disesuaikan.',
        requiresInput: true,
        inputPlaceholder: 'Contoh: Kasir jangan diberi akses hapus data, atau Penyewa boleh batalkan booking sendiri...'
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
    const feedbackText = (other || '').trim();
    const hasSpecificDetails =
      feedbackText.length >= 25 ||
      /\b(bayar|pembayaran|tunai|transfer|harga|timbang|timbangan|berat|nominal|nota|struk|kwitansi|warga|pelanggan|gudang|pengepul|pengumpul|sopir|kurir|kasir|staf|admin|jemput|setor|pilah|sortir|kirim|jadwal|waktu|langsung|di tempat|lokasi|alur|tahap|langkah)\b/i.test(
        feedbackText
      );

    const isExplicitMismatchWithoutDetails =
      selected.includes('mismatch_story') && !hasSpecificDetails;
    const isTextMismatchWithoutDetails =
      Boolean(feedbackText) &&
      !hasSpecificDetails &&
      /^(meleset\s*jauh|salah\s*(semua|total)|bukan\s*begitu|keliru\s*total|bukan\s*ini)$/i.test(feedbackText);

    const isMismatch = isExplicitMismatchWithoutDetails || isTextMismatchWithoutDetails;

    const isConfirm =
      selected.includes('confirm_story') ||
      (!feedbackText && selected.length === 0 && !selected.includes('minor_adjust') && !isMismatch) ||
      (Boolean(feedbackText) &&
        !selected.includes('minor_adjust') &&
        !isMismatch &&
        !hasSpecificDetails &&
        /^(ya|oke|ok|sudah|pas|lanjut|benar|betul|sesuai|setuju|mantap|sip)\b/i.test(feedbackText));

    const existingStory = next.storyline || {
      narasi: other || selected.join(' '),
      asumsiMasalah: '',
      asumsiAktor: next.match.contextualRoles || ['Super Admin', 'Staf', 'Pelanggan'],
      asumsiAlurUtama: '',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      riwayatKoreksi: []
    };

    const currentRevisi = existingStory.revisiCount || 0;
    const prevRiwayat = existingStory.riwayatKoreksi || [];
    const newRiwayat = feedbackText ? [...prevRiwayat, feedbackText] : prevRiwayat;

    if (isMismatch) {
      next.storyline = {
        ...existingStory,
        statusKonfirmasi: 'dikoreksi',
        modeKlarifikasiBertahap: true,
        revisiCount: currentRevisi + 1,
        riwayatKoreksi: newRiwayat
      };
      next.step = 'STORYTELLING';
      return next;
    }

    if (isConfirm) {
      next.storyline = {
        ...existingStory,
        narasi: other ? `${existingStory.narasi} (Catatan: ${other})` : existingStory.narasi,
        statusKonfirmasi: 'disetujui',
        modeKlarifikasiBertahap: false,
        revisiCount: currentRevisi,
        riwayatKoreksi: newRiwayat
      };
      next.step = 'ROLE';
      return next;
    }

    // Jika koreksi kecil (minor_adjust / other):
    // Sesi TETAP berada di step STORYTELLING untuk ditampilkan ulang!
    next.storyline = {
      ...existingStory,
      narasi: other ? `${existingStory.narasi} (Catatan: ${other})` : existingStory.narasi,
      statusKonfirmasi: 'dikoreksi',
      modeKlarifikasiBertahap: false,
      revisiCount: currentRevisi + 1,
      riwayatKoreksi: newRiwayat
    };
    next.step = 'STORYTELLING';
    return next;
  } else if (stepId === 'ROLE') {
    const offeredStep = buildRoleStep(session);
    const coreOptions = offeredStep.options.filter((o) => o.roleStatus === 'WAJIB_INTI');
    const coreRoles =
      coreOptions.length > 0 ? coreOptions.map((o) => o.id) : [detectCoreOperationalRole(session)];
    let selectedRoles = dedupeRoleLabels(selected.length > 0 ? selected : [REQUIRED_ROLE, ...coreRoles]);
    if (!selectedRoles.includes(REQUIRED_ROLE)) {
      selectedRoles = [REQUIRED_ROLE, ...selectedRoles];
    }
    if (other && other.trim() && !selectedRoles.includes(other.trim())) {
      selectedRoles.push(other.trim());
    }

    const wajib = [REQUIRED_ROLE];
    for (const cr of coreRoles) {
      if (cr && cr !== REQUIRED_ROLE && !wajib.includes(cr)) {
        wajib.push(cr);
      }
    }

    const tambahan = selectedRoles.filter((r) => !wajib.includes(r));

    // Cek role yang ditawarkan tapi tidak dipilih (dihapus/dideselect oleh user)
    const offeredRoles = offeredStep.options.map((o) => o.id);
    const removedRoles = offeredRoles.filter((r) => !selectedRoles.includes(r) && r !== REQUIRED_ROLE);

    const tugasDilimpahkan: { dariRole: string; keRole: string; daftarTugas: string[] }[] = [];
    const removedExternalRoles: string[] = [];

    for (const r of removedRoles) {
      if (isExternalRole(r)) {
        // Peran eksternal (Pelanggan, Warga, Penyewa, Pasien, dll) adalah pihak yang dilayani
        // Tindakan transaksi mereka TIDAK dilimpahkan ke Owner/Admin
        removedExternalRoles.push(r);
      } else {
        // Peran operasional / staf internal dilimpahkan ke Owner jika dihapus
        const details = getRoleNarrativeAndResponsibilities(r, session.match.businessCategory, session.storyline);
        if (details.tanggungJawab.length > 0) {
          tugasDilimpahkan.push({
            dariRole: r,
            keRole: REQUIRED_ROLE,
            daftarTugas: details.tanggungJawab
          });
        }
      }
    }

    next.roles = {
      selected: selectedRoles,
      wajib,
      tambahan,
      tugasDilimpahkan,
      removedExternalRoles,
      ...(other ? { other } : {})
    };

    // Bersihkan seluruh cache alur lama agar saat masuk ke ALUR, alur kerja
    // dan atribusi pelaku di-generate ulang secara menyeluruh dari peran terkini
    if (next.flow) {
      delete next.flow.alurInti;
      delete next.flow.alurPendukung;
      delete next.flow.fiturPendukung;
      delete next.flow.kasusGanda;
    }
    // SYARAT TAMBAHAN 1: Bersihkan cache RBAC saat daftar role berubah
    delete next.rbac;
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

    // SYARAT TAMBAHAN 1: Bersihkan cache RBAC saat alur kerja berubah
    delete next.rbac;
  } else if (stepId === 'RBAC') {
    if (next.rbac) {
      next.rbac.statusKonfirmasi = 'disetujui';
    }
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
    if (session.rbac?.modul && session.rbac.modul.length > 0) {
      lines.push('- **Matriks Hak Akses (RBAC) per Modul Fungsional**:');
      const tableMd = session.rbac.markdownTable || renderRbacMarkdownTable(roles, session.rbac.modul, session.rbac.catatanPelimpahan);
      lines.push(tableMd);
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
