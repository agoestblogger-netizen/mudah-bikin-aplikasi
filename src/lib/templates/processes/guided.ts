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
  // 1. Dari aktor cerita bisnis (asumsiAktor)
  const actors = session.storyline?.asumsiAktor || session.match.contextualRoles || [];
  for (const a of actors) {
    const clean = a.trim();
    const key = canonicalRoleKey(clean);
    if (key !== 'super-admin' && key !== 'owner' && key !== 'customer' && !GENERIC_ROLE_RE.test(clean)) {
      return EN_ROLE_LABEL_MAP[clean.toLowerCase()] || clean;
    }
  }

  // 2. Dari overlay industri
  const overlays = getIndustryOverlaysByIds(session.match.overlayIds);
  for (const o of overlays) {
    for (const r of o.roleLabels) {
      const key = canonicalRoleKey(r);
      if (key !== 'super-admin' && key !== 'owner' && key !== 'customer') {
        return EN_ROLE_LABEL_MAP[r.toLowerCase()] || r;
      }
    }
  }

  // 3. Fallback
  return 'Kasir';
}

export function getRoleNarrativeAndResponsibilities(
  roleLabel: string,
  businessCategory?: string
): RoleDetailDefinition {
  const clean = roleLabel.trim();
  const key = canonicalRoleKey(clean);
  const cat = businessCategory || 'bisnis ini';

  switch (key) {
    case 'super-admin':
    case 'owner':
      return {
        narasi: `Pemilik usaha atau penanggung jawab utama operasional ${cat}. Memastikan seluruh aktivitas berjalan tertib, memantau omzet dan laporan harian, serta mengatur akun staf yang bertugas.`,
        tanggungJawab: [
          'Memantau ringkasan omzet, transaksi, dan laporan operasional harian',
          'Mendaftarkan dan mengelola akun staf yang bertugas',
          'Mengubah pengaturan umum aplikasi dan alur kerja utama'
        ]
      };

    case 'cashier':
      return {
        narasi: 'Petugas garda depan yang melayani pembeli langsung di meja transaksi harian. Memasukkan pesanan dengan teliti, menerima pembayaran, dan mencetak bukti belanja.',
        tanggungJawab: [
          'Mencatat transaksi belanja pesanan pelanggan',
          'Menerima pembayaran tunai maupun digital dan mencetak nota',
          'Membuat laporan rekap kas masuk di akhir giliran kerja'
        ]
      };

    case 'warehouse':
      return {
        narasi: 'Petugas yang bertanggung jawab atas ketersediaan dan penyimpanan barang di lokasi. Memastikan stok yang datang dari pemasok dicatat rapi dan rak jualan selalu terisi.',
        tanggungJawab: [
          'Mencatat penerimaan barang baru dari pemasok',
          'Memperbarui jumlah stok barang masuk dan keluar',
          'Mendata barang rusak atau kedaluwarsa untuk pengembalian (retur)'
        ]
      };

    case 'customer':
      return {
        narasi: 'Pembeli atau pelanggan yang menikmati produk dan layanan yang Anda tawarkan. Dapat melihat pilihan produk, memesan secara mandiri, dan menyimpan bukti transaksi.',
        tanggungJawab: [
          'Melihat katalog produk atau daftar layanan yang tersedia',
          'Membuat pesanan mandiri secara cepat',
          'Melihat riwayat belanja dan bukti nota pembayaran'
        ]
      };

    case 'medical':
      return {
        narasi: 'Tenaga ahli yang menangani pemeriksaan, perawatan, dan tindakan klinis. Memastikan riwayat kesehatan dan instruksi perawatan tercatat akurat dan aman.',
        tanggungJawab: [
          'Mencatat hasil pemeriksaan awal dan diagnosis kondisi',
          'Menentukan resep obat dan jadwal perawatan rutin',
          'Memantau catatan perkembangan kondisi pasien secara berkala'
        ]
      };

    case 'kitchen':
      return {
        narasi: 'Staf pengolah pesanan di area produksi atau dapur. Menerima tiket pesanan yang masuk dan menyiapkan pesanan pelanggan sesuai standar mutu terbaik.',
        tanggungJawab: [
          'Melihat antrean tiket pesanan yang harus segera diproses',
          'Mengubah status pesanan menjadi sedang dimasak hingga siap saji',
          'Memantau ketersediaan bahan baku di area kerja'
        ]
      };

    case 'waiter':
      return {
        narasi: 'Staf pelayanan yang menyapa pengunjung dan mengantar pesanan langsung ke meja. Memastikan kebutuhan pengunjung terpenuhi dengan ramah dan cepat.',
        tanggungJawab: [
          'Mencatat pesanan dari meja pengunjung secara langsung',
          'Mengantarkan pesanan yang sudah siap ke meja pelanggan',
          'Membantu permintaan tambahan dari pelanggan'
        ]
      };

    case 'technician':
      return {
        narasi: 'Tenaga lapangan yang menangani perbaikan, pemasangan, dan pemeliharaan unit kerja. Melakukan inspeksi kendala dan mencatat suku cadang yang digunakan.',
        tanggungJawab: [
          'Melakukan diagnosis kendala dan pekerjaan perbaikan unit',
          'Mencatat pemakaian suku cadang dan bahan perbaikan',
          'Menandai status pekerjaan selesai untuk penyerahan ke pelanggan'
        ]
      };

    case 'driver':
      return {
        narasi: 'Petugas pengantaran yang membawa paket pesanan ke alamat pelanggan. Memastikan barang sampai tepat waktu dalam kondisi aman dan rapi.',
        tanggungJawab: [
          'Melihat daftar rute dan alamat pengiriman hari ini',
          'Mengubah status pengiriman saat barang sedang di jalan',
          'Mengambil foto bukti serah-terima saat paket sampai di tujuan'
        ]
      };

    case 'teacher':
      return {
        narasi: 'Pendidik yang membimbing siswa dan mengelola kelas. Mencatat kehadiran siswa, membagikan materi pelajaran, dan menilai tugas evaluasi.',
        tanggungJawab: [
          'Mencatat absensi kehadiran siswa di setiap sesi kelas',
          'Membagikan materi pelajaran dan tugas belajar harian',
          'Menginput nilai tugas dan catatan evaluasi belajar siswa'
        ]
      };

    case 'front-office':
      return {
        narasi: 'Penyambut pertama tamu di lobi atau loket pendaftaran. Membantu registrasi awal, membagikan nomor antrean, dan memberikan informasi yang dibutuhkan.',
        tanggungJawab: [
          'Mencatat pendaftaran tamu atau pengunjung baru',
          'Mengatur nomor antrean dan ruang janji temu',
          'Menjawab pertanyaan umum pelanggan dengan ramah'
        ]
      };

    default:
      return {
        narasi: `Staf operasional yang membantu menjalankan aktivitas harian untuk ${clean} di ${cat}. Berfokus pada pencatatan tugas dan koordinasi di lapangan agar layanan selesai tepat waktu.`,
        tanggungJawab: [
          `Mencatat dan memperbarui aktivitas harian terkait ${clean}`,
          `Menangani kebutuhan data operasional di lapangan`,
          `Melaporkan penyelesaian tugas kepada penanggung jawab`
        ]
      };
  }
}

