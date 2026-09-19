import assert from 'assert';
import {
  validateAndRepairGeneratedCode,
  stripDuplicateMixinMethodsFromVue,
  repairVueTabAndTableAlignment,
  PILAR1_SCAFFOLD_METHODS
} from '../src/lib/codeValidator';

console.log('========================================================================');
console.log('🧪 TEST SUITE: 3 CRITICAL BUG FIXES (TAB ALIGN, ID GEN, MIXIN DEDUP)');
console.log('========================================================================\n');

// --------------------------------------------------------------------------
// TEST 1: Penyelarasan ID Tab vs Kunci Tabel (Opsi A)
// --------------------------------------------------------------------------
console.log('--- TEST 1: Penyelarasan ID Tab vs Kunci Tabel & Landing Tab (Bug 1) ---');

const buggyRoleTabsHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body>
  <div id="app">
    <nav>
      <button v-for="tab in tabs" :key="tab.id" @click="showTab(tab.id)">{{ tab.label }}</button>
    </nav>
    <div v-for="(cfg, tblKey) in tablesConfig" :key="tblKey" v-show="activeTab === tblKey">
      <h2>{{ cfg.label }}</h2>
    </div>
    <div v-for="(vCfg, vKey) in viewsConfig" :key="vKey" v-show="activeTab === 'view_' + vKey">
      <h2>{{ vCfg.label }}</h2>
    </div>
  </div>
  <script>
    Vue.createApp({
      data() {
        return {
          activeTab: 'superadmin',
          tabs: [
            { id: 'superadmin', label: 'Super Admin', roles: ['Super Admin'] },
            { id: 'petugaspenyewaansepeda', label: 'Petugas Rental', roles: ['Petugas Penyewaan Sepeda'] }
          ],
          demoAccounts: [
            { role: 'Super Admin', username: 'superadmin', password: '123', landingTab: 'superadmin' },
            { role: 'Petugas Penyewaan Sepeda', username: 'petugas', password: '123', landingTab: 'petugaspenyewaansepeda' }
          ],
          tablesConfig: {
            katalog_sepeda: { label: 'Katalog Sepeda', allowRoles: ['Super Admin', 'Petugas Penyewaan Sepeda'], fields: [] },
            pelanggan: { label: 'Pelanggan', allowRoles: ['Super Admin'], fields: [] },
            transaksi_sewa: { label: 'Transaksi Sewa', allowRoles: ['Super Admin', 'Petugas Penyewaan Sepeda'], fields: [] }
          },
          viewsConfig: {
            laporan_harian: { label: 'Laporan Harian', allowRoles: ['Super Admin'] }
          },
          db: { katalog_sepeda: [], pelanggan: [], transaksi_sewa: [] }
        };
      }
    }).mount('#app');
  </script>
</body>
</html>`;

const report1 = validateAndRepairGeneratedCode(buggyRoleTabsHtml, 'Rental Sepeda', '', ['Super Admin', 'Petugas Penyewaan Sepeda'], 'Super Admin');
const repairedHtml1 = report1.repairedCode.html;

// 1. Kondisi v-show kontainer tabel harus diperluas agar cocok
assert(
  repairedHtml1.includes('v-show="activeTab === tblKey || activeTab === \'tab_\' + tblKey"'),
  'FAILED: v-show tabel harus mendukung tblKey maupun tab_ + tblKey!'
);
console.log('  ✅ 1a. v-show kontainer tabel berhasil diselaraskan');

// 2. Kondisi v-show kontainer views
assert(
  repairedHtml1.includes('v-show="activeTab === vKey || activeTab === \'view_\' + vKey"'),
  'FAILED: v-show views harus mendukung vKey maupun view_ + vKey!'
);
console.log('  ✅ 1b. v-show kontainer views berhasil diselaraskan');

// 3. Tabs harus dibangun ulang dari tablesConfig dan viewsConfig
assert(
  repairedHtml1.includes('"id": "katalog_sepeda"') || repairedHtml1.includes("'katalog_sepeda'"),
  'FAILED: Tabs harus memuat katalog_sepeda!'
);
assert(
  repairedHtml1.includes('"id": "transaksi_sewa"') || repairedHtml1.includes("'transaksi_sewa'"),
  'FAILED: Tabs harus memuat transaksi_sewa!'
);
assert(
  !repairedHtml1.includes('id: "superadmin"') && !repairedHtml1.includes('id: \'superadmin\''),
  'FAILED: Tabs tidak boleh lagi menggunakan nama role superadmin!'
);
console.log('  ✅ 1c. Tabs berhasil di-rebuild berbasis kunci tabel & views (bukan nama peran)');

// 4. demoAccounts landingTab harus mengarah ke tabel operasional
assert(
  !repairedHtml1.includes("landingTab: 'superadmin'") && !repairedHtml1.includes('landingTab: "superadmin"'),
  'FAILED: landingTab Super Admin tidak boleh nama peran!'
);
assert(
  !repairedHtml1.includes("landingTab: 'petugaspenyewaansepeda'") && !repairedHtml1.includes('landingTab: "petugaspenyewaansepeda"'),
  'FAILED: landingTab Petugas tidak boleh nama peran!'
);
console.log('  ✅ 1d. landingTab akun demo berhasil dialihkan ke tabel operasional nyata\n');

// --------------------------------------------------------------------------
// TEST 2: Pembersihan ID Generator Rusak (Regresi MALFORMED_STRING_GUARD)
// --------------------------------------------------------------------------
console.log('--- TEST 2: Pembersihan ID Generator Rusak & Anti-Stuttering (Bug 2) ---');

const htmlWithCorruptedId = `<!DOCTYPE html>
<html>
<body>
  <div id="app"></div>
  <script>
    Vue.createApp({
      methods: {
        saveItem() {
          const newId = 'ID-' + Math.random().toMath.random().toMath.random().toString(36).substring(2, 9);
          const otherId = 'TRX-' + String(36).substr(2, 9);
          console.log(newId, otherId);
        }
      }
    }).mount('#app');
  </script>
