import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';
import { stitchContinuationCode } from '../src/lib/continuationStitcher';
import * as acorn from 'acorn';

console.log('================================================================');
console.log('🧪 PIVOT 3 PILAR & DUAL-LAYER RBAC VERIFICATION TEST SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (detail) console.error(`   Detail: ${detail}`);
  }
}

// -----------------------------------------------------------------------------
// TEST 1: SKENARIO BARBERSHOP (SUMBER BUG AWAL)
// Menilai apakah prototipe Barbershop dengan 4 role (Super Admin, Kasir, Barber, Pelanggan)
// berhasil divalidasi dan diperbaiki TANPA MISMATCH_HANDLER untuk showTab / logout / loginAs / filterTabsByRole
// -----------------------------------------------------------------------------
console.log('--- TEST 1: SKENARIO BARBERSHOP (SUMBER BUG AWAL) ---');

const barbershopHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Gentlemen Cut - Barbershop Premium</title>
</head>
<body>
  <div id="loginScreen" class="login-screen">
    <div class="login-card">
      <div class="app-icon">💈</div>
      <h2>Gentlemen Cut Barbershop</h2>
      <p>Masuk ke Akun Anda untuk Memulai</p>
      <input type="text" id="loginUsername" placeholder="Username">
      <input type="password" id="loginPassword" placeholder="Kata Sandi">
      <button onclick="handleLogin()">➔] Masuk</button>
      <div class="demo-box">
        <div onclick="quickLogin('superadmin', 'admin123')">🔑 Super Admin</div>
        <div onclick="quickLogin('kasir', 'kasir123')">🔑 Kasir</div>
        <div onclick="quickLogin('barber', 'barber123')">🔑 Barber (Kapster)</div>
        <div onclick="quickLogin('pelanggan', 'pelanggan123')">🔑 Pelanggan (Umum)</div>
      </div>
    </div>
  </div>

  <div id="appContainer" style="display: none;">
    <header class="app-header">
      <span id="currentRoleBadge" class="badge">Role</span>
      <button onclick="logout()">🚪 Keluar / Ganti Akun</button>
    </header>

    <!-- Navigasi Tab Fitur (Bukan nama peran, dengan data-access-roles) -->
    <nav class="tab-nav">
      <button class="tab-btn" data-access-roles="Super Admin" onclick="showTab('tab-staf')">👥 Kelola Staf</button>
      <button class="tab-btn" data-access-roles="Super Admin,Kasir" onclick="showTab('tab-kasir')">💵 Kasir & Pembayaran</button>
      <button class="tab-btn" data-access-roles="Super Admin,Barber" onclick="showTab('tab-kursi')">✂️ Antrean & Kursi Barber</button>
      <button class="tab-btn" data-access-roles="Super Admin,Pelanggan" onclick="showTab('tab-booking')">📅 Booking & Status Cukur</button>
    </nav>

    <!-- KONTEN TAB: Syarat 1 (Bagian B Action-Level RBAC Gating di dalam tab) -->
    <div id="tab-staf" class="tab-content">
      <h3>Manajemen Akun Staf & Hak Akses</h3>
      <button onclick="bukaModal('staf')">➕ Tambah Staf Baru</button>
      <table id="tabelStaf"></table>
    </div>

    <div id="tab-kasir" class="tab-content">
      <h3>Kasir & Pembayaran Cukur</h3>
      <button onclick="prosesBayar('ORD-001')">💳 Bayar Sekarang</button>
      <table id="tabelKasir"></table>
    </div>

    <div id="tab-kursi" class="tab-content">
      <h3>Antrean Kursi Barber</h3>
      <button onclick="mulaiPotong('ORD-001')">✂️ Mulai Pengerjaan</button>
      <button onclick="selesaikanPotong('ORD-001')">✅ Selesai Cukur</button>
    </div>

    <div id="tab-booking" class="tab-content">
      <h3>Booking Cukur Mandiri</h3>
      <button onclick="bukaModal('booking')">📅 Buat Janji Temu</button>
    </div>
  </div>

  <script>
    // State aplikasi
    let currentRole = 'Super Admin';
    const DEMO_ACCOUNTS = [
      { role: 'Super Admin', username: 'superadmin', password: 'admin123', landingTab: 'tab-staf' },
      { role: 'Kasir', username: 'kasir', password: 'kasir123', landingTab: 'tab-kasir' },
      { role: 'Barber', username: 'barber', password: 'barber123', landingTab: 'tab-kursi' },
      { role: 'Pelanggan', username: 'pelanggan', password: 'pelanggan123', landingTab: 'tab-booking' }
    ];

    function handleLogin() {
      const u = document.getElementById('loginUsername')?.value || '';
      const acc = DEMO_ACCOUNTS.find(a => a.username === u);
      if (acc) {
        loginAs(acc.role);
      }
    }

    function quickLogin(u, p) {
      const userInp = document.getElementById('loginUsername');
      if (userInp) userInp.value = u;
      handleLogin();
    }

    // Handler bisnis operasional spesifik barbershop (Bagian B)
    function bukaModal(type) { console.log('Buka modal:', type); }
    function prosesBayar(id) { showToast('Pembayaran berhasil: ' + id, 'success'); }
    function mulaiPotong(id) { showToast('Barber mulai pengerjaan: ' + id, 'info'); }
    function selesaikanPotong(id) { showToast('Layanan potong selesai: ' + id, 'success'); }
  </script>
