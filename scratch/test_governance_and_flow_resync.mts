import {
  getRoleNarrativeAndResponsibilities,
  renderRoleSummaryTable,
  buildKasusGandaFromSession,
  getDomainFlowDetails,
  applyGuidedAnswer,
  isGovernanceRole,
  isExternalRole,
  REQUIRED_ROLE
} from '../src/lib/templates/processes/guided.js';
import { isSuperAdminRole } from '../src/lib/rolePolicy.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log('=== TEST BAGIAN A: SINKRONISASI ALUR & REGENERASI KASUS GANDA SAAT ROLE BERUBAH ===');

// 1. Sesi Awal Koperasi: Super Admin + Kasir Operasional + Anggota
const initialKoperasiSession: MockupSessionState = {
  step: 'ALUR',
  match: {
    templateId: 'MT-20',
    overlayIds: [],
    patternIds: ['UP-06'],
    tier: 'STANDARD',
    businessCategory: 'Koperasi Simpan Pinjam',
    contextualPainPoints: ['Pencatatan manual simpan pinjam'],
    contextualRoles: ['Super Admin', 'Kasir Operasional', 'Anggota']
  },
  storyline: {
    narasi: 'Koperasi simpan pinjam melayani tabungan anggota dan penyaluran kredit pinjaman dana.',
    asumsiMasalah: 'Pengelolaan berkas pengajuan kredit dan tabungan masih manual',
    asumsiAktor: ['Super Admin', 'Kasir Operasional', 'Anggota'],
    asumsiAlurUtama: 'Anggota menyetor tabungan & kasir mencatat saldo buku -> Anggota mengajukan pinjaman dana -> Petugas memverifikasi kelayakan & mencairkan dana pinjaman -> Anggota membayar cicilan berkala -> Pengurus memantau rekap simpan pinjam',
    statusKonfirmasi: 'disetujui',
    revisiCount: 0,
    detailAktor: {
      'Kasir Operasional': {
        narasi: 'Petugas loket kasir yang melayani transaksi simpanan dan pencairan pinjaman anggota.',
        tanggungJawab: [
          'Melayani penerimaan setoran simpanan tunai dan cetak buku tabungan',
          'Memeriksa berkas permohonan pinjaman dana anggota',
          'Mencairkan dana pinjaman yang telah disetujui kepada anggota'
        ]
      },
      'Anggota': {
        narasi: 'Anggota koperasi yang menabung dan mengajukan permohonan pinjaman dana.',
        tanggungJawab: [
          'Menyetorkan tabungan simpanan wajib dan sukarela',
          'Mengajukan permohonan pinjaman dana dan melengkapi persyaratan',
          'Membayar angsuran pinjaman berkala'
        ]
      }
    }
  },
  roles: {
    selected: ['Super Admin', 'Kasir Operasional', 'Anggota'],
    wajib: ['Super Admin', 'Kasir Operasional'],
    tambahan: ['Anggota']
  },
  flow: {
    dualFlowPreDecided: true,
    dualProcessNames: {
      processA: 'Penyaluran Pinjaman Dana',
      processB: 'Penerimaan Simpanan Anggota'
    }
  },
  painPoints: { selected: [] },
  features: { selected: [] }
};

// Bangun alur awal
const initialCases = buildKasusGandaFromSession(
  initialKoperasiSession,
  'Penyaluran Pinjaman Dana',
  'Penerimaan Simpanan Anggota'
);

assert(initialCases.length === 2, 'Alur awal memiliki 2 kasus ganda');
assert(initialCases[0].alurInti[1].pelaku === 'Kasir Operasional', 'Alur awal: Kasus A step 2 pelaku = Kasir Operasional');
assert(initialCases[0].alurInti[2].pelaku === 'Kasir Operasional', 'Alur awal: Kasus A step 3 pelaku = Kasir Operasional');
assert(initialCases[0].alurInti[4].pelaku === 'Super Admin', 'Alur awal: Kasus A step 5 pelaku = Super Admin');

// Simpan alur awal ke session seolah-olah user sudah berada di step ALUR
initialKoperasiSession.flow = {
  ...initialKoperasiSession.flow,
  kasusGanda: initialCases
};

// 2. Sekarang user kembali ke step ROLE dan MENAMBAHKAN "Pengurus Koperasi"
console.log('\nUser menambahkan peran "Pengurus Koperasi" di step ROLE:');
const updatedSessionAfterAddingPengurus = applyGuidedAnswer(
  initialKoperasiSession,
  'ROLE',
  ['Super Admin', 'Kasir Operasional', 'Pengurus Koperasi', 'Anggota']
);

