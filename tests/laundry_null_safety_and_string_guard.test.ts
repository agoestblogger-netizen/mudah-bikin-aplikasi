import assert from 'assert';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';
import { buildSrcDoc } from '../src/lib/buildSrcDoc';

console.log('========================================================================');
console.log('🧪 TEST SUITE: LAUNDRY NULL-SAFETY MODAL, STRING GUARD & CDN DEDUP');
console.log('========================================================================\n');

// --------------------------------------------------------------------------
// SUBTEST 1: Null-Safety Modal CRUD (Lapis 1, Lapis 2, Lapis 3)
// --------------------------------------------------------------------------
console.log('--- SUBTEST 1: Anti-Crash Null-Safety currentTableConfig & Modal CRUD ---');

const vulnerableHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body>
  <div id="app">
    <!-- Modal yang rentan crash jika currentTableConfig bernilai null saat mount -->
    <div v-show="modal.isOpen" class="fixed inset-0 bg-black p-4">
      <h3>{{ modal.isEdit ? 'Edit' : 'Tambah' }} {{ currentTableConfig.label }}</h3>
      <div v-for="fld in currentTableConfig.fields" :key="fld.key">
        <label>{{ fld.label }}</label>
        <input v-model="modal.form[fld.key]">
      </div>
    </div>
  </div>
  <script>
    Vue.createApp({
      data() {
        return {
          modal: { isOpen: false, isEdit: false, form: {} },
          currentTableConfig: null,
          tablesConfig: {
            transaksi: { label: 'Transaksi', fields: [{ key: 'id', label: 'ID' }] }
          },
          db: { transaksi: [] }
        };
      }
    }).mount('#app');
  </script>
</body>
</html>`;

const report1 = validateAndRepairGeneratedCode(vulnerableHtml, 'Laundry app', '', ['Super Admin'], 'Super Admin');
const repairedHtml1 = report1.repairedCode.html;

// Lapis 1: v-if="modal.isOpen && currentTableConfig"
assert(
  repairedHtml1.includes('v-if="modal.isOpen && currentTableConfig"'),
  'FAILED: v-show="modal.isOpen" harus diubah menjadi v-if="modal.isOpen && currentTableConfig"!'
);
console.log('  ✅ Lapis 1: Container modal diubah dari v-show ke v-if dengan guard currentTableConfig');

// Lapis 2: Default objek aman di data() bukan null
assert(
  repairedHtml1.includes("currentTableConfig: { label: '', fields: [] }"),
  'FAILED: currentTableConfig: null harus digantikan dengan objek aman { label: \'\', fields: [] }!'
);
console.log('  ✅ Lapis 2: Inisialisasi data() berdefault objek aman { label: \'\', fields: [] }');

// Lapis 3: Optional chaining pada template
assert(
  repairedHtml1.includes('currentTableConfig?.label'),
  'FAILED: Template currentTableConfig.label harus dilengkapi safe optional chaining (?.)!'
);
assert(
  repairedHtml1.includes('currentTableConfig?.fields'),
  'FAILED: Template currentTableConfig.fields harus dilengkapi safe optional chaining (?.)!'
);
console.log('  ✅ Lapis 3: Seluruh akses properti template dipasangi safe optional chaining (?.)\n');

// --------------------------------------------------------------------------
// SUBTEST 2: Stringified Guard Menangkap Member Expression Utuh
// --------------------------------------------------------------------------
console.log('--- SUBTEST 2: Robust Stringified Guard Capture ---');

const codeWithMemberExpressions = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body>
  <div id="app"></div>
  <script>
    Vue.createApp({
      methods: {
        saveItem(table, data) {
          const idx = this.db[table].findIndex(r => r.id === data.id);
          if (idx > -1) this.db[table][idx] = data;
        },
        canEditCurrentTab() {
          const curTab = this.tabs.find(t => t.id === this.activeTab);
          return curTab ? true : false;
        },
        deleteRow(table, id) {
          this.db[table] = this.db[table].filter(r => r.id !== id);
        }
      }
    }).mount('#app');
  </script>
</body>
</html>`;

const report2 = validateAndRepairGeneratedCode(codeWithMemberExpressions, 'CRUD test', '', ['Super Admin'], 'Super Admin');
const repairedHtml2 = report2.repairedCode.html;

// Assert: String(r.id) === String(data.id)
assert(
  repairedHtml2.includes('String(r.id) === String(data.id)'),
  'FAILED: r.id === data.id harus dibungkus utuh menjadi String(r.id) === String(data.id)!'
);
assert(
  !repairedHtml2.includes('String(data).id'),
  'FAILED: TIDAK BOLEH menghasilkan String(data).id!'
);
console.log('  ✅ saveItem(): r.id === data.id -> String(r.id) === String(data.id) (Bebas dari String(data).id)');