export function renderRoleSummaryTable(
  rolesState: MockupSessionState['roles'],
  businessCategory?: string
): string {
  const lines: string[] = [];
  lines.push('| Role | Status | Tanggung Jawab Utama |');
  lines.push('|---|---|---|');

  const wajibSet = new Set(rolesState.wajib || [REQUIRED_ROLE]);
  const activeRoles = rolesState.selected || [REQUIRED_ROLE];

  for (const role of activeRoles) {
    const isOwner = role === REQUIRED_ROLE;
    const isWajib = wajibSet.has(role);
    const status = isOwner ? 'Wajib (Owner)' : isWajib ? 'Wajib (Alur Inti)' : 'Tambahan';

    const details = getRoleNarrativeAndResponsibilities(role, businessCategory);
    const nativeTasks = details.tanggungJawab.slice(0, 2).join('; ');

    // Cek tugas yang dilimpahkan ke role ini
    const delegatedTasks = (rolesState.tugasDilimpahkan || [])
      .filter((d) => d.keRole === role)
      .flatMap((d) => d.daftarTugas.map((t) => `_${t} (dilimpahkan dari ${d.dariRole})_`));

    let responsibilitiesCol = nativeTasks;
    if (delegatedTasks.length > 0) {
      responsibilitiesCol += '<br>' + delegatedTasks.join('<br>');
    }

    lines.push(`| ${role} | ${status} | ${responsibilitiesCol} |`);
  }

  return lines.join('\n');
}

