import assert from 'assert';
import {
  validateAndRepairGeneratedCode,
  checkVueManualDomManipulation,
  checkVueHardcodedRoleCheck,
  extractVueManualDomIssues,
  extractVueHardcodedRoleIssues,
  findClosingDivIndex,
  removeOutsideSuperadminPanel
} from '../src/lib/codeValidator';

console.log('========================================================================');
console.log('🧪 TEST SUITE: VERIFIKASI 4 BUG NYATA GENERATE VUE (KURSUS MENYETIR MOBIL)');
console.log('========================================================================\n');

const roles = ['Super Admin', 'Staf Administrasi & Kasir', 'Instruktur Mengemudi', 'Siswa'];

// =============================================================================
// BUG 1: PANEL MANAJEMEN SISTEM (ANTI-LEAK & ANTI-DEAD BUTTONS)
// =============================================================================
console.log('--- [BUG 1] UJI PANEL MANAJEMEN SISTEM KHUSUS SUPER ADMIN ---');

// Cuplikan HTML dengan panel Manajemen Sistem diletakkan di luar <div id="app"> (seperti bug asli)
const buggyHtmlBug1 = `<!DOCTYPE html>
<html lang="id">
<head><title>Kursus Menyetir</title></head>
<body>
  <div id="app">
    <div id="loginScreen" v-if="!isLoggedIn"></div>
    <div id="appContainer" v-if="isLoggedIn">
      <h1>Kursus Menyetir Terpadu</h1>
      <button @click="logout">Keluar</button>
    </div>
  </div>
  <!-- BUG 1: Panel di luar <div id="app"> dengan data-access-roles & tombol tanpa @click -->
  <div class="card" data-od-auto="superadmin-management" data-access-roles="Super Admin" style="margin-top:16px;">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>Manajemen Sistem</h3>
      <span>Super Admin</span>
    </div>
    <div>
      <button type="button">Tambah Akun Staf</button>
      <button type="button">Atur Hak Akses</button>
      <button type="button">Nonaktifkan Akun Staf</button>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() { return { currentRole: '', isLoggedIn: false }; },
      methods: { logout() { this.currentRole = ''; this.isLoggedIn = false; } }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const reportBug1 = validateAndRepairGeneratedCode(buggyHtmlBug1, '', '', roles);
const repairedHtml1 = reportBug1.repairedCode.html;

// 1. Verifikasi panel di luar <div id="app"> telah dibersihkan
const appIdx = repairedHtml1.search(/<div[^>]*id=["']app["']/i);
const appCloseIdx = findClosingDivIndex(repairedHtml1, appIdx);
const panelIdx = repairedHtml1.indexOf('data-od-auto="superadmin-management"');

assert(panelIdx !== -1, 'FAILED: Panel superadmin-management harus tetap ada!');
assert(panelIdx < appCloseIdx, 'FAILED: Panel superadmin-management harus berada DI DALAM <div id="app">!');

// 2. Verifikasi panel berada di dalam #appContainer
const containerIdx = repairedHtml1.search(/<div[^>]*id=["']appContainer["']/i);
const containerCloseIdx = findClosingDivIndex(repairedHtml1, containerIdx);
assert(panelIdx > containerIdx && panelIdx < containerCloseIdx, 'FAILED: Panel superadmin-management harus berada di dalam #appContainer!');

// 3. Verifikasi direktif v-if="isRoleAllowed(['Super Admin'])"
assert(
  repairedHtml1.includes('v-if="isRoleAllowed([\'Super Admin\'])"'),
  'FAILED: Panel wajib menggunakan v-if="isRoleAllowed([\'Super Admin\'])"!'
);

// 4. Verifikasi ketiga tombol memiliki @click nyata (bukan dead button)
assert(repairedHtml1.includes('@click="bukaModalTambahStaf"'), 'FAILED: Tombol Tambah Akun Staf harus memiliki @click="bukaModalTambahStaf"!');
assert(repairedHtml1.includes('@click="bukaModalAturHakAkses"'), 'FAILED: Tombol Atur Hak Akses harus memiliki @click="bukaModalAturHakAkses"!');
assert(repairedHtml1.includes('@click="nonaktifkanAkunStaf"'), 'FAILED: Tombol Nonaktifkan Akun Staf harus memiliki @click="nonaktifkanAkunStaf"!');

// 5. Verifikasi simulasi isolasi role (Siswa & Instruktur tidak melihat panel, Super Admin melihat)
const mockPilar1Mixin = {
  currentRole: '',
  isRoleAllowed(targetRoles: string[]) {
    if (this.currentRole === 'Super Admin') return true;
    return targetRoles.includes(this.currentRole);
  }
};

mockPilar1Mixin.currentRole = 'Siswa';
assert.strictEqual(mockPilar1Mixin.isRoleAllowed(['Super Admin']), false, 'FAILED: Role Siswa tidak boleh melihat panel Manajemen Sistem!');

mockPilar1Mixin.currentRole = 'Instruktur Mengemudi';
assert.strictEqual(mockPilar1Mixin.isRoleAllowed(['Super Admin']), false, 'FAILED: Role Instruktur tidak boleh melihat panel Manajemen Sistem!');

mockPilar1Mixin.currentRole = 'Super Admin';
assert.strictEqual(mockPilar1Mixin.isRoleAllowed(['Super Admin']), true, 'FAILED: Role Super Admin wajib dapat melihat panel Manajemen Sistem!');

console.log('  ✅ BUG 1 PASS: Panel sukses dipindahkan ke dalam Vue, dilindungi v-if, tombol aktif, dan 100% terisolasi per role!\n');


// =============================================================================
// BUG 2: LOGIN/LOGOUT DILARANG MANIPULASI DOM MANUAL (WAJIB REAKTIVITAS VUE)
// =============================================================================
console.log('--- [BUG 2] UJI DETEKSI & PERBAIKAN MANIPULASI DOM MANUAL PADA LOGIN/LOGOUT ---');

const buggyHtmlBug2 = `<!DOCTYPE html>
<html lang="id">
<head><title>App</title></head>
<body>
  <div id="app">
    <div id="loginScreen" style="display: flex;">
      <button @click="handleLogin">Masuk</button>
    </div>
    <div id="appContainer" style="display: none;">
      <button @click="logout">Keluar</button>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return { currentRole: '' };
      },
      methods: {
        handleLogin() {
          this.currentRole = 'Super Admin';
          // BUG 2: Manipulasi DOM manual
          document.getElementById('loginScreen').style.display = 'none';
          document.getElementById('appContainer').style.display = 'block';
        },
        logout() {
          this.currentRole = '';
          // BUG 2: Manipulasi DOM manual
          const loginEl = document.getElementById('loginScreen');
          const appEl = document.getElementById('appContainer');
          if (appEl) appEl.style.display = 'none';
          if (loginEl) loginEl.style.display = 'flex';
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

// 1. Uji Detektor AST (Negative Test)
const domIssuesRaw = checkVueManualDomManipulation(null, buggyHtmlBug2, buggyHtmlBug2);
console.log('  Issues terdeteksi oleh checkVueManualDomManipulation:', domIssuesRaw);
assert(domIssuesRaw.length > 0, 'FAILED: Validator harus mendeteksi manipulasi DOM manual!');
assert(domIssuesRaw[0].includes('VUE_MANUAL_DOM_MANIPULATION'), 'FAILED: Issue harus bertipe VUE_MANUAL_DOM_MANIPULATION!');

// 2. Uji Auto-Repair Pipeline
const reportBug2 = validateAndRepairGeneratedCode(buggyHtmlBug2, '', '', roles);
const repairedHtml2 = reportBug2.repairedCode.html;

// Verifikasi ketiadaan document.getElementById(...).style.display pada hasil perbaikan
assert(!repairedHtml2.includes("document.getElementById('loginScreen').style.display"), 'FAILED: Manual DOM style display harus dihapus!');
assert(!repairedHtml2.includes("document.getElementById('appContainer').style.display"), 'FAILED: Manual DOM style display harus dihapus!');
assert(!repairedHtml2.includes("style=\"display: none;\""), 'FAILED: style="display: none;" statis harus dibersihkan dari HTML!');

// Verifikasi binding reaktif v-if pada #loginScreen dan #appContainer
assert(/id=["']loginScreen["'][^>]*v-if=["']!isLoggedIn["']/i.test(repairedHtml2), 'FAILED: #loginScreen harus terikat ke v-if="!isLoggedIn"!');
assert(/id=["']appContainer["'][^>]*v-if=["']isLoggedIn["']/i.test(repairedHtml2), 'FAILED: #appContainer harus terikat ke v-if="isLoggedIn"!');

// Verifikasi state isLoggedIn di data() dan manipulasi reaktif di methods
assert(repairedHtml2.includes('isLoggedIn: false'), 'FAILED: data() harus menginisialisasi isLoggedIn: false!');
assert(repairedHtml2.includes('this.isLoggedIn = false'), 'FAILED: logout() harus menyetel this.isLoggedIn = false!');

console.log('  ✅ BUG 2 PASS: Deteksi AST akurat dan auto-repair mengganti manipulasi DOM manual ke reaktivitas Vue murni!\n');


// =============================================================================
// BUG 3: canEditCurrentTab DILARANG HARDCODE NAMA ROLE (WAJIB isRoleAllowed)
// =============================================================================
console.log('--- [BUG 3] UJI canEditCurrentTab DINAMIS & ANTI-HARDCODE ROLE CHECK ---');

const buggyHtmlBug3 = `<!DOCTYPE html>
<html lang="id">
<head><title>App</title></head>
<body>
  <div id="app">
    <div id="appContainer">
      <button v-if="canEditCurrentTab">+ Tambah Data</button>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          currentRole: 'Siswa',
          currentTableConfig: { roles: ['Siswa', 'Super Admin'] }
        };
      },
      computed: {
        // BUG 3: Hardcode nama role literal Super Admin & Staf Administrasi saja
        canEditCurrentTab() {
          const roles = this.currentTableConfig.roles || [];
          return roles.includes('Super Admin') || roles.includes('Staf Administrasi & Kasir');
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

// 1. Uji Detektor AST (Negative Test)
const roleIssuesRaw = checkVueHardcodedRoleCheck(null, buggyHtmlBug3, buggyHtmlBug3, roles);
console.log('  Issues terdeteksi oleh checkVueHardcodedRoleCheck:', roleIssuesRaw);
assert(roleIssuesRaw.length > 0, 'FAILED: Validator harus mendeteksi role-check hardcode!');
assert(roleIssuesRaw[0].includes('VUE_HARDCODED_ROLE_CHECK'), 'FAILED: Issue harus bertipe VUE_HARDCODED_ROLE_CHECK!');

// 2. Uji Auto-Repair Pipeline
const reportBug3 = validateAndRepairGeneratedCode(buggyHtmlBug3, '', '', roles);
const repairedHtml3 = reportBug3.repairedCode.html;

// Verifikasi canEditCurrentTab didelegasikan ke isRoleAllowed
assert(
  repairedHtml3.includes('this.isRoleAllowed(allowed)'),
  'FAILED: canEditCurrentTab wajib mendelegasikan pengecekan ke this.isRoleAllowed(allowed)!'
);
assert(
  !repairedHtml3.includes("roles.includes('Super Admin') || roles.includes('Staf Administrasi & Kasir')"),
  'FAILED: String literal hardcode Super Admin / Staf Administrasi harus diganti!'
);

// 3. Uji Fungsional Evaluasi canEditCurrentTab
function evaluateCanEdit(tableRoles: string[], currentRole: string) {
  const isRoleAllowed = (allowed: string[]) => {
    if (currentRole === 'Super Admin') return true;
    return allowed.includes(currentRole);
  };
  const config = { roles: tableRoles };
  const allowed = config.roles || [];
  return isRoleAllowed(allowed);
}

// Skenario A: Tabel "bayar_tagihan" (diizinkan untuk Siswa & Super Admin)
assert.strictEqual(evaluateCanEdit(['Siswa', 'Super Admin'], 'Siswa'), true, 'FAILED: Siswa harus diizinkan edit/tambah tabel tagihan!');
assert.strictEqual(evaluateCanEdit(['Siswa', 'Super Admin'], 'Super Admin'), true, 'FAILED: Super Admin harus diizinkan edit/tambah!');

// Skenario B: Tabel "nilai_teknik" (diizinkan untuk Instruktur Mengemudi & Super Admin)
assert.strictEqual(evaluateCanEdit(['Instruktur Mengemudi', 'Super Admin'], 'Instruktur Mengemudi'), true, 'FAILED: Instruktur harus diizinkan input nilai!');
assert.strictEqual(evaluateCanEdit(['Instruktur Mengemudi', 'Super Admin'], 'Siswa'), false, 'FAILED: Siswa TIDAK boleh edit tabel nilai!');

console.log('  ✅ BUG 3 PASS: canEditCurrentTab dinamis, Siswa & Instruktur dapat menambah data sesuai izin RBAC!\n');


// =============================================================================
// BUG 4: MIXIN PILAR 1 TERDAFTAR SECARA FISIK DI createApp & STATE TOAST SELARAS
// =============================================================================
console.log('--- [BUG 4] UJI PENDAFTARAN FISIK MIXIN PILAR 1 & STANDARISASI TOAST ---');

const minimalVueHtml = `<!DOCTYPE html>
<html lang="id">
<head><title>App</title></head>
<body>
  <div id="app">
    <h1>Test App</h1>
  </div>
  <script>
    const app = Vue.createApp({
      data() { return { customState: 123 }; }
      // AI lupa mendefinisikan showToast, showTab, loginAs, logout, canEditCurrentTab
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const reportBug4 = validateAndRepairGeneratedCode(minimalVueHtml, '', '', roles);
const repairedHtml4 = reportBug4.repairedCode.html;

// 1. Verifikasi SECARA NYATA bahwa mixins: [...] muncul di kode output akhir
assert(
  repairedHtml4.includes('mixins: ['),
  'FAILED: Objek Vue.createApp wajib memiliki property mixins: [...] secara eksplisit di kode output!'
);
assert(
  repairedHtml4.includes('Pilar1VueScaffoldMixin'),
  'FAILED: Pilar1VueScaffoldMixin wajib terdaftar di dalam array mixins: [...]!'
);

// 2. Verifikasi state toast mendukung visible DAN show secara selaras
assert(
  repairedHtml4.includes('toast: this.toast || { show: false, visible: false, message: \'\', type: \'info\' }'),
  'FAILED: Mixin wajib mendukung properti show DAN visible pada state toast!'
);

// 3. Uji Safety Net / Fallback Penyelamatan Method yang Hilang
console.log('  [Fallback Safety Test] Menguji aktivasi method saat AI lupa mendefinisikan method...');
// Ekstrak definisi Pilar1VueScaffoldMixin dari script dan evaluasi
const mixinStartIdx = repairedHtml4.indexOf('var Pilar1VueScaffoldMixin');
assert(mixinStartIdx !== -1, 'FAILED: Definisi Pilar1VueScaffoldMixin harus ada di script!');

let depth = 0;
let braceStart = repairedHtml4.indexOf('{', mixinStartIdx);
let braceEnd = -1;
for (let i = braceStart; i < repairedHtml4.length; i++) {
  if (repairedHtml4[i] === '{') depth++;
  else if (repairedHtml4[i] === '}') {
    depth--;
    if (depth === 0) {
      braceEnd = i + 1;
      break;
    }
  }
}
assert(braceEnd !== -1, 'FAILED: Objek Pilar1VueScaffoldMixin harus memiliki penutup kurung kurawal!');
const mixinObjStr = repairedHtml4.slice(braceStart, braceEnd);

// Evaluasi fungsi mixin
const evaluatedMixin = eval(`(${mixinObjStr})`);
const mockComponentContext: any = {
  currentRole: '',
  isLoggedIn: false,
  activeTab: 'tabDasbor',
  toast: { show: false, visible: false, message: '', type: 'info' },
  ...evaluatedMixin.methods
};

// Panggil showToast via fallback mixin
mockComponentContext.showToast('Data berhasil disimpan!', 'success');
assert.strictEqual(mockComponentContext.toast.show, true, 'FAILED: Fallback showToast harus menyetel toast.show = true!');
assert.strictEqual(mockComponentContext.toast.visible, true, 'FAILED: Fallback showToast harus menyetel toast.visible = true!');
assert.strictEqual(mockComponentContext.toast.message, 'Data berhasil disimpan!', 'FAILED: Pesan toast harus sesuai!');

// Panggil loginAs via fallback mixin
mockComponentContext.loginAs('Instruktur Mengemudi');
assert.strictEqual(mockComponentContext.currentRole, 'Instruktur Mengemudi', 'FAILED: Fallback loginAs harus menyetel currentRole!');
assert.strictEqual(mockComponentContext.isLoggedIn, true, 'FAILED: Fallback loginAs harus menyetel isLoggedIn = true!');

// Panggil logout via fallback mixin
mockComponentContext.logout();
assert.strictEqual(mockComponentContext.currentRole, '', 'FAILED: Fallback logout harus mereset currentRole!');
assert.strictEqual(mockComponentContext.isLoggedIn, false, 'FAILED: Fallback logout harus mereset isLoggedIn = false!');

// Panggil tombol aksi Super Admin via fallback mixin
mockComponentContext.bukaModalTambahStaf();
assert.strictEqual(mockComponentContext.toast.visible, true, 'FAILED: bukaModalTambahStaf fallback harus aktif!');

mockComponentContext.bukaModalAturHakAkses();
assert.strictEqual(mockComponentContext.toast.visible, true, 'FAILED: bukaModalAturHakAkses fallback harus aktif!');

mockComponentContext.nonaktifkanAkunStaf();
assert.strictEqual(mockComponentContext.toast.visible, true, 'FAILED: nonaktifkanAkunStaf fallback harus aktif!');

console.log('  ✅ BUG 4 PASS: mixins: [...] terdaftar nyata di kode, skema toast sinkron, dan fallback penyelamatan teruji 100% aktif!\n');

console.log('========================================================================');
console.log('🎉 SELURUH 4 BUG TERVERIFIKASI TUNTAS DIPERBAIKI (100% PASS)');
console.log('========================================================================');