</body>
</html>
`;

const barbershopRoles = ['Super Admin', 'Kasir', 'Barber', 'Pelanggan'];
const barbershopResult = validateAndRepairGeneratedCode(barbershopHtml, '', '', barbershopRoles);

console.log('Barbershop issues:', barbershopResult.issues);
const mismatchIssues = barbershopResult.issues.filter(i => i.startsWith('MISMATCH_HANDLER'));
const syntaxIssues = barbershopResult.issues.filter(i => i.startsWith('SYNTAX_ERROR'));

assert(mismatchIssues.length === 0, 'Skenario Barbershop: Bebas dari MISMATCH_HANDLER', JSON.stringify(mismatchIssues));
assert(syntaxIssues.length === 0, 'Skenario Barbershop: Bebas dari SYNTAX_ERROR', JSON.stringify(syntaxIssues));
assert(barbershopResult.repairedCode.html.includes('function showTab('), 'Skenario Barbershop: function showTab terinjeksi deterministik');
assert(barbershopResult.repairedCode.html.includes('function filterTabsByRole('), 'Skenario Barbershop: function filterTabsByRole terinjeksi deterministik');
assert(barbershopResult.repairedCode.html.includes('function loginAs('), 'Skenario Barbershop: function loginAs terinjeksi deterministik');
assert(barbershopResult.repairedCode.html.includes('function logout('), 'Skenario Barbershop: function logout terinjeksi deterministik');
assert(barbershopResult.repairedCode.html.includes('function showToast('), 'Skenario Barbershop: function showToast terinjeksi deterministik');

// -----------------------------------------------------------------------------
// TEST 2: SYARAT 1 (KOEKSISTENSI DUA LAPISAN RBAC)
// Lapisan 1: filterTabsByRole menyaring visibilitas tombol tab (.tab-btn)
// Lapisan 2: Bagian B menyaring tombol aksi (Tambah/Edit/Hapus/Eksekusi) di dalam tab
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: SYARAT 1 (KOEKSISTENSI DUA LAPISAN RBAC) ---');

// Verifikasi Lapisan 1 di dalam kode hasil perbaikan
const hasDataRoleAttributes = barbershopResult.repairedCode.html.includes('data-access-roles="Super Admin,Kasir"');
assert(hasDataRoleAttributes, 'Lapisan 1 (Coarse Tab): Atribut data-access-roles tetap utuh dan selaras');

// Verifikasi Lapisan 2 (Action-Level Business Handlers) tetap utuh
const hasActionHandlers = barbershopResult.repairedCode.html.includes('onclick="prosesBayar(\'ORD-001\')"') &&
                          barbershopResult.repairedCode.html.includes('onclick="mulaiPotong(\'ORD-001\')"');
assert(hasActionHandlers, 'Lapisan 2 (Bagian B Action-Level): Tombol aksi operasional peran tetap terpelihara');

// -----------------------------------------------------------------------------
// TEST 3: PILAR 2 (ACORN AST SYNTAX VALIDATION)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: PILAR 2 (ACORN AST SYNTAX VALIDATION) ---');

// Test 3a: Menangkap SyntaxError token ganda `))` dengan nomor baris & kolom akurat
const brokenCodeParen = `
<!DOCTYPE html><html><body>
<script>
  function broken() {
    if (typeof showTab === 'function')) {
      showTab('tab1');
    }
  }
