import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';
import { buildSrcDoc } from '../src/lib/buildSrcDoc';
import { JSDOM } from 'jsdom';

console.log('================================================================');
console.log('🧪 UJI VERIFIKASI: OWNER_ROLE_NAME DINAMIS TANPA HARDCODED KEYWORDS');
console.log('================================================================\n');

function runDomTest(htmlContent: string, testRoles: string[], ownerRoleExpected: string) {
  const dom = new JSDOM(htmlContent, { runScripts: 'dangerously', resources: 'usable' });
  const window = dom.window;

  // Cek apakah window.OWNER_ROLE_NAME terdefinisi
  const resolvedOwner = (window as any).OWNER_ROLE_NAME;
  console.log(`  [DOM Check] window.OWNER_ROLE_NAME: "${resolvedOwner}" (Harapan: "${ownerRoleExpected}")`);
  if (resolvedOwner !== ownerRoleExpected) {
    throw new Error(`OWNER_ROLE_NAME salah! Terdeteksi "${resolvedOwner}", diharapkan "${ownerRoleExpected}"`);
  }

  // Uji filterTabsByRole untuk owner
  if (typeof (window as any).filterTabsByRole !== 'function') {
    throw new Error('filterTabsByRole bukan fungsi di window!');
  }

  // 1. Test Owner: Harus bisa akses semua tab
  (window as any).filterTabsByRole(ownerRoleExpected);
  const buttonsAfterOwner = Array.from(window.document.querySelectorAll('.tab-btn')) as HTMLButtonElement[];
  const hiddenButtonsForOwner = buttonsAfterOwner.filter(b => b.style.display === 'none');
  console.log(`  [Owner Test] Tab tersembunyi untuk "${ownerRoleExpected}": ${hiddenButtonsForOwner.length} dari ${buttonsAfterOwner.length}`);
  if (hiddenButtonsForOwner.length > 0) {
    throw new Error(`Owner "${ownerRoleExpected}" tidak bisa melihat semua tab! ${hiddenButtonsForOwner.length} tab tersembunyi.`);
  }

  // 2. Test Staf non-owner (misal role ke-2): Hanya boleh melihat tab miliknya
  if (testRoles.length > 1) {
    const nonOwner = testRoles[1];
    (window as any).filterTabsByRole(nonOwner);
    const buttonsForNonOwner = Array.from(window.document.querySelectorAll('.tab-btn')) as HTMLButtonElement[];
    const visibleForNonOwner = buttonsForNonOwner.filter(b => b.style.display !== 'none');
    console.log(`  [Staff Test] Tab terlihat untuk "${nonOwner}": ${visibleForNonOwner.length} dari ${buttonsForNonOwner.length}`);
    if (visibleForNonOwner.length === 0) {
      throw new Error(`Staf "${nonOwner}" tidak bisa melihat tab miliknya!`);
    }
    // Pastikan tidak melihat semua tab (harus ter-gate)
    if (visibleForNonOwner.length === buttonsForNonOwner.length && buttonsForNonOwner.length > 1) {
      throw new Error(`Staf "${nonOwner}" bocor melihat seluruh tab yang harusnya untuk Owner!`);
    }
  }

  return true;
}

// -------------------------------------------------------------
// Skenario 1: Role Owner = "Pemilik Usaha" (TIDAK ADA di keyword lama admin/super)
// -------------------------------------------------------------
console.log('--- Skenario 1: Role Owner = "Pemilik Usaha" ---');
const roles1 = ['Pemilik Usaha', 'Kasir Toko', 'Pembeli'];
const rawHtml1 = `<!DOCTYPE html>
<html>
<head><title>Toko Kelontong</title></head>
<body>
  <div id="loginScreen">
    <button onclick="loginAs('Pemilik Usaha')">Login Pemilik</button>
  </div>
  <div id="appContainer" style="display:none;">
    <button class="tab-btn" data-access-roles="Pemilik Usaha" onclick="showTab('tabLaporan')">Laporan Keuangan</button>
    <button class="tab-btn" data-access-roles="Kasir Toko" onclick="showTab('tabKasir')">Kasir Penjualan</button>
    <button class="tab-btn" data-access-roles="Pembeli" onclick="showTab('tabKatalog')">Katalog Barang</button>
    <div id="tabLaporan" class="tab-content">Laporan</div>
    <div id="tabKasir" class="tab-content">Kasir</div>
    <div id="tabKatalog" class="tab-content">Katalog</div>
  </div>
  <script>
    var currentRole = '';
    function render() {}
  </script>
</body>
</html>`;

