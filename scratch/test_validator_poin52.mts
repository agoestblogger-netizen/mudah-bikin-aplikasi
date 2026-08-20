import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator.js';

console.log('=== TEST UNIT: codeValidator.ts - POIN 52 TAB GATING & ANTI-DATA LEAK ===\n');

// KASUS 1: Kode bermasalah (regresi sesuai laporan pengguna)
// - Seluruh tab staf terbuka tanpa style="display:none"
// - Tidak ada filterTabsByRole('Pelanggan') di init
// - Di tab pelanggan ada tabel master dengan tombol Hapus/Edit
const badHtml = `
<!DOCTYPE html>
<html>
<head><title>Laundry Pro</title></head>
<body>
  <div id="appContainer">
    <div class="tabs">
      <button class="tab-btn" data-access-roles="Pelanggan" onclick="showTab('lacak')">Pesan & Lacak</button>
      <button class="tab-btn" data-access-roles="Kasir" onclick="showTab('kasir')">Kasir</button>
      <button class="tab-btn" data-access-roles="Washer" onclick="showTab('washer')">Antrean Cuci</button>
    </div>

    <!-- TAB PUBLIK BERMASALAH (DATA LEAK) -->
    <div id="tab-lacak">
      <h2>Daftar Seluruh Cucian Pelanggan</h2>
      <table>
        <tr><th>Nama</th><th>Aksi</th></tr>
        <tr><td>Budi</td><td><button onclick="editPesanan(1)">Edit</button><button onclick="hapusData(1)">Hapus</button></td></tr>
      </table>
    </div>

    <div id="tab-kasir" style="display:none;"><h2>Kasir</h2></div>
    <div id="tab-washer" style="display:none;"><h2>Washer</h2></div>
  </div>

  <div id="modalLogin" style="display:none;">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>

  <script>
    let currentRole = 'Pelanggan';
    const DEMO_ACCOUNTS = [
      { role: 'Pelanggan', username: 'pelanggan', password: 'pelanggan123' },
      { role: 'Kasir', username: 'kasir', password: 'kasir123' },
      { role: 'Washer', username: 'washer', password: 'washer123' }
    ];

    function handleLogin() { loginAs('Kasir'); }

    function loginAs(role) {
      currentRole = role;
      filterTabsByRole(role);
    }

    function filterTabsByRole(role) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        const allowed = (btn.getAttribute('data-access-roles') || '').split(',');
        btn.style.display = allowed.includes(role) ? '' : 'none';
      });
    }

    function showTab(id) {}
    function render() {}
  </script>
</body>
</html>
`;

console.log('1. Menguji KASUS 1 (Kode Bermasalah)...');
const result1 = validateAndRepairGeneratedCode(badHtml, '', '', ['Pelanggan', 'Kasir', 'Washer']);
console.log(`- Is Valid: ${result1.isValid ? '✅ VALID' : '❌ INVALID (Terdeteksi Masalah Sesuai Harapan)'}`);
console.log('- Issues Terdeteksi:');
result1.issues.forEach(iss => console.log('  •', iss));

// Verifikasi auto-repair
console.log('\n2. Memeriksa Hasil Auto-Repair KASUS 1:');
const repairedHtml1 = result1.repairedCode.html;
const hasAutoFilteredStaff = repairedHtml1.includes('data-access-roles="Kasir" style="display: none;"') || repairedHtml1.includes('filterTabsByRole(\'Pelanggan\')');
console.log(`- Tab staf otomatis disembunyikan / script init disisipkan: ${hasAutoFilteredStaff ? '✅ YA' : '❌ TIDAK'}`);

// KASUS 2: Kode Baik (Sesuai Poin 52)
const goodHtml = `
<!DOCTYPE html>
<html>
<head><title>Laundry Pro</title></head>
<body>
  <div id="appContainer">
    <header>
      <h1>Laundry Pro</h1>
      <button onclick="bukaModalLogin()">🔐 Login Staf</button>
    </header>

    <div class="tabs">
      <button class="tab-btn" data-access-roles="Pelanggan" onclick="showTab('lacak')">Lacak Status</button>
      <button class="tab-btn" data-access-roles="Kasir" style="display: none;" onclick="showTab('kasir')">Kasir</button>
      <button class="tab-btn" data-access-roles="Washer" style="display: none;" onclick="showTab('washer')">Antrean Cuci</button>
    </div>

    <!-- TAB PUBLIK AMAN (Form Search & Card Status) -->
    <div id="tab-lacak">
      <h2>Lacak Pesanan Anda</h2>
      <input type="text" id="noNota" placeholder="Masukkan nomor nota...">
      <button onclick="lacakPesanan()">Cari</button>
      <div id="hasilLacak"></div>
    </div>

    <!-- TAB INTERNAL KASIR (Ada Edit/Hapus Hanya di Sini) -->
    <div id="tab-kasir" style="display:none;">
      <h2>Panel Kasir</h2>
      <table>
        <tr><th>Nota</th><th>Pelanggan</th><th>Aksi</th></tr>
        <tr><td>#001</td><td>Budi</td><td><button onclick="editData(1)">Edit</button><button onclick="hapusData(1)">Hapus</button></td></tr>
      </table>
    </div>

    <div id="tab-washer" style="display:none;"><h2>Antrean Cuci</h2></div>
  </div>

  <div id="modalLogin" style="display:none;">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>

  <script>
    let currentRole = 'Pelanggan';
    const DEMO_ACCOUNTS = [
      { role: 'Pelanggan', username: 'pelanggan', password: 'pelanggan123' },
      { role: 'Kasir', username: 'kasir', password: 'kasir123' },
      { role: 'Washer', username: 'washer', password: 'washer123' }
    ];

    document.addEventListener('DOMContentLoaded', () => {
      filterTabsByRole('Pelanggan');
      showTab('lacak');
      render();
    });

    function handleLogin() { loginAs('Kasir'); }

    function loginAs(role) {
      currentRole = role;
      filterTabsByRole(role);
      showTab('kasir');
    }

    function filterTabsByRole(role) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        const allowed = (btn.getAttribute('data-access-roles') || '').split(',').map(r => r.trim().toLowerCase());
        btn.style.display = (role && allowed.includes(role.toLowerCase())) ? '' : 'none';
      });
    }

    function lacakPesanan() {}
    function showTab(id) {}
    function render() {}
    function editData(id) {}
    function hapusData(id) {}
    function bukaModalLogin() {}
  </script>
</body>
</html>
`;

console.log('\n3. Menguji KASUS 2 (Kode Baik Sesuai Poin 52)...');
const result2 = validateAndRepairGeneratedCode(goodHtml, '', '', ['Pelanggan', 'Kasir', 'Washer']);
console.log(`- Is Valid: ${result2.isValid ? '✅ VALID (100% Lulus)' : '❌ INVALID'}`);
if (result2.issues.length > 0) {
  console.log('- Issues:\n ', result2.issues.join('\n  '));
}

if (!result1.isValid && result2.isValid) {
  console.log('\n🎉 VALIDATOR POIN 52 BEKERJA SEMPURNA DENGAN PRESISI TINGGI!');
} else {
  console.error('\n⚠️ VALIDATOR PERLU PENYESUAIAN.');
  process.exit(1);
}
