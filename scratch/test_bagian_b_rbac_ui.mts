import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';
import { renderRbacMarkdownTable } from '../src/lib/templates/processes/guided';
import * as fs from 'fs';
import * as path from 'path';

console.log('================================================================');
console.log('🧪 TEST SUITE: BAGIAN B — ACTION-LEVEL RBAC UI GATING & PROMPT');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
  }
}

// TEST 1: Verifikasi fungsi renderRbacMarkdownTable
console.log('--- UJI 1: renderRbacMarkdownTable dengan teks bebas RBAC ---');
const testRoles = ['Super Admin', 'Barber', 'Kasir', 'Pelanggan'];
const testModul = [
  {
    nama: 'Katalog & Booking Layanan',
    deskripsiFungsional: 'Pemesanan cukur dan pemilihan jadwal',
    izinPerRole: [
      { role: 'Super Admin', level: 'Supervisi & Kontrol Penuh' },
      { role: 'Barber', level: 'Lihat Antrean & Pengerjaan (Milik Sendiri)' },
      { role: 'Kasir', level: 'Lihat Status Transaksi' },
      { role: 'Pelanggan', level: 'Pemesanan Mandiri & Riwayat Pribadi' }
    ]
  },
  {
    nama: 'Transaksi & Kasir',
    deskripsiFungsional: 'Pembayaran dan pencetakan nota',
    izinPerRole: [
      { role: 'Super Admin', level: 'Audit & Laporan Keuangan Global' },
      { role: 'Barber', level: '-' },
      { role: 'Kasir', level: 'Eksekusi Pembayaran & Cetak Struk' },
      { role: 'Pelanggan', level: '-' }
    ]
  },
  {
    nama: 'Manajemen Sistem & Hak Akses',
    deskripsiFungsional: 'Kelola akun staf dan hak akses',
    izinPerRole: [
      { role: 'Super Admin', level: 'Full Control / Manajemen Akun' },
      { role: 'Barber', level: '-' },
      { role: 'Kasir', level: '-' },
      { role: 'Pelanggan', level: '-' }
    ]
  }
];

const tableMd = renderRbacMarkdownTable(testRoles, testModul);
assert(tableMd.includes('| Modul Fungsional | Super Admin | Barber | Kasir | Pelanggan |'), 'Header tabel RBAC memuat semua peran resmi');
assert(tableMd.includes('Katalog & Booking Layanan'), 'Baris tabel memuat modul Katalog & Booking');
assert(tableMd.includes('Eksekusi Pembayaran & Cetak Struk'), 'Baris tabel memuat teks bebas izin Kasir');
assert(tableMd.includes('Lihat Antrean & Pengerjaan (Milik Sendiri)'), 'Baris tabel memuat teks bebas izin Barber');

// TEST 2: Validasi latest_app_project.html (Barbershop riil dengan role gating & render filtering)
console.log('\n--- UJI 2: Validasi latest_app_project.html dengan validator ---');
const latestAppPath = path.join(process.cwd(), 'scratch/latest_app_project.html');
if (fs.existsSync(latestAppPath)) {
  const htmlContent = fs.readFileSync(latestAppPath, 'utf8');
  const validationResult = validateAndRepairGeneratedCode(htmlContent, '', '', testRoles);

  console.log(`Hasil validasi latest_app_project: isValid=${validationResult.isValid}, issues count=${validationResult.issues.length}`);
  if (validationResult.issues.length > 0) {
    console.log('Issues found:', validationResult.issues);
  }

  // Seharusnya tidak ada issue kritis fatal
  const fatalIssues = validationResult.issues.filter(i => 
    !i.includes('LOGIN_TAB_NOT_SWITCHED') // latest_app_project dibuat sebelum fix Bagian A
  );
  assert(fatalIssues.length === 0, `Tidak ada issue kritis lain di latest_app_project: ${fatalIssues.join(', ')}`);
} else {
  console.log('⚠️ scratch/latest_app_project.html tidak ditemukan, lewati uji 2 file riil');
}