const validated1 = validateAndRepairGeneratedCode(rawHtml1, '', '', roles1, 'Pemilik Usaha');
const srcDoc1 = buildSrcDoc(validated1.repairedCode);
console.log('--- SRCDOC1 CONTENT ---');
console.log(srcDoc1);
console.log('-----------------------');
runDomTest(srcDoc1, roles1, 'Pemilik Usaha');
console.log('✅ Skenario 1 ("Pemilik Usaha") BERHASIL!\n');

// -------------------------------------------------------------
// Skenario 2: Role Owner = "Direktur Utama" (TIDAK ADA di keyword lama admin/super)
// -------------------------------------------------------------
console.log('--- Skenario 2: Role Owner = "Direktur Utama" ---');
const roles2 = ['Direktur Utama', 'Staf Lapangan', 'Klien'];
const rawHtml2 = `<!DOCTYPE html>
<html>
<head><title>Konsultan Manajemen</title></head>
<body>
  <div id="loginScreen"></div>
  <div id="appContainer">
    <button class="tab-btn" data-access-roles="Direktur Utama" onclick="showTab('tabDireksi')">Monitoring Direksi</button>
    <button class="tab-btn" data-access-roles="Staf Lapangan" onclick="showTab('tabAudit')">Audit Lapangan</button>
    <button class="tab-btn" data-access-roles="Klien" onclick="showTab('tabProgres')">Progres Proyek</button>
  </div>
  <script>
    var currentRole = '';
    function render() {}
  </script>
</body>
</html>`;

const validated2 = validateAndRepairGeneratedCode(rawHtml2, '', '', roles2, 'Direktur Utama');
const srcDoc2 = buildSrcDoc(validated2.repairedCode);
runDomTest(srcDoc2, roles2, 'Direktur Utama');
console.log('✅ Skenario 2 ("Direktur Utama") BERHASIL!\n');

// -------------------------------------------------------------
// Skenario 3: Regresi - Role Owner = "Super Admin" (Standar)
// -------------------------------------------------------------
console.log('--- Skenario 3: Regresi - Role Owner = "Super Admin" ---');
const roles3 = ['Super Admin', 'Instruktur Musik', 'Murid'];
const rawHtml3 = `<!DOCTYPE html>
<html>
<head><title>Kursus Musik</title></head>
<body>
  <div id="loginScreen"></div>
  <div id="appContainer">
    <button class="tab-btn" data-access-roles="Super Admin" onclick="showTab('tabSistem')">Kelola Sistem</button>
    <button class="tab-btn" data-access-roles="Instruktur Musik" onclick="showTab('tabJadwal')">Jadwal Latihan</button>
    <button class="tab-btn" data-access-roles="Murid" onclick="showTab('tabKelas')">Kelas Saya</button>
  </div>
  <script>
    var currentRole = '';
    function render() {}
  </script>
</body>
</html>`;

const validated3 = validateAndRepairGeneratedCode(rawHtml3, '', '', roles3, 'Super Admin');
const srcDoc3 = buildSrcDoc(validated3.repairedCode);
runDomTest(srcDoc3, roles3, 'Super Admin');
console.log('✅ Skenario 3 ("Super Admin") BERHASIL!\n');

console.log('🎉 SEMUA PENGUJIAN OWNER_ROLE_NAME DINAMIS LOLOS DENGAN SEMPURNA!');