function buildRoleStep(session: MockupSessionState): GuidedStepPayload {
  const patterns = getProcessPatternsByIds(session.match.patternIds);
  const overlays = getIndustryOverlaysByIds(session.match.overlayIds);
  const template = session.match.templateId ? getMasterTemplateById(session.match.templateId) : undefined;

  const seen = new Set<string>([canonicalRoleKey(REQUIRED_ROLE)]);
  const candidateLabels: string[] = [];

  const addCandidate = (label: string) => {
    const clean = label.trim();
    if (!clean || GENERIC_ROLE_RE.test(clean)) return;
    const key = canonicalRoleKey(clean);
    if (seen.has(key)) return;
    seen.add(key);
    candidateLabels.push(EN_ROLE_LABEL_MAP[clean.toLowerCase()] || clean);
  };

  // 1. Peran dari asumsi cerita bisnis (storyline) - Prioritas paling utama
  if (session.storyline?.asumsiAktor && session.storyline.asumsiAktor.length > 0) {
    session.storyline.asumsiAktor.forEach(addCandidate);
  }

  // 2. Peran kontekstual dari hasil pemetaan AI cerdas (diposisikan setelah aktor cerita)
  if (session.match.contextualRoles && session.match.contextualRoles.length > 0) {
    session.match.contextualRoles.forEach(addCandidate);
  }

  // 3. Peran khas industri dari overlay
  overlays.forEach((o) => o.roleLabels.forEach(addCandidate));

  // 4. Pelengkap dari Master Template
  if (template) {
    template.roleDefault.forEach(addCandidate);
  }

  // 5. Fallback pola universal
  if (candidateLabels.length < 2) {
    patterns.forEach((p) => p.actors.forEach((a) => addCandidate(a.role)));
  }

  // Tentukan Role Wajib Kedua (Alur Inti)
  const coreRole = detectCoreOperationalRole(session);

  const options: GuidedStepOption[] = [];

  // Super Admin (Owner) selalu wajib & locked
  const ownerDetails = getRoleNarrativeAndResponsibilities(REQUIRED_ROLE, session.match.businessCategory);
  options.push({
    id: REQUIRED_ROLE,
    label: REQUIRED_ROLE,
    description: ownerDetails.narasi,
    responsibilities: ownerDetails.tanggungJawab,
    recommended: true,
    locked: true,
    roleStatus: 'WAJIB_OWNER'
  });

  // Tambahkan role lainnya
  for (const label of candidateLabels) {
    const isCore = label === coreRole;
    const details = getRoleNarrativeAndResponsibilities(label, session.match.businessCategory);
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

function buildAlurStep(session: MockupSessionState): GuidedStepPayload {
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
    stepId: 'ALUR',
    title: 'Alur kerja utama & fitur pendukung aplikasi',
    multi: false,
    allowOther: true,
    options: dedupeOptions(options).slice(0, 10)
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
      const details = getRoleNarrativeAndResponsibilities(r, session.match.businessCategory);
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
    next.flow = {
      ...next.flow,
      ...(selected[0] ? { selectedId: selected[0] } : {}),
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