// Pastikan cache alur lama dibersihkan oleh applyGuidedAnswer
assert(!updatedSessionAfterAddingPengurus.flow?.kasusGanda, 'applyGuidedAnswer membersihkan cache flow.kasusGanda lama');
assert(!updatedSessionAfterAddingPengurus.flow?.alurInti, 'applyGuidedAnswer membersihkan cache flow.alurInti lama');

// Regenerasi Kasus Ganda secara penuh dengan daftar peran terbaru
const regeneratedCases = buildKasusGandaFromSession(
  updatedSessionAfterAddingPengurus,
  'Penyaluran Pinjaman Dana',
  'Penerimaan Simpanan Anggota'
);

console.log('\nStruktur Kasus A (Pinjaman Dana) setelah regenerasi:');
regeneratedCases[0].alurInti.forEach((s) => console.log(`  Step ${s.step}: (${s.pelaku}) ${s.aksi}`));

console.log('\nStruktur Kasus B (Simpanan Anggota) setelah regenerasi:');
regeneratedCases[1].alurInti.forEach((s) => console.log(`  Step ${s.step}: (${s.pelaku}) ${s.aksi}`));

// Validasi atribusi peran di Kasus A
assert(regeneratedCases[0].alurInti[0].pelaku === 'Anggota', 'Kasus A Step 1 tetap Anggota');
assert(regeneratedCases[0].alurInti[1].pelaku === 'Kasir Operasional', 'Kasus A Step 2 operasional = Kasir Operasional');
assert(regeneratedCases[0].alurInti[2].pelaku === 'Pengurus Koperasi', 'Kasus A Step 3 persetujuan kredit = Pengurus Koperasi');
assert(regeneratedCases[0].alurInti[3].pelaku === 'Kasir Operasional', 'Kasus A Step 4 pencairan dana = Kasir Operasional');
assert(regeneratedCases[0].alurInti[4].pelaku === 'Pengurus Koperasi', 'Kasus A Step 5 pengawasan portofolio pinjaman = Pengurus Koperasi');

// Validasi atribusi peran di Kasus B
assert(regeneratedCases[1].alurInti[0].pelaku === 'Anggota', 'Kasus B Step 1 tetap Anggota');
assert(regeneratedCases[1].alurInti[1].pelaku === 'Kasir Operasional', 'Kasus B Step 2 hitung setoran = Kasir Operasional');
assert(regeneratedCases[1].alurInti[2].pelaku === 'Kasir Operasional', 'Kasus B Step 3 catat buku = Kasir Operasional');
assert(regeneratedCases[1].alurInti[3].pelaku === 'Kasir Operasional', 'Kasus B Step 4 serah bukti = Kasir Operasional');
assert(regeneratedCases[1].alurInti[4].pelaku === 'Pengurus Koperasi', 'Kasus B Step 5 pantau likuiditas = Pengurus Koperasi');

// Validasi anti-nonsense (tidak ada self-referential)
for (const c of regeneratedCases) {
  for (const s of c.alurInti) {
    const invalidSelf = new RegExp(`\\b(kepada|ke|dari|untuk)\\s+${s.pelaku.toLowerCase()}\\b`, 'i');
    assert(!invalidSelf.test(s.aksi), `Anti-nonsense lolos: (${s.pelaku}) tidak self-referential pada "${s.aksi.slice(0, 35)}..."`);
  }
}

console.log('\n=== TEST BAGIAN B: PEMISAHAN TANGGUNG JAWAB GOVERNANCE DARI SUPER ADMIN ===');

// 1. Koperasi DENGAN Pengurus Koperasi
const superAdminWithGov = getRoleNarrativeAndResponsibilities(
  'Super Admin',
  'Koperasi Simpan Pinjam',
  updatedSessionAfterAddingPengurus.storyline,
  updatedSessionAfterAddingPengurus.roles
);

console.log('Deskripsi Super Admin saat ada Pengurus Koperasi:');
console.log('  Narasi:', superAdminWithGov.narasi);
console.log('  Tanggung Jawab:', superAdminWithGov.tanggungJawab);

// Pastikan Super Admin TIDAK lagi memegang kebijakan bunga/produk/pinjaman
const hasPolicyOrBunga = superAdminWithGov.tanggungJawab.some((t) =>
  /\b(bunga|plafon|pinjaman|simpanan|kebijakan\s*bisnis)\b/i.test(t)
);
assert(!hasPolicyOrBunga, 'Super Admin TIDAK lagi memiliki tugas kebijakan bunga/plafon/produk');

// Pastikan Super Admin fokus ke administrasi sistem & akun pengguna
const hasUserAdmin = superAdminWithGov.tanggungJawab.some((t) =>
  /\b(user|pengguna|akun|staf|hak\s*akses)\b/i.test(t)
);
assert(hasUserAdmin, 'Super Admin memiliki tugas manajemen akun pengguna & hak akses');

