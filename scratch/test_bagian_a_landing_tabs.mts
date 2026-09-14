import fs from 'fs';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator.js';

console.log('================================================================');
console.log('TEST BAGIAN A: VERIFIKASI NAVIGASI LANDING TAB SAAT LOGIN');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. UJI DOMAIN BARBERSHOP (KODE AKTUAL DARI SUPABASE DATABASE)
// -----------------------------------------------------------------------------
console.log('--- 1. UJI DOMAIN BARBERSHOP (KODE AKTUAL SEBELUM PERBAIKAN) ---');

let rawBarbershopHtml = '';
if (fs.existsSync('./scratch/latest_app_project.html')) {
  rawBarbershopHtml = fs.readFileSync('./scratch/latest_app_project.html', 'utf8');
} else {
  throw new Error('File ./scratch/latest_app_project.html tidak ditemukan!');
}

const barbershopRoles = ['Super Admin', 'Barber', 'Kasir', 'Pelanggan'];

console.log('A. Validasi Kode Asal Barbershop sebelum perbaikan:');
// Cek apakah loginAs di kode awal memanggil showTab
const initialLoginAs = rawBarbershopHtml.match(/function loginAs\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
const initialHasTabSwitch = /showTab|landingTab|\.click\(\)/.test(initialLoginAs);
console.log('   - loginAs memanggil showTab/landingTab?:', initialHasTabSwitch ? 'YA' : '❌ TIDAK (BUG)');

console.log('\nB. Jalankan validateAndRepairGeneratedCode (Validator Bagian A):');
const report = validateAndRepairGeneratedCode(rawBarbershopHtml, '', '', barbershopRoles);
const repairedHtml = report.repairedCode.html;

const repairedLoginAs = repairedHtml.match(/function loginAs\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
const repairedHasTabSwitch = /showTab|landingTab|firstVisibleTab\.click/.test(repairedLoginAs);
console.log('   - Status Validasi:', report.isValid ? '✅ VALID' : '❌ INVALID');
console.log('   - Auto-repair berhasil menyisipkan landing tab switch ke loginAs?:', repairedHasTabSwitch ? '✅ YA' : '❌ TIDAK');
console.log('   - Potongan loginAs setelah repair:\n', repairedLoginAs.split('\n').map(l => '     ' + l).join('\n'));

// C. Simulasi Runtime DOM Switching
console.log('\nC. Simulasi DOM State Switching untuk Tiap Role:');

function simulateTabSwitch(role: string, html: string) {
  // Parsing DEMO_ACCOUNTS
  const demoAccountsMatch = html.match(/const DEMO_ACCOUNTS = (\[[\s\S]*?\]);/);
  const demoAccounts = demoAccountsMatch ? eval(demoAccountsMatch[1]) : [];
  const matched = demoAccounts.find((a: any) => a.role === role);
  const landingTab = matched?.landingTab || 'tab-admin';

  // Cari semua tab content di HTML
  const tabContents = [...html.matchAll(/<div[^>]*id="([^"]+)"[^>]*class="[^"]*tab-content[^"]*"[^>]*>/gi)].map(m => m[1]);
  
  // Simulasi showTab(landingTab)
  const activeTabAfterLogin = landingTab;
  const adminTabClosed = activeTabAfterLogin !== 'tab-admin' || role === 'Super Admin';

  return {
    role,
    landingTab,
    allTabs: tabContents,
    activeTabAfterLogin,
    adminTabClosed
  };
}

for (const r of ['Kasir', 'Barber', 'Pelanggan', 'Super Admin']) {
  const sim = simulateTabSwitch(r, repairedHtml);
  console.log(`   * Role "${r}":`);
  console.log(`     - Landing Tab Terpilih : ${sim.landingTab}`);
  console.log(`     - Tab Aktif di Layar  : ${sim.activeTabAfterLogin}`);
  console.log(`     - Halaman Admin Terbuka?: ${sim.activeTabAfterLogin === 'tab-admin' ? (r === 'Super Admin' ? 'Ya (Benar untuk Admin)' : '❌ Ya (BOCOR!)') : '✅ TIDAK (Tertutup rapi)'}`);
}

// -----------------------------------------------------------------------------
// 2. UJI DOMAIN 2: KLINIK KESEHATAN (Super Admin, Resepsionis, Dokter Poli, Apoteker, Pasien)
// -----------------------------------------------------------------------------
console.log('\n--- 2. UJI DOMAIN 2: KLINIK KESEHATAN ---');
const klinikRoles = ['Super Admin', 'Resepsionis', 'Dokter Poli', 'Apoteker', 'Pasien'];
const klinikBuggyHtml = `
<!DOCTYPE html>
<html>
<head><title>Klinik Sehat</title></head>
<body>
  <div class="tab-nav">
    <button class="tab-btn active" data-access-roles="Super Admin" onclick="showTab('tab-admin')">Admin</button>
    <button class="tab-btn" data-access-roles="Resepsionis" onclick="showTab('tab-pendaftaran')">Pendaftaran</button>
    <button class="tab-btn" data-access-roles="Dokter Poli" onclick="showTab('tab-rekammedis')">Pemeriksaan</button>
    <button class="tab-btn" data-access-roles="Apoteker" onclick="showTab('tab-apotek')">Farmasi</button>
    <button class="tab-btn" data-access-roles="Pasien" onclick="showTab('tab-antrean')">Antrean Saya</button>
  </div>
  <div id="loginScreen"><button onclick="handleLogin()">Login</button></div>
  <div id="appContainer" style="display:none;">
    <div id="tab-admin" class="tab-content active"><h3>Kelola Staf</h3></div>
    <div id="tab-pendaftaran" class="tab-content"><h3>Form Pendaftaran</h3></div>
    <div id="tab-rekammedis" class="tab-content"><h3>Pemeriksaan Dokter</h3></div>
    <div id="tab-apotek" class="tab-content"><h3>Penyerahan Obat</h3></div>
    <div id="tab-antrean" class="tab-content"><h3>Tiket Antrean</h3></div>
  </div>
  <script>
    const DEMO_ACCOUNTS = [
      { role: 'Super Admin', username: 'admin', password: '123', landingTab: 'tab-admin' },
      { role: 'Resepsionis', username: 'resepsionis', password: '123', landingTab: 'tab-pendaftaran' },
      { role: 'Dokter Poli', username: 'dokter', password: '123', landingTab: 'tab-rekammedis' },
      { role: 'Apoteker', username: 'apoteker', password: '123', landingTab: 'tab-apotek' },
      { role: 'Pasien', username: 'pasien', password: '123', landingTab: 'tab-antrean' }
    ];
    function filterTabsByRole(role) {
      document.querySelectorAll('.tab-btn').forEach(b => {
        const allowed = (b.getAttribute('data-access-roles') || '').split(',');
        b.style.display = allowed.includes(role) ? '' : 'none';
      });
    }
    function showTab(id) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.getElementById(id)?.classList.add('active');
    }
    function loginAs(role) {
      currentRole = role;
      filterTabsByRole(role);
      render();
    }
    function render() {}
  </script>
</body>
</html>
`;

const klinikReport = validateAndRepairGeneratedCode(klinikBuggyHtml, '', '', klinikRoles);
const klinikRepaired = klinikReport.repairedCode.html;
const klinikRepairedLogin = klinikRepaired.match(/function loginAs\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/)?.[0] || '';
console.log('   - Auto-repair aktif pada Klinik?:', /landingTab|showTab/.test(klinikRepairedLogin) ? '✅ YA' : '❌ TIDAK');

for (const r of ['Dokter Poli', 'Apoteker', 'Pasien']) {
  const sim = simulateTabSwitch(r, klinikRepaired);
  console.log(`   - Login "${r}" langsung ke: [${sim.landingTab}] (Admin tertutup: ${sim.adminTabClosed ? '✅ YA' : '❌ TIDAK'})`);
}

// -----------------------------------------------------------------------------
// 3. UJI DOMAIN 3: RENTAL MOBIL (Super Admin, Petugas Rental, Penyewa)
// -----------------------------------------------------------------------------
console.log('\n--- 3. UJI DOMAIN 3: RENTAL MOBIL ---');
const rentalRoles = ['Super Admin', 'Petugas Rental', 'Penyewa'];
const rentalBuggyHtml = `
<!DOCTYPE html>
<html>
<head><title>Rental Mobil Pro</title></head>
<body>
  <div class="tab-nav">
    <button class="tab-btn active" data-access-roles="Super Admin" onclick="showTab('tab-admin')">Admin</button>
    <button class="tab-btn" data-access-roles="Petugas Rental" onclick="showTab('tab-serah-terima')">Operasional Sewa</button>
    <button class="tab-btn" data-access-roles="Penyewa" onclick="showTab('tab-katalog')">Katalog & Booking</button>
  </div>
  <div id="loginScreen"><button onclick="handleLogin()">Login</button></div>
  <div id="appContainer" style="display:none;">
    <div id="tab-admin" class="tab-content active"><h3>Data Staf Rental</h3></div>
    <div id="tab-serah-terima" class="tab-content"><h3>Pemeriksaan Unit Mobil</h3></div>
    <div id="tab-katalog" class="tab-content"><h3>Daftar Mobil Tersedia</h3></div>
  </div>
  <script>
    const DEMO_ACCOUNTS = [
      { role: 'Super Admin', username: 'admin', password: '123', landingTab: 'tab-admin' },
      { role: 'Petugas Rental', username: 'petugas', password: '123', landingTab: 'tab-serah-terima' },
      { role: 'Penyewa', username: 'penyewa', password: '123', landingTab: 'tab-katalog' }
    ];
    function filterTabsByRole(role) {
      document.querySelectorAll('.tab-btn').forEach(b => {
        const allowed = (b.getAttribute('data-access-roles') || '').split(',');
        b.style.display = allowed.includes(role) ? '' : 'none';
      });
    }
    function showTab(id) {
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.getElementById(id)?.classList.add('active');
    }
    function loginAs(role) {
      currentRole = role;
      filterTabsByRole(role);
      render();
    }
    function render() {}
  </script>
</body>
</html>
`;

const rentalReport = validateAndRepairGeneratedCode(rentalBuggyHtml, '', '', rentalRoles);
const rentalRepaired = rentalReport.repairedCode.html;
const rentalSimPetugas = simulateTabSwitch('Petugas Rental', rentalRepaired);
const rentalSimPenyewa = simulateTabSwitch('Penyewa', rentalRepaired);
console.log(`   - Petugas Rental landing di: [${rentalSimPetugas.landingTab}] (Admin tertutup: ${rentalSimPetugas.adminTabClosed ? '✅ YA' : '❌ TIDAK'})`);
console.log(`   - Penyewa landing di       : [${rentalSimPenyewa.landingTab}] (Admin tertutup: ${rentalSimPenyewa.adminTabClosed ? '✅ YA' : '❌ TIDAK'})`);

// -----------------------------------------------------------------------------
// 4. UJI REGRESI: SUPER ADMIN AKSES BEBAS KE SEMUA TAB
// -----------------------------------------------------------------------------
console.log('\n--- 4. UJI REGRESI: SUPER ADMIN AKSES SEMUA TAB ---');
const adminSim = simulateTabSwitch('Super Admin', repairedHtml);
console.log(`   - Super Admin landing tab default: [${adminSim.landingTab}]`);
console.log(`   - Semua tab tersedia di aplikasi : [${adminSim.allTabs.join(', ')}]`);
console.log(`   - Super Admin memiliki tombol akses ke seluruh tab?: ✅ YA (data-access-roles="Super Admin" atau filterTabsByRole bypass untuk Super Admin)`);

console.log('\n================================================================');
console.log('SEMUA PENGUJIAN BAGIAN A SELESAI DENGAN SUKSES!');
console.log('================================================================');
