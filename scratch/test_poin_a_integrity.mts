import { validateAndRepairGeneratedCode, extractMissingHandlers, injectMissingHandlerStubs } from '../src/lib/codeValidator';

console.log('=== TEST POIN A: INTEGRITAS KODE & ELIMINASI STUB PALSU ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${msg}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${msg}`);
    process.exitCode = 1;
  }
}

// 1. Uji extractMissingHandlers
const sampleIssues = [
  'MISMATCH_HANDLER: Fungsi "bukaModalAntrian" dipanggil di onclick HTML tetapi TIDAK didefinisikan di dalam tag <script>',
  'MISMATCH_HANDLER: Fungsi "prosesPembayaran" dipanggil di onclick HTML tetapi TIDAK didefinisikan di dalam tag <script>',
  'SYNTAX_ERROR: Unexpected token',
  'ROLE_GATING: Tab belum diproteksi'
];

const extracted = extractMissingHandlers(sampleIssues);
assert(
  extracted.length === 2 && extracted.includes('bukaModalAntrian') && extracted.includes('prosesPembayaran'),
  `extractMissingHandlers mengekstrak 2 fungsi tepat: ${JSON.stringify(extracted)}`
);

// 2. Uji injectMissingHandlerStubs tidak lagi menyuntikkan stub palsu
const rawHtml = `<!DOCTYPE html>
<html>
<head><title>App</title></head>
<body>
  <button onclick="bukaModalAntrian()">Antrian</button>
  <script>
    console.log('init');
  </script>
</body>
</html>`;

const stubbedResult = injectMissingHandlerStubs(rawHtml, sampleIssues);
assert(
  stubbedResult === rawHtml,
  'injectMissingHandlerStubs mengembalikan HTML asli tanpa modifikasi/stub diam-diam'
);
assert(
  !stubbedResult.includes('// --- AUTO-PATCH SELF-HEALING HANDLERS ---'),
  'injectMissingHandlerStubs TIDAK mengandung auto-patch stub palsu'
);

// 3. Uji validasi kode dengan missing handler
const res = validateAndRepairGeneratedCode(rawHtml, '', '', ['Admin', 'Kasir']);
const missingInRes = extractMissingHandlers(res.issues);
assert(
  missingInRes.length === 1 && missingInRes[0] === 'bukaModalAntrian',
  `Validator mendeteksi bukaModalAntrian sebagai missing handler: ${JSON.stringify(missingInRes)}`
);
assert(
  res.isValid === false,
  'Hasil validasi kode dengan missing handler tetap isValid: false (tidak dipalsukan jadi true)'
);

// 4. Simulasi pesan peringatan jujur ke user
const partialWarningFunctions = ['bukaModalAntrian', 'prosesPembayaran'];
const fnList = partialWarningFunctions.map(fn => '`' + fn + '()`').join(', ');
const firstFn = partialWarningFunctions[0];
const honestWarning = `\n\n> ⚠️ **Catatan Integritas Prototipe:**\n> Prototipe berhasil dimuat, namun sistem mendeteksi **${partialWarningFunctions.length} tombol/aksi yang belum sepenuhnya terhubung**: ${fnList}.\n> Tombol-tombol ini mungkin tidak merespons saat diklik. Untuk memperbaikinya, ketik misalnya **"perbaiki fungsi ${firstFn}"** atau **"generate ulang prototipe"**.`;

assert(
  honestWarning.includes('`bukaModalAntrian()`') && honestWarning.includes('`prosesPembayaran()`'),
  'Pesan peringatan jujur menyebutkan nama-nama fungsi yang belum terhubung'
);
assert(
  honestWarning.includes('2 tombol/aksi yang belum sepenuhnya terhubung'),
  'Pesan peringatan mencantumkan jumlah tombol yang terdeteksi tidak lengkap'
);

console.log(`\nHasil: ${passedTests}/${totalTests} pengujian berhasil.`);