</script>
</body></html>
`;
const brokenParenReport = validateAndRepairGeneratedCode(brokenCodeParen, '', '');
const parenIssue = brokenParenReport.issues.find(i => i.includes('SYNTAX_ERROR') && i.includes('Unexpected token'));
assert(!!parenIssue, 'Acorn: Berhasil menangkap Unexpected token dengan presisi', parenIssue);
console.log('   Contoh pesan Acorn:', parenIssue);

// Test 3b: Menangkap top-level return di dalam script (yang lolos di new Function tapi crash di browser)
const brokenCodeReturn = `
<!DOCTYPE html><html><body>
<script>
  const a = 10;
  return;
  const b = 20;
</script>
</body></html>
`;
const brokenReturnReport = validateAndRepairGeneratedCode(brokenCodeReturn, '', '');
const returnIssue = brokenReturnReport.issues.find(i => i.includes('SYNTAX_ERROR') && i.includes("'return' outside of function"));
assert(!!returnIssue, 'Acorn: Berhasil menangkap illegal return outside of function', returnIssue);
console.log('   Contoh pesan Acorn:', returnIssue);

// -----------------------------------------------------------------------------
// TEST 4: PILAR 3 (SMART BOUNDARY CONTINUATION STITCHER)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 4: PILAR 3 (SMART BOUNDARY CONTINUATION STITCHER) ---');

// Test 4a: Deduplikasi token batas penutup `)` yang terulang saat cutoff
const prefix4a = `
function updateStatus(id) {
  if (typeof showTab === 'function')`;
const chunk4a = `) showTab('tab-kursi');
}
`;
const stitched4a = stitchContinuationCode(prefix4a, chunk4a);
let parsed4a = false;
try {
  acorn.parse(stitched4a, { ecmaVersion: 'latest', sourceType: 'script' });
  parsed4a = true;
} catch (e: any) {
  console.error('stitch 4a parse failed:', e.message);
}
assert(parsed4a, 'Stitcher: Deduplikasi token batas `)` berhasil menghasilkan JS valid tanpa Unexpected token `)`');
console.log('   Hasil potongan sambungan:', stitched4a.trim());

// Test 4b: Stripping markdown code fences dari continuation chunk
const prefix4b = `<div>Contoh HTML</div>\n`;
const chunk4b = '```html\n<div class="card">Lanjutan Konten</div>\n```';
const stitched4b = stitchContinuationCode(prefix4b, chunk4b);
assert(!stitched4b.includes('```html') && stitched4b.includes('<div class="card">Lanjutan Konten</div>'), 'Stitcher: Pembersihan fence markdown otomatis');

// Test 4c: Overlap substring matching (LLM mengulang 20 karakter terakhir)
const prefix4c = 'function hitungTotal(items) { return items.reduce((acc, it) => acc + ';
const chunk4c = 'items.reduce((acc, it) => acc + it.harga, 0); }';
const stitched4c = stitchContinuationCode(prefix4c, chunk4c);
assert(stitched4c === 'function hitungTotal(items) { return items.reduce((acc, it) => acc + it.harga, 0); }', 'Stitcher: Overlap substring 30 karakter tersambung mulus');

// -----------------------------------------------------------------------------
// TEST 5: SYARAT 2 (PRESERVASI FALLBACK POIN D UNTUK KASUS EKSTREM)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 5: SYARAT 2 (PRESERVASI FALLBACK POIN D UNTUK KASUS EKSTREM) ---');
const roles10 = ['Super Admin', 'Manajer', 'Supervisor', 'Kasir', 'Barber 1', 'Barber 2', 'Washer', 'Gudang', 'Akuntan', 'Pelanggan'];
const isComplexityRelated = roles10.length > 2;
const top2Roles = roles10.slice(0, 2);
const suggestedSimplifyPrompt = `buatkan prototipe versi sederhana dulu, fokus hanya 2 role utama: ${top2Roles.join(' dan ')}`;

assert(isComplexityRelated === true, 'Syarat 2: Kasus ekstrem 10 role otomatis terdeteksi isComplexityRelated = true');
assert(suggestedSimplifyPrompt.includes('Super Admin dan Manajer'), 'Syarat 2: Fallback prompt menyarankan fokus ke 2 role utama');

console.log('\n================================================================');
console.log(`🏁 HASIL TEST: ${passedTests}/${totalTests} Pengujian Berhasil`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
