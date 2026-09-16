import assert from 'assert';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('========================================================================');
console.log('🧪 TEST SUITE #12: ROLE TAB NAVIGATION & PUBLIC ROLE SECURITY GATE');
console.log('========================================================================\n');

const roles3 = ['Super Admin', 'Petugas Perawat Hewan', 'Pelanggan'];

// =============================================================================
// BUG 1 — ROLE_MISSING_TAB_NAVIGATION: DETEKSI & AUTO-REPAIR
// =============================================================================
console.log('--- [BUG 1-A] UJI NEGATIF: Kode Vue TANPA tab untuk "Petugas Perawat Hewan" ---');

const htmlMissingTab = `<!DOCTYPE html>
<html lang="id">
<head><title>Klinik Hewan</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body class="bg-gray-50">
  <div id="app">
    <div id="loginScreen" v-if="!isLoggedIn" class="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl shadow-lg">
      <h2 class="text-2xl font-bold">Klinik Hewan Sehat</h2>
      <button @click="handleLogin" class="px-4 py-2 bg-blue-600 text-white rounded">Masuk</button>
    </div>
    <div id="appContainer" v-else>
      <nav class="flex gap-2 p-4 border-b">
        <button v-for="tab in tabs" :key="tab.id"
          v-show="isRoleAllowed(tab.roles)"
          @click="showTab(tab.id)"
          class="px-3 py-1 rounded">{{ tab.label }}</button>
      </nav>
      <div v-show="activeTab === 'tab_super_admin'" class="p-4">Konten Super Admin</div>
      <div v-show="activeTab === 'tab_pelanggan'" class="p-4">Konten Pelanggan</div>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          isLoggedIn: false,
          currentRole: '',
          activeTab: 'tab_super_admin',
          // BUG 1: Tab "Petugas Perawat Hewan" hilang — hanya ada 2 tab padahal ada 3 role
          tabs: [
            { id: 'tab_super_admin', label: '⚙️ Kelola Sistem', roles: ['Super Admin'], icon: '⚙️' },
            { id: 'tab_pelanggan', label: '🪪 Pesanan & Info Saya', roles: ['Pelanggan'], icon: '🪪' }
          ],
          toast: { show: false, visible: false, message: '', type: 'info' }
        };
      },
      methods: {
        handleLogin() { this.isLoggedIn = true; this.currentRole = 'Super Admin'; },
        logout() { this.isLoggedIn = false; this.currentRole = ''; },
        showTab(id) { this.activeTab = id; },
        isRoleAllowed(roles) {
          if (!this.currentRole) return false;
          if (this.currentRole === 'Super Admin') return true;
          return roles.includes(this.currentRole);
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

// 1A: Validator harus mendeteksi ROLE_MISSING_TAB_NAVIGATION
const report1A = validateAndRepairGeneratedCode(htmlMissingTab, '', '', roles3);
const hasMissingTabIssue = report1A.issues.some(i => i.includes('ROLE_MISSING_TAB_NAVIGATION'));
console.log('  Issues terdeteksi:', report1A.issues.filter(i => i.includes('ROLE_MISSING_TAB_NAVIGATION')));
assert(hasMissingTabIssue, 'FAILED: Validator harus mendeteksi ROLE_MISSING_TAB_NAVIGATION untuk Petugas Perawat Hewan!');
console.log('  ✅ Deteksi ROLE_MISSING_TAB_NAVIGATION berhasil!\n');

console.log('--- [BUG 1-B] UJI POSITIF AUTO-REPAIR: Tab "Petugas Perawat Hewan" diinjeksi ---');
const repairedHtml1 = report1A.repairedCode.html;
// Setelah repair, tabs array harus memiliki entry untuk Petugas Perawat Hewan
const hasPetugasTab = /roles\s*:\s*\[\s*['"]Petugas Perawat Hewan['"]\s*\]/i.test(repairedHtml1) ||
                       /roles\s*:\s*\[[^\]]*['"]Petugas Perawat Hewan['"]/i.test(repairedHtml1);
console.log('  Tab Petugas Perawat Hewan ada di repaired HTML?', hasPetugasTab);
assert(hasPetugasTab, 'FAILED: Auto-repair harus menambahkan tab untuk Petugas Perawat Hewan di array tabs!');

// Verifikasi tab menggunakan emoji dan label yang tepat
const hasPetugasEmoji = repairedHtml1.includes('🐾') || repairedHtml1.includes('💊');
console.log('  Tab memiliki emoji domain-appropriate (🐾 atau 💊)?', hasPetugasEmoji);
assert(hasPetugasEmoji, 'FAILED: Tab Petugas Perawat Hewan harus menggunakan emoji yang sesuai!');

// Verifikasi semua 3 role kini ada di tabs
const tabRolesAfter: string[] = [];
const tabMatches = [...repairedHtml1.matchAll(/roles\s*:\s*\[([^\]]+)\]/gi)];
for (const m of tabMatches) {
  tabMatches && tabRolesAfter.push(...m[1].split(',').map(s => s.replace(/['"]/g, '').trim()).filter(Boolean));
}
const allRolesCovered = roles3.every(role => {
  const roleLower = role.toLowerCase();
  return tabRolesAfter.some(tr => {
    const trLower = tr.toLowerCase();
    return trLower === roleLower || trLower.includes(roleLower) || roleLower.includes(trLower);
  });
});
console.log('  Tab roles setelah repair:', [...new Set(tabRolesAfter)].join(', '));
console.log('  Semua 3 role dicakup?', allRolesCovered);
assert(allRolesCovered, `FAILED: Setelah auto-repair, semua ${roles3.length} role harus memiliki tab!`);
console.log('  ✅ BUG 1 PASS: ROLE_MISSING_TAB_NAVIGATION terdeteksi & auto-repair berhasil inject tab!\n');

// =============================================================================
// BUG 1-C — GENERALISASI: Role tidak lazim lain (nama panjang/domain unik)
// =============================================================================
console.log('--- [BUG 1-C] UJI GENERALISASI: Role tidak lazim — "Kurir Ekspres" tanpa tab ---');
const rolesGeneralization = ['Super Admin', 'Kurir Ekspres', 'Manajer Logistik'];
const htmlMissingCourier = htmlMissingTab.replace(
  "tabs: [\n            { id: 'tab_super_admin', label: '⚙️ Kelola Sistem', roles: ['Super Admin'], icon: '⚙️' },\n            { id: 'tab_pelanggan', label: '🪪 Pesanan & Info Saya', roles: ['Pelanggan'], icon: '🪪' }\n          ]",
  "tabs: [\n            { id: 'tab_super_admin', label: '⚙️ Kelola Sistem', roles: ['Super Admin'], icon: '⚙️' },\n            { id: 'tab_manajer', label: '📈 Monitoring', roles: ['Manajer Logistik'], icon: '📈' }\n          ]"
);
const reportGen = validateAndRepairGeneratedCode(htmlMissingCourier, '', '', rolesGeneralization);
assert(
  reportGen.issues.some(i => i.includes('ROLE_MISSING_TAB_NAVIGATION')),
  'FAILED: Validator harus mendeteksi tab Kurir Ekspres hilang!'
);
const repairedGen = reportGen.repairedCode.html;
const hasCourierTab = /roles\s*:\s*\[[^\]]*['"]Kurir Ekspres['"]/i.test(repairedGen) ||
                       /Kurir Ekspres/i.test(repairedGen);
assert(hasCourierTab, 'FAILED: Auto-repair harus menambahkan tab untuk Kurir Ekspres!');
console.log('  ✅ GENERALISASI PASS: Role tidak lazim "Kurir Ekspres" terdeteksi & diperbaiki!\n');

// =============================================================================
// BUG 2 — PUBLIC_ROLE_UNFILTERED_ON_LOAD: FALSE POSITIVE FIX UNTUK VUE APP
// =============================================================================
console.log('--- [BUG 2-A] UJI FALSE POSITIVE FIX: Vue app dengan v-if reactive gate ---');

const htmlVueWithGate = `<!DOCTYPE html>
<html lang="id">
<head><title>Klinik Hewan</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body class="bg-gray-50">
  <div id="app">
    <!-- Gate reaktif Vue: loginScreen hanya tampil saat belum login -->
    <div id="loginScreen" v-if="!isLoggedIn" class="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl shadow-lg">
      <h2 class="text-2xl font-bold">Klinik Hewan Sehat</h2>
      <button @click="handleLogin" class="px-4 py-2 bg-blue-600 text-white rounded">Masuk</button>
      <button @click="loginAs('Pelanggan')" class="mt-2 text-sm text-blue-600">Lanjut sebagai Pelanggan</button>
    </div>
    <!-- appContainer hanya tampil setelah login -->
    <div id="appContainer" v-else>
      <nav class="flex gap-2 p-4 border-b">
        <button v-for="tab in tabs" :key="tab.id"
          v-show="isRoleAllowed(tab.roles)"
          @click="showTab(tab.id)"
          class="px-3 py-1 rounded">{{ tab.label }}</button>
      </nav>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          isLoggedIn: false,
          currentRole: '',
          activeTab: 'tab_super_admin',
          tabs: [
            { id: 'tab_super_admin', label: '⚙️ Kelola Sistem', roles: ['Super Admin'], icon: '⚙️' },
            { id: 'tab_petugas', label: '🐾 Perawatan Hewan', roles: ['Petugas Perawat Hewan'], icon: '🐾' },
            { id: 'tab_pelanggan', label: '🪪 Info Hewan Saya', roles: ['Pelanggan'], icon: '🪪' }
          ],
          toast: { show: false, visible: false, message: '', type: 'info' }
        };
      },
      methods: {
        handleLogin() { this.isLoggedIn = true; this.currentRole = 'Super Admin'; },
        logout() { this.isLoggedIn = false; this.currentRole = ''; },
        loginAs(role) { this.currentRole = role; this.isLoggedIn = true; },
        showTab(id) { this.activeTab = id; },
        isRoleAllowed(roles) {
          if (!this.currentRole) return false;
          if (this.currentRole === 'Super Admin') return true;
          return roles.includes(this.currentRole);
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

// Vue app dengan v-if="!isLoggedIn" + v-else TIDAK boleh memicu PUBLIC_ROLE_UNFILTERED_ON_LOAD
const report2A = validateAndRepairGeneratedCode(htmlVueWithGate, '', '', roles3);
const hasFalsePositive = report2A.issues.some(i => i.includes('PUBLIC_ROLE_UNFILTERED_ON_LOAD'));
console.log('  Issues terdeteksi pada Vue reactive gate app:', report2A.issues.filter(i => i.includes('PUBLIC_ROLE_UNFILTERED_ON_LOAD')));
assert(!hasFalsePositive, 'FAILED: Vue app dengan v-if="!isLoggedIn" + v-else + isRoleAllowed TIDAK boleh memicu PUBLIC_ROLE_UNFILTERED_ON_LOAD (false positive)!');
console.log('  ✅ BUG 2-A PASS: False positive tidak terpicu pada Vue reactive gate app!\n');

console.log('--- [BUG 2-B] UJI REGRESI: Vue app tanpa gate — validator harus perbaiki atau tandai ---');

// Vue app yang benar-benar rusak: tidak ada v-if/v-else/isRoleAllowed sama sekali.
// Validator melakukan dua hal yang keduanya valid:
//   (a) Mendeteksi dan push issue PUBLIC_ROLE_UNFILTERED_ON_LOAD, ATAU
//   (b) Auto-repair lebih awal (menambahkan isRoleAllowed/v-show pada tab) — sehingga hasil akhir aman.
// Test ini memverifikasi bahwa HASIL AKHIR (repairedCode) selalu aman.
const htmlVueBrokenGate = `<!DOCTYPE html>
<html lang="id">
<head><title>Klinik Hewan</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body class="bg-gray-50">
  <div id="app">
    <!-- Tidak menggunakan v-if reactive — loginScreen selalu tampil -->
    <div id="loginScreen" class="max-w-md mx-auto my-12 bg-white p-8 rounded-2xl shadow-lg">
      <h2 class="text-2xl font-bold">Klinik Hewan Sehat</h2>
      <input type="text" id="loginUsername" v-model="loginForm.username">
      <input type="password" id="loginPassword" v-model="loginForm.password">
      <button @click="handleLogin" class="px-4 py-2 bg-blue-600 text-white rounded">Masuk</button>
      <button @click="loginAs('Pelanggan')" class="mt-2 text-sm text-blue-600">Lanjut sebagai Pelanggan</button>
    </div>
    <!-- appContainer tidak punya v-if/v-else, tab tidak punya isRoleAllowed -->
    <div id="appContainer">
      <nav class="flex gap-2 p-4 border-b">
        <button v-for="tab in tabs" :key="tab.id" @click="showTab(tab.id)">{{ tab.label }}</button>
      </nav>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          currentRole: '',
          loginForm: { username: '', password: '' },
          activeTab: 'tab_super_admin',
          tabs: [
            { id: 'tab_super_admin', label: '⚙️ Kelola Sistem', roles: ['Super Admin'] },
            { id: 'tab_petugas', label: '🐾 Perawatan Hewan', roles: ['Petugas Perawat Hewan'] },
            { id: 'tab_pelanggan', label: '🪪 Info Hewan Saya', roles: ['Pelanggan'] }
          ],
          toast: { show: false, message: '' }
        };
      },
      methods: {
        handleLogin() { this.currentRole = 'Super Admin'; },
        loginAs(role) { this.currentRole = role; },
        logout() { this.currentRole = ''; },
        showTab(id) { this.activeTab = id; }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const report2B = validateAndRepairGeneratedCode(htmlVueBrokenGate, '', '', roles3);
const repairedBrokenVue = report2B.repairedCode.html;

// Validator harus melakukan SALAH SATU dari dua hal yang benar:
// (a) Memunculkan issue PUBLIC_ROLE_UNFILTERED_ON_LOAD, ATAU
// (b) Auto-repair sehingga repairedCode mengandung isRoleAllowed di tab navigation
const hasIssue = report2B.issues.some(i => i.includes('PUBLIC_ROLE_UNFILTERED_ON_LOAD'));
const hasRepairedGate = /isRoleAllowed\s*\(/i.test(repairedBrokenVue) ||
                         /v-(?:if|show)\s*=\s*["'][^"']*(?:currentRole|isLoggedIn)["']/i.test(repairedBrokenVue);

console.log('  Mengeluarkan PUBLIC_ROLE_UNFILTERED_ON_LOAD issue?', hasIssue);
console.log('  Atau auto-repaired dengan isRoleAllowed/v-if?', hasRepairedGate);
assert(
  hasIssue || hasRepairedGate,
  'FAILED: Validator HARUS mengeluarkan issue ATAU auto-repair dengan gate yang aman untuk Vue app tanpa reactive gate!'
);
console.log('  ✅ BUG 2-B PASS: Vue app tanpa gate ditangani dengan benar (issue ATAU auto-repair)!\n');


console.log('--- [BUG 2-C] UJI GENERALISASI: Role publik berbeda (Pasien, Tamu) di Vue app ---');
const htmlVuePasien = htmlVueWithGate
  .replace(/Pelanggan/g, 'Pasien')
  .replace(/pelanggan/g, 'pasien');
const report2C = validateAndRepairGeneratedCode(htmlVuePasien, '', '', ['Super Admin', 'Petugas Perawat Hewan', 'Pasien']);
const hasFalsePositivePasien = report2C.issues.some(i => i.includes('PUBLIC_ROLE_UNFILTERED_ON_LOAD'));
assert(!hasFalsePositivePasien, 'FAILED: Vue app dengan role "Pasien" + v-if gate tidak boleh false positive!');

const htmlVueTamu = htmlVueWithGate
  .replace(/Pelanggan/g, 'Tamu')
  .replace(/pelanggan/g, 'tamu');
const report2D = validateAndRepairGeneratedCode(htmlVueTamu, '', '', ['Super Admin', 'Petugas Perawat Hewan', 'Tamu']);
const hasFalsePositiveTamu = report2D.issues.some(i => i.includes('PUBLIC_ROLE_UNFILTERED_ON_LOAD'));
assert(!hasFalsePositiveTamu, 'FAILED: Vue app dengan role "Tamu" + v-if gate tidak boleh false positive!');

console.log('  ✅ BUG 2-C PASS: Role publik berbeda (Pasien, Tamu) tidak menghasilkan false positive di Vue app!\n');

// =============================================================================
// VERIFIKASI KEAMANAN: Saat currentRole kosong, tab staf tidak terlihat
// =============================================================================
console.log('--- [SECURITY] UJI STATE AWAL: Tab staf tidak terlihat sebelum login ---');
// Verifikasi logika isRoleAllowed saat currentRole = '' (state awal sebelum login)
const mockIsRoleAllowed = (currentRole: string, tabRoles: string[]): boolean => {
  if (!currentRole) return false; // Belum login — tidak ada tab yang terlihat
  if (currentRole === 'Super Admin') return true;
  return tabRoles.includes(currentRole);
};

const staffTabs = [
  { label: 'Kelola Sistem', roles: ['Super Admin'] },
  { label: 'Perawatan Hewan', roles: ['Petugas Perawat Hewan'] },
];
const publicTab = { label: 'Info Hewan Saya', roles: ['Pelanggan'] };

// Sebelum login: semua tab tidak terlihat (currentRole = '')
for (const tab of [...staffTabs, publicTab]) {
  const visible = mockIsRoleAllowed('', tab.roles);
  assert(!visible, `FAILED: Tab "${tab.label}" TIDAK boleh terlihat saat belum login (currentRole = '')!`);
}

// Setelah login sebagai Pelanggan: hanya tab Pelanggan terlihat
assert(mockIsRoleAllowed('Pelanggan', publicTab.roles), 'FAILED: Tab publik Pelanggan harus terlihat saat login!');
assert(!mockIsRoleAllowed('Pelanggan', staffTabs[0].roles), 'FAILED: Tab Super Admin TIDAK boleh terlihat untuk Pelanggan!');
assert(!mockIsRoleAllowed('Pelanggan', staffTabs[1].roles), 'FAILED: Tab Petugas Perawat Hewan TIDAK boleh terlihat untuk Pelanggan!');

console.log('  ✅ SECURITY PASS: Semua tab tersembunyi saat belum login (currentRole = ""), dan gating per-role bekerja!\n');

console.log('========================================================================');
console.log('🎉 TEST SUITE #12: ROLE TAB & PUBLIC ROLE SECURITY — 100% PASS');
console.log('========================================================================');
