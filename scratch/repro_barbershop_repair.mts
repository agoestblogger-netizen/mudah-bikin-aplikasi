import { validateAndRepairGeneratedCode, extractMissingHandlers } from '../src/lib/codeValidator.js';

console.log('=== REPRODUKSI BUG: TARGETED REPAIR SYNTAX_ERROR & ROLE_CONTAMINATION ===\n');

const officialRoles = ['Super Admin', 'Barber', 'Kasir', 'Pelanggan'];

// 1. Simulasi kode awal dari primary call yang memiliki onclick handler yang belum didefinisikan
const originalHtml = `
<!DOCTYPE html>
<html>
<head><title>Aplikasi Barbershop</title></head>
<body>
  <div class="nav-tabs">
    <button class="tab-btn active" data-access-roles="Super Admin">Admin</button>
    <button class="tab-btn" data-access-roles="Barber">Barber</button>
    <button class="tab-btn" data-access-roles="Kasir">Kasir</button>
    <button class="tab-btn" data-access-roles="Pelanggan">Pelanggan</button>
  </div>
  <div id="loginSection">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Login</button>
  </div>
  <div id="content">
    <button onclick="tambahKaryawan()">Tambah Karyawan</button>
  </div>
  <script>
    const demoAccounts = [
      { user: 'admin', pass: 'admin123', role: 'Super Admin' },
      { user: 'barber1', pass: 'barber123', role: 'Barber' },
      { user: 'kasir1', pass: 'kasir123', role: 'Kasir' },
      { user: 'customer', pass: 'cust123', role: 'Pelanggan' }
    ];
    function filterTabsByRole(role) { console.log(role); }
    function handleLogin() { loginAs('Super Admin'); }
    function loginAs(role) { filterTabsByRole(role); }
    filterTabsByRole('Pelanggan');
  </script>
</body>
</html>
`;

console.log('1. Validasi Kode Asal:');
const initialValidation = validateAndRepairGeneratedCode(originalHtml, '', '', officialRoles);
console.log('   Status:', initialValidation.isValid ? 'VALID' : 'INVALID');
console.log('   Issues:', initialValidation.issues);
const missingHandlers = extractMissingHandlers(initialValidation.issues);
console.log('   Missing Handlers:', missingHandlers);

// 2. Simulasi output dari targeted repair LLM tanpa konteks role dan membungkus dengan <script> tag
// Contoh respons LLM aktual saat diminta "cukup tulis blok <script>...":
const simulatedAiOutput1 = `\`\`\`html
<script>
function tambahKaryawan() {
  const newStaff = { name: 'Karyawan Baru', role: 'Staff' };
  alert('Staff ditambahkan');
}
</script>
\`\`\``;

console.log('\n2. Simulasi Pembersihan & Injeksi seperti di route.ts lama:');
let injectedJs = simulatedAiOutput1;
const jsBlockMatch = simulatedAiOutput1.match(/```(?:javascript|js)?([\s\S]*?)```/);
if (jsBlockMatch) injectedJs = jsBlockMatch[1];
else injectedJs = simulatedAiOutput1.replace(/```[\s\S]*?```/g, '').trim();

console.log('   Hasil parsing regex injectedJs:\n---');
console.log(injectedJs);
console.log('---');

// Injeksi ke HTML sebelum </script> terakhir persis seperti baris 2364 route.ts
const insertPos = originalHtml.lastIndexOf('</script>');
const corruptedHtml = originalHtml.slice(0, insertPos) + '\n' + injectedJs.trim() + '\n' + originalHtml.slice(insertPos);

console.log('\n3. Validasi Kode Pasca Injeksi Targeted Repair:');
const postRepairValidation = validateAndRepairGeneratedCode(corruptedHtml, '', '', officialRoles);
console.log('   Status:', postRepairValidation.isValid ? 'VALID' : 'INVALID');
console.log('   Issues Terdeteksi:');
for (const issue of postRepairValidation.issues) {
  console.log('     -', issue);
}

// Periksa kondisi branching lama:
const conditionEvaluated = postRepairValidation.isValid || extractMissingHandlers(postRepairValidation.issues).length < missingHandlers.length;
console.log('\n4. Evaluasi Kondisi route.ts Lama:');
console.log('   reValidated.isValid:', postRepairValidation.isValid);
console.log('   missingHandlers lama:', missingHandlers.length);
console.log('   missingHandlers baru:', extractMissingHandlers(postRepairValidation.issues).length);
console.log('   Apakah targetedRepairSuccess dianggap TRUE oleh kode lama?:', conditionEvaluated ? '❌ YA (BUG!)' : 'TIDAK');