</body>
</html>`;

const report2 = validateAndRepairGeneratedCode(htmlWithCorruptedId, '', '');
const repairedHtml2 = report2.repairedCode.html;

assert(
  !repairedHtml2.includes('.toMath'),
  'FAILED: Tidak boleh ada Math.random().toMath yang tersisa!'
);
assert(
  repairedHtml2.includes('Math.random().toString(36).substring(2, 9)'),
  'FAILED: newId harus dinormalisasi menjadi Math.random().toString(36).substring(2, 9)!'
);
console.log('  ✅ 2a. Math.random().toMath.random().toMath.random()... berhasil dinormalisasi');

// Uji kestabilan/idempotensi: jalankan validasi ulang terhadap hasil perbaikan
const report2Recheck = validateAndRepairGeneratedCode(repairedHtml2, '', '');
const recheckHtml = report2Recheck.repairedCode.html;
assert(
  !recheckHtml.includes('.toMath'),
  'FAILED: Validasi ulang (recheck) tidak boleh memunculkan kembali .toMath!'
);
assert(
  recheckHtml.includes('Math.random().toString(36).substring(2, 9)'),
  'FAILED: Validasi ulang harus tetap mempertahankan ekspresi ID yang bersih!'
);
console.log('  ✅ 2b. Auto-repair ID generator 100% stabil dan idempotent tanpa stuttering\n');

// --------------------------------------------------------------------------
// TEST 3: Method Komponen Menimpa Mixin (Bug 3)
// --------------------------------------------------------------------------
console.log('--- TEST 3: Stripping Duplikat Method Komponen vs Pilar1VueScaffoldMixin (Bug 3) ---');

const jsWithDuplicateMethods = `
Vue.createApp({
  data() {
    return { count: 0 };
  },
  methods: {
    resolveRelationDisplay(targetTable, id) {
      return this.db[targetTable].find(r => r.id === id); // Versi lokal primitif tanpa compositeFields
    },
    computeFormulaValue(form, fld) {
      return 0; // Versi lokal placeholder selalu 0
    },
    handleLogin() {
      console.log('login lokal');
    },
    showToast(msg) {
      alert(msg);
    },
    openCreate(tblKey) {
      this.modal.isOpen = true;
    },
    saveItem(tblKey) {
      this.db[tblKey].push({ id: '1' });
    }
  }
}).mount('#app');
`;

const strippedJs = stripDuplicateMixinMethodsFromVue(jsWithDuplicateMethods);

// Pastikan method yang ada di PILAR1_SCAFFOLD_METHODS dibuang dari komponen
assert(
  !strippedJs.includes('resolveRelationDisplay(targetTable, id)'),
  'FAILED: resolveRelationDisplay harus dibuang dari methods komponen agar mixin berlaku!'
);
assert(
  !strippedJs.includes('computeFormulaValue(form, fld)'),
  'FAILED: computeFormulaValue harus dibuang dari methods komponen agar mixin berlaku!'
);
assert(
  !strippedJs.includes('handleLogin()'),
  'FAILED: handleLogin harus dibuang dari methods komponen agar mixin berlaku!'
);
assert(
  !strippedJs.includes('showToast(msg)'),
  'FAILED: showToast harus dibuang dari methods komponen agar mixin berlaku!'
);
console.log('  ✅ 3a. Duplikat method mixin berhasil dibersihkan dari methods komponen');

// Pastikan method kustom spesifik CRUD tetap utuh
assert(
  strippedJs.includes('openCreate(tblKey)'),
  'FAILED: openCreate harus tetap dipertahankan di methods komponen!'
);
assert(
  strippedJs.includes('saveItem(tblKey)'),
  'FAILED: saveItem harus tetap dipertahankan di methods komponen!'
);
console.log('  ✅ 3b. Method spesifik aplikasi (openCreate, saveItem) tetap terjaga 100%');

// Pastikan kode JS hasil strip tetap valid AST sintaksnya
const fullHtmlWithDuplicates = `<!DOCTYPE html>
<html>
<body>
  <div id="app"></div>
  <script>${jsWithDuplicateMethods}</script>
</body>
</html>`;

const report3 = validateAndRepairGeneratedCode(fullHtmlWithDuplicates, '', '');
assert(
  report3.isValid || !report3.issues.some(i => i.includes('SYNTAX_ERROR')),
  'FAILED: Kode hasil strip tidak boleh memicu SYNTAX_ERROR!'
);
console.log('  ✅ 3c. Kode hasil perbaikan mixin lolos validasi AST Acorn tanpa syntax error\n');

console.log('========================================================================');
console.log('🎉 ALL 3 CRITICAL BUG FIX TESTS PASSED SUCCESSFULLY!');
console.log('========================================================================');