// TEST 3: Verifikasi STAFF_ACCOUNT_ACCESS_LEAK mendeteksi kebocoran izin administratif
console.log('\n--- UJI 3: STAFF_ACCOUNT_ACCESS_LEAK mendeteksi kebocoran hak akses ---');
const leakyHtml = `
<!DOCTYPE html>
<html>
<head><title>App Leaky</title></head>
<body>
  <div id="loginScreen"><input id="loginUsername"><input type="password" id="loginPassword"><button onclick="handleLogin()">Login</button></div>
  <div id="appContainer" style="display:none">
    <button class="tab-btn" data-access-roles="Super Admin" onclick="showTab('tab-admin')">Admin</button>
    <button class="tab-btn" data-access-roles="Kasir" onclick="showTab('tab-kasir')">Kasir</button>
    <div id="tab-admin" class="tab-content active">
      <!-- Kebocoran: tombol manajemen akun staf diberi data-access-roles="Kasir" -->
      <button class="btn-danger" data-access-roles="Kasir">Atur Hak Akses & Tambah Staf</button>
    </div>
  </div>
  <script>
    const DEMO_ACCOUNTS = [
      { role: 'Super Admin', username: 'admin', password: '123', landingTab: 'tab-admin' },
      { role: 'Kasir', username: 'kasir', password: '123', landingTab: 'tab-kasir' }
    ];
    function handleLogin() { loginAs('Super Admin'); }
    function loginAs(role) {
      window.currentRole = role;
      filterTabsByRole(role);
      showTab('tab-admin');
    }
    function filterTabsByRole(role) {}
    function showTab(id) {}
  </script>
</body>
</html>
`;

const leakResult = validateAndRepairGeneratedCode(leakyHtml, '', '', ['Super Admin', 'Kasir']);
const hasLeakIssue = leakResult.issues.some(i => i.includes('STAFF_ACCOUNT_ACCESS_LEAK'));
assert(hasLeakIssue, 'Validator mendeteksi STAFF_ACCOUNT_ACCESS_LEAK saat tombol atur hak akses diberikan ke Kasir');

// TEST 4: Verifikasi simulasi integrasi session.rbac.modul di route.ts
console.log('\n--- UJI 4: Verifikasi simulasi ekstraksi RBAC terstruktur ---');
const mockIncomingSession = {
  roles: { selected: ['Super Admin', 'Dokter', 'Pasien'] },
  rbac: {
    modul: [
      {
        nama: 'Rekam Medis Pasien',
        izinPerRole: [
          { role: 'Super Admin', level: 'Audit & Backup Data' },
          { role: 'Dokter', level: 'Diagnosis & Tindakan Medis' },
          { role: 'Pasien', level: 'Lihat Riwayat Medis Pribadi' }
        ]
      }
    ]
  }
};

let simApprovedBrief = '';
let simOfficialRoles = mockIncomingSession.roles.selected;
let simSessionRbacModul = mockIncomingSession.rbac?.modul || [];

if (simSessionRbacModul.length > 0 && (!simApprovedBrief || !simApprovedBrief.includes('Matriks Hak Akses (RBAC)'))) {
  const tableMd = renderRbacMarkdownTable(simOfficialRoles, simSessionRbacModul);
  if (tableMd) {
    simApprovedBrief = simApprovedBrief
      ? `${simApprovedBrief}\n\n- **Matriks Hak Akses (RBAC) per Modul Fungsional**:\n${tableMd}`
      : `- **Matriks Hak Akses (RBAC) per Modul Fungsional**:\n${tableMd}`;
  }
}

assert(simApprovedBrief.includes('Matriks Hak Akses (RBAC) per Modul Fungsional'), 'Brief terisi tabel RBAC secara otomatis');
assert(simApprovedBrief.includes('Diagnosis & Tindakan Medis'), 'Izin Dokter masuk ke dalam brief');
assert(simApprovedBrief.includes('Lihat Riwayat Medis Pribadi'), 'Izin Pasien masuk ke dalam brief');

console.log(`\n================================================================`);
console.log(`HASIL AKHIR: ${passedTests} / ${totalTests} pengujian BERHASIL`);
console.log(`================================================================`);

if (passedTests !== totalTests) {
  process.exit(1);
}