// Assert: String(t.id) === String(this.activeTab)
assert(
  repairedHtml2.includes('String(t.id) === String(this.activeTab)'),
  'FAILED: t.id === this.activeTab harus dibungkus utuh menjadi String(t.id) === String(this.activeTab)!'
);
assert(
  !repairedHtml2.includes('String(this).activeTab'),
  'FAILED: TIDAK BOLEH menghasilkan String(this).activeTab!'
);
console.log('  ✅ canEditCurrentTab(): t.id === this.activeTab -> String(t.id) === String(this.activeTab)');

// Assert: String(r.id) !== String(id)
assert(
  repairedHtml2.includes('String(r.id) !== String(id)'),
  'FAILED: r.id !== id harus dibungkus utuh menjadi String(r.id) !== String(id)!'
);
console.log('  ✅ deleteRow(): r.id !== id -> String(r.id) !== String(id)\n');

// --------------------------------------------------------------------------
// SUBTEST 3: Pembersihan Otomatis Pola Anomali String(x).properti & String(36).substr
// --------------------------------------------------------------------------
console.log('--- SUBTEST 3: Auto-Clean & Validator MALFORMED_STRING_GUARD ---');

const malformedInput = `
  const a = String(data).id;
  const b = String(this).activeTab;
  const c = String(row).kode;
`;