const hasSysAdmin = superAdminWithGov.tanggungJawab.some((t) =>
  /\b(sistem|operasional\s*sistem|log\s*audit|teknis|keamanan)\b/i.test(t)
);
assert(hasSysAdmin, 'Super Admin memiliki tugas teknis & pengawasan sistem aplikasi');

// Cek Pengurus Koperasi
const pengurusDetails = getRoleNarrativeAndResponsibilities(
  'Pengurus Koperasi',
  'Koperasi Simpan Pinjam',
  updatedSessionAfterAddingPengurus.storyline,
  updatedSessionAfterAddingPengurus.roles
);
console.log('\nDeskripsi Pengurus Koperasi:');
console.log('  Narasi:', pengurusDetails.narasi);
console.log('  Tanggung Jawab:', pengurusDetails.tanggungJawab);
const pengurusHasGovernance = pengurusDetails.tanggungJawab.some((t) =>
  /\b(kebijakan|bunga|plafon|regulasi|pedoman|evaluasi)\b/i.test(t)
);
assert(pengurusHasGovernance, 'Pengurus Koperasi memegang tugas kebijakan bisnis, bunga/plafon, dan evaluasi');

// 2. Regresi Domain Umum TANPA Governance (Cuci Mobil, Warung Sembako)
console.log('\nRegresi: Domain umum TANPA role governance (Cuci Mobil)');
const cuciMobilSessionRoles = {
  selected: ['Super Admin', 'Kasir Penerima Kendaraan', 'Staf Cuci & Vakum', 'Pelanggan'],
  wajib: ['Super Admin', 'Kasir Penerima Kendaraan']
};
const superAdminCuciMobil = getRoleNarrativeAndResponsibilities(
  'Super Admin',
  'Jasa Cuci Kendaraan',
  undefined,
  cuciMobilSessionRoles
);
console.log('Deskripsi Super Admin Cuci Mobil:');
console.log('  Narasi:', superAdminCuciMobil.narasi);
console.log('  Tanggung Jawab:', superAdminCuciMobil.tanggungJawab);

// Super admin tetap memantau omzet/transaksi
const cuciHasOmzet = superAdminCuciMobil.tanggungJawab.some((t) =>
  /\b(omzet|transaksi|laporan)\b/i.test(t)
);
assert(cuciHasOmzet, 'Super Admin domain umum tetap memegang monitoring omzet & transaksi');

// Super admin cuci mobil juga wajib punya pengaturan user
const cuciHasUser = superAdminCuciMobil.tanggungJawab.some((t) =>
  /\b(user|pengguna|akun|staf|hak\s*akses)\b/i.test(t)
);
assert(cuciHasUser, 'Super Admin domain umum tetap wajib mencantumkan tugas pengaturan user');

console.log('\n=== TEST BAGIAN C: PENGATURAN USER ADALAH TUGAS WAJIB SUPER ADMIN DI SEMUA DOMAIN ===');

const domainsToTest = [
  'Rental & Sewa Kendaraan',
  'Jasa Cuci Kendaraan',
  'Klinik Dokter Gigi',
  'Laundry Kiloan & Satuan',
  'Kafe & Kedai Kopi',
  'Warung Sembako & Kelontong',
  'Koperasi Simpan Pinjam',
  'Bengkel Motor & Servis'
];

for (const domain of domainsToTest) {
  const details = getRoleNarrativeAndResponsibilities(
    'Super Admin',
    domain,
    undefined,
    { selected: ['Super Admin', 'Staf', 'Pelanggan'] }
  );
  const mentionsUser = details.tanggungJawab.some((t) =>
    /\b(user|pengguna|akun|staf|hak\s*akses)\b/i.test(t)
  );
  assert(mentionsUser, `Domain "${domain}": Super Admin mencantumkan tugas pengaturan user`);
}

// Cek renderRoleSummaryTable menampilkan kolom tanggung jawab yang memuat pengaturan user
const tableOutput = renderRoleSummaryTable(
  cuciMobilSessionRoles,
  'Jasa Cuci Kendaraan',
  undefined
);
console.log('\nTabel Ringkasan Role (Cuci Mobil):\n' + tableOutput);
assert(tableOutput.includes('Super Admin'), 'Tabel memuat baris Super Admin');
assert(/akun|staf|hak akses/i.test(tableOutput), 'Tabel Super Admin memuat tugas akun/staf/hak akses');

console.log(`\n========================================`);
console.log(`Total: ${passed} PASSED, ${failed} FAILED`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('SEMUA TEST LULUS DENGAN SEMPURNA! 🎉');
}
