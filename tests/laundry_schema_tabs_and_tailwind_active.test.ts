import assert from 'assert';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('========================================================================');
console.log('🧪 TEST SUITE: SKEMA LAUNDRY TAB REPAIR & TAILWIND ACTIVE: VARIANT');
console.log('========================================================================\n');

// --------------------------------------------------------------------------
// TEST 1: Skema Laundry (Super Admin / Kasir Penerima / Staf Pencuci & Setrika)
// AI melewatkan tab "Staf Pencuci & Setrika" dan menyertakan class active:scale-95
// --------------------------------------------------------------------------
console.log('--- TEST 1: Skema Laundry dengan Missing Tab "Staf Pencuci & Setrika" & active:scale-95 ---');

const laundryHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Aplikasi Laundry Kiloan</title>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <style>
    .tab-btn { cursor: pointer; }
  </style>
</head>
<body class="bg-gray-50">
  <div id="app">
    <div id="loginScreen" v-show="!isLoggedIn" class="p-8 max-w-md mx-auto">
      <input type="text" id="loginUsername" v-model="loginForm.username" class="border p-2 w-full mb-2">
      <input type="password" id="loginPassword" v-model="loginForm.password" class="border p-2 w-full mb-2">
      <button @click="loginAs('Super Admin')" class="bg-blue-600 active:scale-95 active:bg-blue-700 disabled:opacity-50 text-white p-2 rounded">Login Admin</button>
    </div>

    <div id="appContainer" v-show="isLoggedIn" class="p-6">
      <div class="flex border-b mb-4">
        <button v-for="t in tabs" :key="t.id" v-show="isRoleAllowed(t.roles)" @click="showTab(t.id)" class="tab-btn px-4 py-2">
          {{ t.label }}
        </button>
      </div>

      <div v-show="activeTab === 'tab_dashboard'">Dashboard View</div>
      <div v-show="activeTab === 'tab_kasir'">Kasir Transaksi View</div>
    </div>
  </div>

  <script>
    const { createApp } = Vue;
    createApp({
      data() {
        return {
          isLoggedIn: false,
          currentRole: '',
          activeTab: 'tab_dashboard',
          loginForm: { username: '', password: '' },
          tablesConfig: {
            transaksi: { label: 'Transaksi', fields: [{ key: 'id', label: 'ID' }] }
          },
          tabs: [
            { id: 'tab_dashboard', label: 'Dashboard', roles: ['Super Admin'] },
            { id: 'tab_kasir', label: 'Kasir', roles: ['Kasir Penerima'] }
          ],
          db: { transaksi: [] }
        };
      },
      computed: {
        currentTableConfig() { return this.tablesConfig.transaksi; }
      },
      methods: {
        loginAs(role) {
          this.currentRole = role;
          this.isLoggedIn = true;
          this.showTab('tab_dashboard');
        },
        showTab(id) { this.activeTab = id; },
        isRoleAllowed(roles) {
          if (!roles || roles.includes('*')) return true;
          return roles.includes(this.currentRole);
        }
      }
    }).mount('#app');
  </script>
</body>
</html>`;

const laundryRoles = ['Super Admin', 'Kasir Penerima', 'Staf Pencuci & Setrika'];
const report1 = validateAndRepairGeneratedCode(laundryHtml, '', '', laundryRoles, 'Super Admin');

// A. Verifikasi deteksi awal tab missing
console.log('  Issues terdeteksi pada initial pass:', report1.issues);
const detectedMissingTab = report1.issues.some(i => i.includes('ROLE_MISSING_TAB_NAVIGATION'));
assert(detectedMissingTab, 'FAILED: Initial pass harus mendeteksi ROLE_MISSING_TAB_NAVIGATION');
console.log('  ✅ Deteksi awal tab missing berhasil');

// B. Verifikasi auto-repair menginjeksi tab & container
const repaired1 = report1.repairedCode.html;
const hasStafTab = repaired1.includes('tab_staf_pencuci_setrika');
assert(hasStafTab, 'FAILED: Tab Staf Pencuci & Setrika harus diinjeksi ke array tabs');
console.log('  ✅ Injeksi tab_staf_pencuci_setrika berhasil');

const hasStafLabel = repaired1.includes('Operasional Cuci & Setrika') || repaired1.includes('Staf Pencuci & Setrika');
assert(hasStafLabel, 'FAILED: Label operasional laundry harus ada');
console.log('  ✅ Label tab fungsional laundry berhasil');

// C. Verifikasi pembersihan variant Tailwind v2 yang tidak aktif
const hasActiveScale = repaired1.includes('active:scale-95');
const hasActiveBg = repaired1.includes('active:bg-blue-700');
const hasDisabled = repaired1.includes('disabled:opacity-50');
assert(!hasActiveScale, 'FAILED: active:scale-95 harus dibersihkan dari HTML');
assert(!hasActiveBg, 'FAILED: active:bg-blue-700 harus dibersihkan dari HTML');
assert(!hasDisabled, 'FAILED: disabled:opacity-50 harus dibersihkan dari HTML');
console.log('  ✅ Seluruh variant yang tidak aktif (active:*, disabled:*) berhasil dibersihkan');

// D. Verifikasi alternatif CSS :active diinjeksi ke <style>
const hasButtonActiveStyle = repaired1.includes('button:active');
assert(hasButtonActiveStyle, 'FAILED: Aturan button:active harus diinjeksi ke tag <style>');
console.log('  ✅ Aturan button:active berhasil diinjeksi ke tag <style>');

// E. Verifikasi Re-validasi hasil repair: lolos tanpa blocking issue
const recheck1 = validateAndRepairGeneratedCode(repaired1, '', '', laundryRoles, 'Super Admin');
console.log('  Issues setelah re-validasi hasil repair:', recheck1.issues);
assert(recheck1.isValid, 'FAILED: Hasil repairedCode harus valid 100% tanpa error blocking');
console.log('  ✅ Re-validasi repaired code lulus validasi (isValid === true, 0 issues)\n');

// --------------------------------------------------------------------------
// TEST 2: Multi-Role dengan Karakter Khusus Campuran (&, /, -, ())
// --------------------------------------------------------------------------
console.log('--- TEST 2: Multi-Role dengan Karakter Khusus Campuran (&, /, -, ()) ---');

const complexSpecialRoles = [
  'Super Admin',
  'Staf Gudang / Logistik',
  'Dokter (Umum) - Shift Malam',
  'Kasir & Tiketing'
];

const report2 = validateAndRepairGeneratedCode(laundryHtml, '', '', complexSpecialRoles, 'Super Admin');
const repaired2 = report2.repairedCode.html;

complexSpecialRoles.slice(1).forEach(r => {
  const roleId = r.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const injected = repaired2.includes(`tab_${roleId}`);
  console.log(`  Role [${r}] -> tab_${roleId} terinjeksi: ${injected}`);
  assert(injected, `FAILED: Tab untuk role ${r} (id: tab_${roleId}) harus terinjeksi`);
});

const recheck2 = validateAndRepairGeneratedCode(repaired2, '', '', complexSpecialRoles, 'Super Admin');
console.log('  Issues setelah re-validasi special characters:', recheck2.issues);
assert(recheck2.isValid, 'FAILED: Hasil repair role karakter khusus harus valid');
console.log('  ✅ Re-validasi karakter khusus lulus validasi penuh!\n');

console.log('========================================================================');
console.log('🎉 SEMUA PENGUJIAN SKEMA LAUNDRY & TAILWIND ACTIVE VARIANT LOLOS (PASS)!');
console.log('========================================================================');
