import { AppProjectState } from '@/types/app';

export const initialProjectState: AppProjectState = {
  id: 'proj-' + Date.now(),
  title: 'Aplikasi Kasir & Inventaris Toko',
  description: 'Aplikasi manajemen stok barang, penjualan kasir, dan laporan keuangan harian.',
  currentPhase: 'FASE_0_WELCOME',
  inputMode: 'TEXT',
  imageSubCase: 'SCREENSHOT_REF',
  visualDNA: {
    themeName: 'Midnight Neon Glass',
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    backgroundColor: '#0f172a',
    cardColor: '#1e293b',
    textColor: '#f8fafc',
    accentColor: '#38bdf8',
    borderRadius: '16px',
    fontStyle: 'Outfit, sans-serif',
    visualMood: 'Glassmorphism',
  },
  mandatorySpecs: {
    requiresLogin: true,
    loginType: 'ROLE_BASED',
    hasAdminRole: true,
    hasUserManagement: true,
    keyButtonsActions: [
      'Tambah Barang Baru',
      'Proses Transaksi Kasir',
      'Cetak Struk Penjualan',
      'Kelola User & Hak Akses',
      'Export Laporan ke Excel/PDF'
    ],
    basicValidationRules: [
      'Username & Password tidak boleh kosong saat login',
      'Harga barang harus angka positif',
      'Stok barang berkurang otomatis saat transaksi selesai',
      'Tambah User hanya bisa dilakukan oleh Role Admin'
    ],
    targetUsers: 'Kasir toko, Pemilik Usaha / Admin Inventaris',
    appGoal: 'Mempercepat pencatatan transaksi harian dan mencegah kebobolan stok barang.'
  },
  featureChecklist: [
    {
      id: 'f-1',
      category: 'Auth & Access',
      title: 'Halaman Login & Validasi Karakter',
      description: 'Layar login dengan validasi input dasar dan pesan error interaktif.',
      status: 'COMPLETED'
    },
    {
      id: 'f-2',
      category: 'Auth & Access',
      title: 'Manajemen User (Role Admin)',
      description: 'Fitur Tambah User & hapus akses yang terkunci di balik login Admin.',
      status: 'COMPLETED'
    },
    {
      id: 'f-3',
      category: 'Core Workflow',
      title: 'POS Kasir & Hitung Total otomatis',
      description: 'Pencarian produk, keranjang belanja, kalkulasi otomatis, dan kembalian.',
      status: 'COMPLETED'
    },
    {
      id: 'f-4',
      category: 'Core Workflow',
      title: 'Tabel Inventaris (CRUD & State JS)',
      description: 'Tambah, edit, dan hapus barang dengan state terhubung.',
      status: 'COMPLETED'
    },
    {
      id: 'f-5',
      category: 'Backend & Data',
      title: 'Integrasi Google Apps Script',
      description: 'Pengiriman data transaksi dan barang ke Google Sheets.',
      status: 'IN_PROGRESS'
    }
  ],
  rolePermissions: [
    {
      roleName: 'Admin',
      canAddUser: true,
      canEditData: true,
      canViewReports: true,
      accessScope: 'Full System Access + User Management'
    },
    {
      roleName: 'User',
      canAddUser: false,
      canEditData: true,
      canViewReports: false,
      accessScope: 'Kasir & Input Transaksi Penjualan'
    }
  ],
  dataColumns: [
    { columnName: 'id', dataType: 'STRING', isRequired: true, description: 'ID Unik Transaksi / Barang' },
    { columnName: 'timestamp', dataType: 'DATE', isRequired: true, description: 'Waktu Transaksi Disimpan' },
    { columnName: 'item_name', dataType: 'STRING', isRequired: true, description: 'Nama Produk / Barang' },
    { columnName: 'category', dataType: 'STRING', isRequired: false, description: 'Kategori Produk' },
    { columnName: 'price', dataType: 'NUMBER', isRequired: true, description: 'Harga Jual Satuan' },
    { columnName: 'stock', dataType: 'NUMBER', isRequired: true, description: 'Sisa Stok Barang' },
    { columnName: 'created_by', dataType: 'STRING', isRequired: true, description: 'User / Kasir yang Input' }
  ],
  canvasCode: {
    html: `<div class="app-container">
  <header class="navbar">
    <div class="logo">🚀 KasirPro <span>Studio</span></div>
    <div class="user-badge" id="userBadge">Guest (Not Logged In)</div>
  </header>

  <main class="content">
    <section class="card" id="loginCard">
      <h2>🔑 Login Akses Sistem</h2>
      <p class="subtitle">Masuk sebagai Kasir atau Admin untuk membuka fitur penuh</p>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="usernameInput" placeholder="Masukkan username (cth: admin)" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="passwordInput" placeholder="••••••••" />
      </div>
      <div class="form-group">
        <label>Pilih Role</label>
        <select id="roleSelect">
          <option value="kasir">Kasir (User Standard)</option>
          <option value="admin">Admin (Akses Penuh + Tambah User)</option>
        </select>
      </div>
      <button class="btn-primary" onclick="handleLogin()">Masuk Aplikasi</button>
      <p id="loginError" class="error-text" style="display:none;"></p>
    </section>

    <section class="card" id="dashboardCard" style="display:none;">
      <div class="card-header">
        <h2>📦 Tabel Inventaris Barang</h2>
        <button class="btn-success" id="btnAddUser" style="display:none;" onclick="showAddUserModal()">+ Tambah User Admin</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Nama Barang</th>
            <th>Harga</th>
            <th>Stok</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody id="inventoryList">
          <!-- State JS akan mengisi tabel secara dinamis -->
        </tbody>
      </table>
    </section>
  </main>
</div>`,
    css: `/* Midnight Glassmorphism Palette */
:root {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
  --card-bg: rgba(30, 41, 59, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --accent: #38bdf8;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Outfit', -apple-system, sans-serif;
  background: var(--bg-gradient);
  color: var(--text-main);
  min-height: 100vh;
}

.app-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px;
}

.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--card-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  margin-bottom: 24px;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}
.logo span { color: var(--accent); }

.user-badge {
  padding: 6px 16px;
  background: rgba(99, 102, 241, 0.2);
  border: 1px solid var(--primary);
  border-radius: 20px;
  font-size: 13px;
  color: var(--accent);
}

.card {
  background: var(--card-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
}

.form-group {
  margin-bottom: 20px;
}
.form-group label {
  display: block;
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
input, select {
  width: 100%;
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  box-sizing: border-box;
}

.btn-primary {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

.error-text {
  color: #f87171;
  font-size: 14px;
  margin-top: 12px;
  text-align: center;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}
.data-table th, .data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}
.data-table th { color: var(--text-muted); font-size: 13px; }`,
    js: `// State JS Aplikasi Kasir
let currentUser = null;
let inventoryData = [
  { id: 'PRD-001', name: 'Beras Premium 5kg', price: 75000, stock: 45 },
  { id: 'PRD-002', name: 'Minyak Goreng 2L', price: 34000, stock: 12 },
  { id: 'PRD-003', name: 'Gula Pasir 1kg', price: 16500, stock: 28 }
];

function handleLogin() {
  const username = document.getElementById('usernameInput').value.trim();
  const pass = document.getElementById('passwordInput').value.trim();
  const role = document.getElementById('roleSelect').value;
  const errorEl = document.getElementById('loginError');

  if (!username || !pass) {
    errorEl.textContent = '❌ Username dan password wajib diisi!';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  currentUser = { username: username, role: role };

  // Update UI State
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('dashboardCard').style.display = 'block';
  document.getElementById('userBadge').textContent = '👤 ' + username + ' (' + role.toUpperCase() + ')';

  // Lock / Unlock Fitur Tambah User khusus Admin
  if (role === 'admin') {
    document.getElementById('btnAddUser').style.display = 'inline-block';
  } else {
    document.getElementById('btnAddUser').style.display = 'none';
  }

  renderInventory();
}

function renderInventory() {
  const tbody = document.getElementById('inventoryList');
  tbody.innerHTML = '';
  inventoryData.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td>\${item.id}</td>
      <td><strong>\${item.name}</strong></td>
      <td>Rp \${item.price.toLocaleString('id-ID')}</td>
      <td>\${item.stock} unit</td>
      <td><button style="padding:4px 8px; background:#ef4444; border:none; color:#fff; border-radius:6px; cursor:pointer;" onclick="deleteItem('\${item.id}')">Hapus</button></td>
    \`;
    tbody.appendChild(tr);
  });
}

function deleteItem(id) {
  inventoryData = inventoryData.filter(i => i.id !== id);
  renderInventory();
}

function showAddUserModal() {
  alert('✨ Fitur Tambah User terbuka khusus untuk Role Admin!');
}`
  },
  gasConfig: {
    sheetId: '1A2b3C4d5E6f7G8h9I0j-GoogleSheetSampleID',
    webAppUrl: 'https://script.google.com/macros/s/AKfycbxSampleWebAppURL/exec',
    scriptCode: `/**
 * BACKEND GOOGLE APPS SCRIPT - MUDAH BIKIN APLIKASI
 * Menghubungkan Form & State JS ke Google Sheets
 */
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  const result = rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return ContentService
    .createTextOutput(JSON.stringify({ status: "success", data: result }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // Append baris baru ke Google Sheets
    sheet.appendRow([
      contents.id || "ID-" + new Date().getTime(),
      new Date(),
      contents.item_name || "",
      contents.category || "",
      contents.price || 0,
      contents.stock || 0,
      contents.created_by || "System"
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", message: "Data berhasil disimpan!" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`,
    isConnected: true
  },
  qualityAudit: {
    isCanvasCodeOnly: true,
    hasDynamicState: true,
    hasAdminUserManagement: true,
    hasLoginValidation: true,
    isResponsiveGlassmorphism: true,
    hasGasBackend: true,
    totalScore: 100,
    warnings: [],
    recommendations: [
      'Semua aturan mutlak telah terpenuhi 100%',
      'Kode ditampilkan penuh dalam Canvas preview',
      'Fitur Tambah User Admin sudah terkunci di balik autentikasi'
    ]
  },
  updatedAt: new Date().toISOString()
};
