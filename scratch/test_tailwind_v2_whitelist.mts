import assert from 'assert';
import { checkTailwindV2Syntax, validateAndRepairGeneratedCode, extractTailwindV2Violations } from '../src/lib/codeValidator';

console.log('================================================================');
console.log('🧪 TEST POIN 1: TAILWIND V2 WHITELIST VALIDATOR & NEGATIVE TEST');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Subtest 1: Uji Negatif Wajib (Memuat utility v3+ di luar 5 contoh lama & arbitrary value)
// - Class v3+ di luar daftar lama: 'snap-x' dan 'columns-3'
// - Arbitrary value: 'w-[350px]'
// -----------------------------------------------------------------------------
console.log('[Subtest 1] Uji Negatif: HTML dengan class v3+ (snap-x, columns-3) & arbitrary value (w-[350px])');

const htmlWithForbiddenClasses = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body>
  <div id="app" class="p-4 bg-white rounded-lg snap-x w-[350px]">
    <div class="columns-3 text-gray-800">
      <p class="font-bold">Test Konten</p>
    </div>
  </div>
  <script>
    const app = Vue.createApp({ data() { return {}; } });
    app.mount('#app');
  </script>
</body>
</html>`;

const directReport = checkTailwindV2Syntax(htmlWithForbiddenClasses);
console.log('  Direct checkTailwindV2Syntax result:');
console.log('  - Invalid classes:', directReport.invalidClasses);
console.log('  - Warnings:', directReport.warnings);

assert(directReport.invalidClasses.includes('snap-x'), 'FAILED: snap-x harus ditangkap sebagai kelas tidak terdaftar di whitelist v2!');
assert(directReport.invalidClasses.includes('columns-3'), 'FAILED: columns-3 harus ditangkap sebagai kelas tidak terdaftar di whitelist v2!');
assert(directReport.invalidClasses.includes('w-[350px]'), 'FAILED: w-[350px] harus ditangkap sebagai arbitrary value!');
console.log('  ✅ Subtest 1a: Direct checkTailwindV2Syntax sukses menangkap snap-x, columns-3, dan w-[350px]!');

// Test integrasi ke validateAndRepairGeneratedCode:
const fullValidation = validateAndRepairGeneratedCode(htmlWithForbiddenClasses, '', '', ['Super Admin']);
const twViolations = extractTailwindV2Violations(fullValidation.issues);
console.log('  Pipeline validateAndRepairGeneratedCode issues count:', twViolations.length);
console.log('  - Issues:', twViolations);

assert(fullValidation.isValid === false, 'FAILED: HTML dengan pelanggaran Tailwind v2 tidak boleh lolos isValid=true!');
assert(twViolations.some(i => i.includes('snap-x')), 'FAILED: snap-x harus ada di issues pipeline!');
assert(twViolations.some(i => i.includes('w-[350px]')), 'FAILED: w-[350px] harus ada di issues pipeline!');
console.log('  ✅ Subtest 1b: Integrasi pipeline berhasil menolak kode dan melaporkan issue Tailwind v2!\n');

// -----------------------------------------------------------------------------
// Subtest 2: Uji Positif (HTML dengan class Tailwind v2 resmi 100% valid + FontAwesome)
// -----------------------------------------------------------------------------
console.log('[Subtest 2] Uji Positif: HTML murni utility Tailwind v2 + FontAwesome + tab-btn');

const htmlValidV2 = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
</head>
<body class="bg-gray-100 text-gray-900 font-sans p-4">
  <div id="app" class="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
    <div class="flex items-center justify-between border-b pb-4 mb-4">
      <h1 class="text-xl font-bold text-blue-600 flex items-center gap-2">
        <i class="fas fa-car"></i> Kursus Menyetir
      </h1>
      <button class="tab-btn px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition">
        Tab Utama
      </button>
    </div>
    <p class="text-sm text-gray-500">Semua utility di atas ada di stylesheet Tailwind v2.2.19.</p>
  </div>
  <script>
    const app = Vue.createApp({ data() { return {}; } });
    app.mount('#app');
  </script>
</body>
</html>`;

const validReport = checkTailwindV2Syntax(htmlValidV2);
console.log('  Direct checkTailwindV2Syntax result on valid code:');
console.log('  - Invalid classes count:', validReport.invalidClasses.length);
console.log('  - Warnings count:', validReport.warnings.length);

assert.strictEqual(validReport.invalidClasses.length, 0, 'FAILED: Valid v2 classes tidak boleh ditandai invalid!');
assert.strictEqual(validReport.warnings.length, 0, 'FAILED: Valid v2 classes tidak boleh menghasilkan warning!');
console.log('  ✅ Subtest 2: HTML valid Tailwind v2 100% bersih tanpa warning!\n');

console.log('================================================================');
console.log('🎉 SEMUA SUBTEST TAILWIND V2 WHITELIST: PASS (100%)');
console.log('================================================================');