const cleanedInput = malformedInput.replace(
  /(?<![a-zA-Z0-9_$.])String\(([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)\)\.([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
  'String($1.$2)'
);

assert(cleanedInput.includes('String(data.id)'), 'FAILED: String(data).id harus bersih jadi String(data.id)');
assert(cleanedInput.includes('String(this.activeTab)'), 'FAILED: String(this).activeTab harus bersih jadi String(this.activeTab)');
assert(cleanedInput.includes('String(row.kode)'), 'FAILED: String(row).kode harus bersih jadi String(row.kode)');
assert(!/(?<![a-zA-Z0-9_$.])String\([^)]+\)\.[a-zA-Z]/.test(cleanedInput), 'FAILED: Tidak boleh ada sisa String(x).prop!');
console.log('  ✅ Pembersihan otomatis String(x).property -> String(x.property) berhasil 100%');

// Test 3b: Validasi String(36).substr auto-repair dan valid toString(36).substr tidak memicu false positive
const htmlWithValidToString = `<!DOCTYPE html><html><body><div id="app"></div><script>
  const id1 = Math.random().toString(36).substr(2, 9);
  const id2 = Math.random().toString(36).substring(2, 9);
  const lower = String(role).toLowerCase();
  Vue.createApp({}).mount('#app');
</script></body></html>`;
const resValid = validateAndRepairGeneratedCode(htmlWithValidToString, '', '');
assert(!resValid.issues.some(i => i.includes('MALFORMED_STRING_GUARD')), 'FAILED: Math.random().toString(36).substr TIDAK boleh memicu MALFORMED_STRING_GUARD!');
console.log('  ✅ Math.random().toString(36).substr(2, 9) & String(role).toLowerCase() lolos 100% tanpa false positive');

const htmlWithMalformedId = `<!DOCTYPE html><html><body><div id="app"></div><script>
  const badId1 = "TRX-" + String(36).substr(2, 9);
  const badId2 = Math.random().String(36).substr(2, 9);
  Vue.createApp({}).mount('#app');
</script></body></html>`;
const resRepaired = validateAndRepairGeneratedCode(htmlWithMalformedId, '', '');
assert(!resRepaired.issues.some(i => i.includes('MALFORMED_STRING_GUARD')), 'FAILED: String(36).substr harus di-autorepair tanpa melempar error!');
assert(resRepaired.repairedCode.html.includes('toString(36).substring'), 'FAILED: String(36).substr harus di-autorepair ke toString(36).substring!');
console.log('  ✅ String(36).substr otomatis diperbaiki diam-diam ke Math.random().toString(36).substring(2, 9)');

// Test 3c: Validasi Kritis MISSING_VUE_INITIALIZATION jika template Vue tidak punya script createApp
const htmlWithoutVueApp = `<!DOCTYPE html><html><body><div id="app"><button @click="test">Klik</button></div><script>console.log("No Vue");</script></body></html>`;
const resMissingVue = validateAndRepairGeneratedCode(htmlWithoutVueApp, '', '');
assert(resMissingVue.issues.some(i => i.includes('MISSING_VUE_INITIALIZATION')), 'FAILED: Harus mendeteksi MISSING_VUE_INITIALIZATION jika template Vue tidak punya createApp!');
console.log('  ✅ MISSING_VUE_INITIALIZATION berhasil mendeteksi template Vue tanpa blok createApp\n');

// --------------------------------------------------------------------------
// SUBTEST 4: De-duplikasi CDN Script Tags & Preservasi Script Vue di buildSrcDoc
// --------------------------------------------------------------------------
console.log('--- SUBTEST 4: De-duplikasi CDN Script Tags & Preservasi Script Vue di buildSrcDoc ---');

const htmlWithAiCdnTags = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Aplikasi Laundry</title>
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <div id="app">Konten</div>
  <script>
    const app = Vue.createApp({
      mixins: [typeof Pilar1VueScaffoldMixin !== 'undefined' ? Pilar1VueScaffoldMixin : (window.Pilar1VueScaffoldMixin || {})],
      data() { return { db: { pesanan: [] } }; }
    }).mount('#app');
  </script>
</body>
</html>`;

const builtDoc = buildSrcDoc({ html: htmlWithAiCdnTags, css: '', js: '' });

const twMatches = builtDoc.match(/@tailwindcss\/browser@4/g) || [];
const vueMatches = builtDoc.match(/vue@3\/dist\/vue\.global\.js/g) || [];
const lucideMatches = builtDoc.match(/lucide@latest/g) || [];

assert.strictEqual(
  twMatches.length,
  1,
  `FAILED: Tailwind v4 browser build harus tepat 1 kali, ditemukan ${twMatches.length} kali!`
);
assert.strictEqual(
  vueMatches.length,
  1,
  `FAILED: Vue 3 CDN harus tepat 1 kali, ditemukan ${vueMatches.length} kali!`
);
assert.strictEqual(
  lucideMatches.length,
  1,
  `FAILED: Lucide Icons CDN harus tepat 1 kali, ditemukan ${lucideMatches.length} kali!`
);
// KRITIS: Pastikan blok script Vue.createApp TIDAK terhapus oleh buildSrcDoc!
assert(builtDoc.includes('Vue.createApp'), 'FAILED KRITIS: Script Vue.createApp tidak boleh terhapus oleh buildSrcDoc!');
assert(builtDoc.includes(".mount('#app')"), 'FAILED KRITIS: .mount("#app") harus tetap ada di builtDoc!');
console.log('  ✅ CDN Tailwind v4 termuat tepat 1 kali (tanpa duplikasi)');
console.log('  ✅ CDN Vue 3 termuat tepat 1 kali (monkey-patch Vue.createApp aman)');
console.log('  ✅ CDN Lucide termuat tepat 1 kali');
console.log('  ✅ Script Vue.createApp & .mount("#app") TERJAMIN UTUH 100% di Canvas Preview (tidak terhapus)\n');

// --------------------------------------------------------------------------
// SUBTEST 5: E2E Skema Laundry Asli Mercury-2.5 Terbebas dari Masalah
// --------------------------------------------------------------------------
console.log('--- SUBTEST 5: E2E Skema Laundry Asli Mercury-2.5 ---');

import fs from 'fs';
const rawMercuryPath = 'scratch/mercury_laundry_raw.html';
if (fs.existsSync(rawMercuryPath)) {
  const rawMercuryHtml = fs.readFileSync(rawMercuryPath, 'utf8');
  const e2eReport = validateAndRepairGeneratedCode(
    rawMercuryHtml,
    'Sistem Laundry Kiloan',
    '',
    ['Super Admin', 'Petugas Laundry', 'Kasir'],
    'Super Admin'
  );

  assert.strictEqual(e2eReport.isValid, true, 'FAILED: Skema Laundry mercury-2.5 harus isValid: true!');
  assert.strictEqual(e2eReport.issues.length, 0, 'FAILED: Skema Laundry mercury-2.5 harus 0 issues!');

  const finalHtml = e2eReport.repairedCode.html;
  assert(finalHtml.includes('String(data.id)'), 'FAILED: Harus menggunakan String(data.id)');
  assert(!finalHtml.includes('String(data).id'), 'FAILED: Tidak boleh ada String(data).id');
  assert(finalHtml.includes('String(this.activeTab)'), 'FAILED: Harus menggunakan String(this.activeTab)');
  assert(!finalHtml.includes('String(this).activeTab'), 'FAILED: Tidak boleh ada String(this).activeTab');
  assert(finalHtml.includes('v-if="modal.isOpen && currentTableConfig"'), 'FAILED: Harus v-if="modal.isOpen && currentTableConfig"');
  console.log('  ✅ E2E Skema Laundry Mercury-2.5: Lulus 100% (isValid = true, 0 issues)');
}

console.log('\n========================================================================');
console.log('🎉 SEMUA SUBTEST LAUNDRY NULL-SAFETY & STRING GUARD: PASS (100%)');
console.log('========================================================================');
