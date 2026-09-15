import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';
import { stitchContinuationCode } from '../src/lib/continuationStitcher';
import * as acorn from 'acorn';

console.log('=== MEMULAI GENERASI BUKTI KONKRET PIVOT 3 PILAR ===\n');

// -----------------------------------------------------------------------------
// BUKTI 1 & 2: KODE ASLI GENERATE BARBERSHOP & DUAL-LAYER RBAC
// -----------------------------------------------------------------------------
// Ini adalah kode yang dihasilkan oleh AI (markup HTML + business logic),
// di mana AI TIDAK LAGI menulis plumbing (showTab, loginAs, filterTabsByRole, logout, showToast).
const rawAiGeneratedBarbershop = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Gentlemen Cut - Barbershop Premium</title>
  <style>
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .btn-danger { background: #ef4444; color: #fff; }
    .btn-primary { background: #3b82f6; color: #fff; }
  </style>
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

    <!-- LAPISAN 1 (Pilar 1 Coarse Tab Gating): data-access-roles mengatur visibilitas tombol tab -->
    <nav class="tab-nav">
      <button class="tab-btn" data-access-roles="Super Admin" onclick="showTab('tab-staf')">👥 Master Staf</button>
      <button class="tab-btn" data-access-roles="Super Admin,Kasir,Barber" onclick="showTab('tab-transaksi')">📋 Transaksi & Layanan</button>
      <button class="tab-btn" data-access-roles="Super Admin,Pelanggan" onclick="showTab('tab-booking')">📅 Booking Cukur</button>
    </nav>

    <!-- Tab Staf (Super Admin only) -->
    <div id="tab-staf" class="tab-content">
      <h3>Daftar Staf Barbershop</h3>
      <button onclick="bukaModalStaf()">➕ Tambah Staf</button>
      <table id="tabelStaf"></table>
    </div>

    <!-- LAPISAN 2 (Bagian B Action-Level RBAC Gating di DALAM tab yang sama):
         Tab Transaksi ini BISA DIAKSES oleh Kasir, Barber, dan Super Admin (Lapisan 1).
         TETAPI tombol di dalamnya disaring berdasarkan currentRole (Lapisan 2):
         - Tombol "Tambah Staf" / "Hapus Transaksi Permanen" HANYA untuk Super Admin.
         - Tombol "Proses Bayar" HANYA untuk Kasir & Super Admin.
         - Tombol "Mulai Potong" HANYA untuk Barber. -->
    <div id="tab-transaksi" class="tab-content">
      <h3>Daftar Transaksi & Antrean Kursi</h3>
      <div id="toolbarAksiTransaksi">
        <!-- Toolbar dirender secara dinamis oleh renderTransaksiToolbar() sesuai currentRole -->
      </div>
      <table id="tabelTransaksi">
        <thead>
          <tr>
            <th>No Nota</th>
            <th>Pelanggan</th>
            <th>Barber</th>
            <th>Layanan</th>
            <th>Total</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody id="tbodyTransaksi"></tbody>
      </table>
    </div>

    <!-- Tab Booking (Pelanggan & Super Admin) -->
    <div id="tab-booking" class="tab-content">
      <h3>Booking Cukur Mandiri</h3>
      <button onclick="bukaModalBooking()">📅 Reservasi Baru</button>
    </div>
  </div>

  <script>
    // State Aplikasi
    let currentRole = 'Super Admin';
    const DEMO_ACCOUNTS = [
      { role: 'Super Admin', username: 'superadmin', password: 'admin123', landingTab: 'tab-staf' },
      { role: 'Kasir', username: 'kasir', password: 'kasir123', landingTab: 'tab-transaksi' },
      { role: 'Barber', username: 'barber', password: 'barber123', landingTab: 'tab-transaksi' },
      { role: 'Pelanggan', username: 'pelanggan', password: 'pelanggan123', landingTab: 'tab-booking' }
    ];

    let daftarTransaksi = [
      { id: 'TRX-001', pelanggan: 'Budi Santoso', barber: 'Ahmad', layanan: 'Gentleman Haircut', total: 75000, status: 'Menunggu' },
      { id: 'TRX-002', pelanggan: 'Rian Pratama', barber: 'Joko', layanan: 'Beard Grooming', total: 45000, status: 'Sedang Dipotong' },
      { id: 'TRX-003', pelanggan: 'Dedi Kurnia', barber: 'Ahmad', layanan: 'Haircut + Wash', total: 90000, status: 'Selesai' }
    ];

    function handleLogin() {
      const u = (document.getElementById('loginUsername')?.value || '').trim();
      const acc = DEMO_ACCOUNTS.find(a => a.username.toLowerCase() === u.toLowerCase());
      if (acc && typeof loginAs === 'function') {
        loginAs(acc.role);
      } else if (typeof showToast === 'function') {
        showToast('Akun tidak ditemukan!', 'error');
      }
    }

    function quickLogin(u, p) {
      const ui = document.getElementById('loginUsername');
      if (ui) ui.value = u;
      handleLogin();
    }

    // =========================================================================
    // IMPLEMENTASI LAPISAN 2 (Bagian B: Action-Level RBAC Gating di JavaScript)
    // =========================================================================
    function renderTransaksi() {
      const tbody = document.getElementById('tbodyTransaksi');
      if (!tbody) return;

      tbody.innerHTML = daftarTransaksi.map(t => {
        let actionButtons = '';

        // Kasir & Super Admin: Tombol Bayar
        if (currentRole === 'Kasir' || currentRole === 'Super Admin') {
          if (t.status === 'Selesai') {
            actionButtons += \`<button class="btn-primary" onclick="prosesBayar('\${t.id}')">💳 Bayar</button> \`;
          }
        }

        // Barber: Tombol Mulai Potong / Selesai
        if (currentRole === 'Barber' || currentRole === 'Super Admin') {
          if (t.status === 'Menunggu') {
            actionButtons += \`<button onclick="mulaiPotong('\${t.id}')">✂️ Mulai Cukur</button> \`;
          } else if (t.status === 'Sedang Dipotong') {
            actionButtons += \`<button onclick="selesaiPotong('\${t.id}')">✅ Selesai</button> \`;
          }
        }

        // Super Admin ONLY: Tombol Hapus Transaksi Permanen
        if (currentRole === 'Super Admin') {
          actionButtons += \`<button class="btn-danger" onclick="hapusTransaksi('\${t.id}')">🗑️ Hapus</button>\`;
        }

        return \`<tr>
          <td>\${t.id}</td>
          <td>\${t.pelanggan}</td>
          <td>\${t.barber}</td>
          <td>\${t.layanan}</td>
          <td>Rp \${t.total.toLocaleString('id-ID')}</td>
          <td><span class="badge">\${t.status}</span></td>
          <td>\${actionButtons || '<span class="text-muted">Hanya Lihat</span>'}</td>
        </tr>\`;
      }).join('');
    }

    function render() {
      renderTransaksi();
    }

    // Handlers Bisnis Spesifik
    function prosesBayar(id) {
      const item = daftarTransaksi.find(t => t.id === id);
      if (item) item.status = 'Lunas';
      render();
      if (typeof showToast === 'function') showToast('Pembayaran ' + id + ' berhasil!', 'success');
    }

    function mulaiPotong(id) {
      const item = daftarTransaksi.find(t => t.id === id);
      if (item) item.status = 'Sedang Dipotong';
      render();
      if (typeof showToast === 'function') showToast('Mulai mencukur ' + id, 'info');
    }

    function selesaiPotong(id) {
      const item = daftarTransaksi.find(t => t.id === id);
      if (item) item.status = 'Selesai';
      render();
      if (typeof showToast === 'function') showToast('Cukur selesai untuk ' + id, 'success');
    }

    function hapusTransaksi(id) {
      if (currentRole !== 'Super Admin') {
        if (typeof showToast === 'function') showToast('Hanya Super Admin yang berhak menghapus!', 'error');
        return;
      }
      daftarTransaksi = daftarTransaksi.filter(t => t.id !== id);
      render();
      if (typeof showToast === 'function') showToast('Transaksi ' + id + ' berhasil dihapus', 'success');
    }

    function bukaModalStaf() { if (typeof showToast === 'function') showToast('Buka form staf', 'info'); }
    function bukaModalBooking() { if (typeof showToast === 'function') showToast('Buka form booking', 'info'); }
  </script>
</body>
</html>
`;

// Jalankan validasi & penyuntikan plumbing
const validatedBarbershop = validateAndRepairGeneratedCode(rawAiGeneratedBarbershop, '', '', ['Super Admin', 'Kasir', 'Barber', 'Pelanggan']);

console.log('Validasi Barbershop: isValid =', validatedBarbershop.isValid);
console.log('Issues:', validatedBarbershop.issues);

// -----------------------------------------------------------------------------
// BUKTI 3: SMART BOUNDARY CONTINUATION STITCHER (DEDUPLIKASI TOKEN)
// -----------------------------------------------------------------------------
console.log('\n--- BUKTI 3: SMART BOUNDARY CONTINUATION STITCHER ---');
// Kasus nyata yang memicu SYNTAX_ERROR: Unexpected token ')'
const beforeStitchPrefix = `function checkStatus(id) {
  if (typeof showTab === 'function')`;
const beforeStitchCont = `) showTab('tab-transaksi');
}`;

// Jika disambung secara buta (sebelum perbaikan):
const blindConcat = beforeStitchPrefix + beforeStitchCont;
console.log('[SEBELUM STITCHING - Blind Concat]:');
console.log(blindConcat);
try {
  acorn.parse(blindConcat, { ecmaVersion: 'latest', sourceType: 'script' });
} catch (e: any) {
  console.log('❌ Acorn SyntaxError pada blind concat:', e.message);
}

// Setelah diperbaiki dengan stitchContinuationCode:
const afterStitch = stitchContinuationCode(beforeStitchPrefix, beforeStitchCont);
console.log('\n[SESUDAH STITCHING - stitchContinuationCode]:');
console.log(afterStitch);
try {
  acorn.parse(afterStitch, { ecmaVersion: 'latest', sourceType: 'script' });
  console.log('✅ Acorn Syntax Check pada afterStitch: 100% VALID JAVASCRIPT!');
} catch (e: any) {
  console.error('Failed:', e);
}

// -----------------------------------------------------------------------------
// BUKTI 4: ACORN AST MENANGKAP TOP-LEVEL RETURN (YANG LOLOS DI NEW FUNCTION)
// -----------------------------------------------------------------------------
console.log('\n--- BUKTI 4: ACORN AST MENANGKAP ERROR TOP-LEVEL RETURN ---');
const topLevelReturnCode = `
const activeTab = 'tab-1';
return; // <-- Ilegal di browser script!
console.log('Tab:', activeTab);
`;

console.log('Kode Uji:\n', topLevelReturnCode);

let newFunctionResult = '';
try {
  new Function(topLevelReturnCode);
  newFunctionResult = 'LOLOS TANPA ERROR (Bug Lama!)';
} catch (e: any) {
  newFunctionResult = 'Error: ' + e.message;
}
console.log('1. new Function(code):', newFunctionResult);

let acornResult = '';
try {
  acorn.parse(topLevelReturnCode, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  acornResult = 'LOLOS';
} catch (e: any) {
  acornResult = 'DITANGKAP: "' + e.message + '" pada baris ' + e.loc.line + ', kolom ' + e.loc.column;
}
console.log('2. acorn.parse(code, { sourceType: "script" }):', acornResult);

// -----------------------------------------------------------------------------
// BUKTI 5: PENGUKURAN NYATA PENGURANGAN TOKEN
// -----------------------------------------------------------------------------
console.log('\n--- BUKTI 5: PENGUKURAN NYATA PENGURANGAN TOKEN ---');
const plumbingCodeSnippet = `
function showTab(tabId) {
  try {
    document.querySelectorAll('.tab-content, .tab-pane, [data-tab-content]').forEach(t => {
      t.classList.remove('active');
      t.style.display = 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    const target = document.getElementById(tabId) || document.getElementById('tab-' + tabId) || document.querySelector('[id*="' + tabId + '"]');
    if (target) {
      target.classList.add('active');
      target.style.display = 'block';
    }
    const targetBtn = document.getElementById('tab-btn-' + tabId) || document.querySelector('[onclick*="' + tabId + '"]');
    if (targetBtn) targetBtn.classList.add('active');
    if (typeof render === 'function') render();
    else if (typeof renderTable === 'function') renderTable();
  } catch (e) { console.log('showTab error', e); }
}

function filterTabsByRole(role) {
  try {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const roles = btn.getAttribute('data-access-roles');
      if (!roles) return;
      const allowed = roles.split(',').map(r => r.trim().toLowerCase());
      if (role && (allowed.includes(String(role).toLowerCase()) || allowed.includes('*') || allowed.includes('all'))) {
        btn.style.display = 'inline-flex';
      } else {
        btn.style.display = 'none';
      }
    });
  } catch (e) { console.log('filterTabs error', e); }
}

function logout() {
  try {
    currentRole = '';
    const loginEl = document.querySelector('#loginScreen, .login-screen');
    const appEl = document.querySelector('#appContainer, .app-container');
    if (appEl) appEl.style.display = 'none';
    if (loginEl) loginEl.style.display = 'flex';
    if (typeof showToast === 'function') showToast('Berhasil keluar. Silakan login kembali.', 'info');
  } catch (e) { console.log('logout error', e); }
}

function loginAs(role) {
  try {
    currentRole = role;
    const loginEl = document.querySelector('#loginScreen, .login-screen');
    const appEl = document.querySelector('#appContainer, .app-container');
    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'block';
    const badge = document.querySelector('#currentRoleBadge, #userRoleBadge, .role-badge');
    if (badge) badge.innerText = role;
    if (typeof filterTabsByRole === 'function') filterTabsByRole(role);
    const matched = (typeof DEMO_ACCOUNTS !== 'undefined' ? DEMO_ACCOUNTS : []).find(a => a.role === role);
    if (matched && matched.landingTab && typeof showTab === 'function') {
      showTab(matched.landingTab);
    } else if (typeof showTab === 'function') {
      const firstTab = document.querySelector('.tab-btn:not([style*="display: none"])');
      const tabMatch = firstTab?.getAttribute('onclick')?.match(/showTab\\(['"]([^'"]+)['"]\\)/);
      if (tabMatch && tabMatch[1]) {
        showTab(tabMatch[1]);
      } else if (firstTab) {
        firstTab.click();
      }
    }
    if (typeof render === 'function') render();
    else if (typeof renderTable === 'function') renderTable();
  } catch (e) { console.log('loginAs error', e); }
}

function showToast(msg, type = 'info') {
  try {
    let t = document.getElementById('appToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'appToast';
      t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#1e293b;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:9999;font-size:14px;transition:opacity 0.3s ease;';
      document.body.appendChild(t);
    }
    t.innerText = (type === 'error' ? '❌ ' : type === 'success' ? '✅ ' : 'ℹ️ ') + msg;
    t.style.display = 'block';
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.style.display = 'none', 300); }, 3000);
  } catch (e) { console.log('showToast', msg); }
}
`;

// Estimasi token standar OpenAI/Gemini: ~4 karakter per token
const plumbingChars = plumbingCodeSnippet.length;
const plumbingEstimatedTokens = Math.round(plumbingChars / 3.8);

const aiCodeChars = rawAiGeneratedBarbershop.length;
const aiEstimatedTokens = Math.round(aiCodeChars / 3.8);

const totalOldChars = aiCodeChars + plumbingChars;
const totalOldTokens = aiEstimatedTokens + plumbingEstimatedTokens;

console.log('1. Karakter Boilerplate Plumbing yang dipotong dari AI: ' + plumbingChars + ' karakter (~ ' + plumbingEstimatedTokens + ' token)');
console.log('2. Output AI yang harus ditulis SEBELUM pivot (dengan boilerplate): ' + totalOldChars + ' karakter (~ ' + totalOldTokens + ' token)');
console.log('3. Output AI yang harus ditulis SESUDAH pivot (murni bisnis): ' + aiCodeChars + ' karakter (~ ' + aiEstimatedTokens + ' token)');
const reductionPercentage = Math.round((plumbingEstimatedTokens / totalOldTokens) * 100);
console.log('4. Persentase Beban Token AI yang Terpangkas: ' + reductionPercentage + '%');
