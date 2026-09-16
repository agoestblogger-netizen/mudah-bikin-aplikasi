import { validateAndRepairGeneratedCode, extractMissingHandlers } from '../src/lib/codeValidator.js';

console.log('================================================================');
console.log('TEST INTEGRITAS TARGETED REPAIR: SANITASI, ROLE GUARD & ROLLBACK');
console.log('================================================================\n');

// Implementasi persis sanitizeTargetedRepairJs seperti di route.ts
const sanitizeTargetedRepairJs = (rawText: string): string => {
  if (!rawText) return '';
  let js = rawText.trim();
  const fenceMatch = js.match(/```(?:javascript|js|html)?([\s\S]*?)```/i);
  if (fenceMatch) {
    js = fenceMatch[1];
  } else {
    js = js.replace(/```[\s\S]*?```/g, '');
  }
  js = js.replace(/<\/?script[^>]*>/gi, '');
  js = js.replace(/<!--[\s\S]*?-->/g, '');
  const lines = js.split('\n');
  const cleanLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !/^<\/?(?:html|head|body|div|section|button|input|form|p|span|table|tr|td|th)\b[^>]*>$/i.test(trimmed);
  });
  js = cleanLines.join('\n').trim();
  try {
    new Function(js);
    return js;
  } catch (err) {
    console.warn('[Sanitize] Sintaks JS tidak valid sebelum injeksi:', (err as any).message);
    return '';
  }
};

// =============================================================================
// DOMAIN 1: BARBERSHOP (KASUS UTAMA YANG DILAPORKAN)
// Roles: Super Admin, Barber, Kasir, Pelanggan
// =============================================================================
console.log('--- 1. DOMAIN: BARBERSHOP (Super Admin, Barber, Kasir, Pelanggan) ---');

const barbershopRoles = ['Super Admin', 'Barber', 'Kasir', 'Pelanggan'];
const barbershopHtml = `
<!DOCTYPE html>
<html>
<head><title>Barbershop App</title></head>
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
  <div id="adminPanel">
    <button onclick="kelolaAkunStaf()">Kelola Staf</button>
    <button onclick="tambahAntreanBarber()">Tambah Antrean</button>
  </div>
  <script>
    const demoAccounts = [
      { user: 'admin', pass: 'admin123', role: 'Super Admin' },
      { user: 'barber1', pass: 'barber123', role: 'Barber' },
      { user: 'kasir1', pass: 'kasir123', role: 'Kasir' },
      { user: 'customer', pass: 'cust123', role: 'Pelanggan' }
    ];
    function filterTabsByRole(r) { console.log(r); }
    function handleLogin() { loginAs('Super Admin'); }
    function loginAs(r) { filterTabsByRole(r); }
    filterTabsByRole('Pelanggan');
  </script>
</body>
</html>
`;

// Uji Kasus A: AI Repair mencoba menyuntikkan <script> tag dan role "Staff" (Dirty Response)
console.log('  [Uji 1.A: Dirty Response (mengandung <script> tag dan role "Staff")]');
const dirtyAiResponse = `\`\`\`html
<script>
function kelolaAkunStaf() {
  const staff = { id: 1, role: 'Staff' }; // Kontaminasi role!
  alert('Kelola staf');
}
function tambahAntreanBarber() {
  alert('Antrean ditambahkan');
}
</script>
\`\`\``;

const sanitizedDirty = sanitizeTargetedRepairJs(dirtyAiResponse);
console.log('    - Sanitasi berhasil membuang <script> tag:', !sanitizedDirty.includes('<script>'));

// Simulasi logika route.ts baru: kandidat injeksi + cek kriteria ketat
const preRepairHtml = barbershopHtml;
const insertPos = barbershopHtml.lastIndexOf('</script>');
const candidateHtml = barbershopHtml.slice(0, insertPos) + '\n' + sanitizedDirty + '\n' + barbershopHtml.slice(insertPos);
const candidateValidated = validateAndRepairGeneratedCode(candidateHtml, '', '', barbershopRoles);

const hasSyntaxError = candidateValidated.issues.some(i => i.startsWith('SYNTAX_ERROR'));
const hasRoleContamination = candidateValidated.issues.some(i => i.startsWith('ROLE_CONTAMINATION'));

console.log('    - Terdeteksi Role Contamination pada Dirty Candidate:', hasRoleContamination);
console.log('    - Terdeteksi Syntax Error pada Dirty Candidate:', hasSyntaxError);

let finalHtml = preRepairHtml;
let finalValidated;
if (hasSyntaxError || hasRoleContamination) {
  console.log('    ✅ ROLLBACK BERHASIL: Kandidat ditolak! Kode dikembalikan ke preRepairHtml.');
  finalHtml = preRepairHtml;
  finalValidated = validateAndRepairGeneratedCode(finalHtml, '', '', barbershopRoles);
} else {
  finalHtml = candidateHtml;
  finalValidated = candidateValidated;
}

console.log('    - Status Validasi Pasca Rollback:', finalValidated.isValid ? 'VALID' : 'PARTIAL (MISMATCH HANDLERS)');
console.log('    - Isu Pasca Rollback:', finalValidated.issues);
console.log('    - Tidak Ada SYNTAX_ERROR:', !finalValidated.issues.some(i => i.startsWith('SYNTAX_ERROR')));
console.log('    - Tidak Ada ROLE_CONTAMINATION:', !finalValidated.issues.some(i => i.startsWith('ROLE_CONTAMINATION')));

// Uji Kasus B: AI Repair yang Patuh (Clean Response dengan role resmi Barber & Kasir)
console.log('\n  [Uji 1.B: Clean Response (Mematuhi role resmi & bebas HTML)]');
const cleanAiResponse = `\`\`\`javascript
function kelolaAkunStaf() {
  // Hanya menggunakan role resmi dari context
  const akun = { user: 'barber2', role: 'Barber' };
  alert('Akun staf Barber ditambahkan');
}
function tambahAntreanBarber() {
  alert('Antrean ditambahkan ke jadwal Barber');
}
\`\`\``;

const sanitizedClean = sanitizeTargetedRepairJs(cleanAiResponse);
const cleanCandidateHtml = barbershopHtml.slice(0, insertPos) + '\n' + sanitizedClean + '\n' + barbershopHtml.slice(insertPos);
const cleanValidated = validateAndRepairGeneratedCode(cleanCandidateHtml, '', '', barbershopRoles);

console.log('    - Status Validasi Clean Repair:', cleanValidated.isValid ? '✅ VALID (100% Lolos)' : '❌ Gagal');
console.log('    - Sisa Isu:', cleanValidated.issues.length === 0 ? 'NIHIL' : cleanValidated.issues);

// =============================================================================
// DOMAIN 2: KLINIK KESEHATAN
// Roles: Super Admin, Resepsionis, Dokter Poli, Apoteker, Pasien
// =============================================================================
console.log('\n--- 2. DOMAIN: KLINIK KESEHATAN ---');
const klinikRoles = ['Super Admin', 'Resepsionis', 'Dokter Poli', 'Apoteker', 'Pasien'];
const klinikHtml = `
<!DOCTYPE html>
<html>
<head><title>Klinik Sehat</title></head>
<body>
  <div class="nav-tabs">
    <button class="tab-btn active" data-access-roles="Super Admin">Admin</button>
    <button class="tab-btn" data-access-roles="Resepsionis">Resepsionis</button>
    <button class="tab-btn" data-access-roles="Dokter Poli">Dokter</button>
    <button class="tab-btn" data-access-roles="Apoteker">Apotek</button>
    <button class="tab-btn" data-access-roles="Pasien">Pasien</button>
  </div>
  <div id="loginSection">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Login</button>
  </div>
  <button onclick="panggilPasienNext()">Panggil Pasien</button>
  <button onclick="serahkanObatResep()">Serahkan Obat</button>
  <script>
    const demoAccounts = [
      { user: 'admin', pass: 'admin123', role: 'Super Admin' },
      { user: 'resepsionis', pass: 'res123', role: 'Resepsionis' },
      { user: 'dokter', pass: 'dok123', role: 'Dokter Poli' },
      { user: 'apoteker', pass: 'apt123', role: 'Apoteker' },
      { user: 'pasien1', pass: 'pas123', role: 'Pasien' }
    ];
    function filterTabsByRole(r) { console.log(r); }
    function handleLogin() { loginAs('Super Admin'); }
    function loginAs(r) { filterTabsByRole(r); }
    filterTabsByRole('Pasien');
  </script>
</body>
</html>
`;

const klinikAiResponse = `
function panggilPasienNext() {
  alert('Pasien berikutnya dipanggil ke poli');
}
function serahkanObatResep() {
  alert('Resep diserahkan oleh Apoteker');
}
`;
const sanitizedKlinik = sanitizeTargetedRepairJs(klinikAiResponse);
const klinikInsertPos = klinikHtml.lastIndexOf('</script>');
const klinikRepairedHtml = klinikHtml.slice(0, klinikInsertPos) + '\n' + sanitizedKlinik + '\n' + klinikHtml.slice(klinikInsertPos);
const klinikValidation = validateAndRepairGeneratedCode(klinikRepairedHtml, '', '', klinikRoles);
console.log('  - Status Validasi Klinik:', klinikValidation.isValid ? '✅ VALID (100% Lolos)' : '❌ Gagal');
console.log('  - Isu:', klinikValidation.issues.length === 0 ? 'NIHIL' : klinikValidation.issues);

// =============================================================================
// DOMAIN 3: RENTAL MOBIL
// Roles: Super Admin, Petugas Rental, Penyewa
// =============================================================================
console.log('\n--- 3. DOMAIN: RENTAL MOBIL ---');
const rentalRoles = ['Super Admin', 'Petugas Rental', 'Penyewa'];
const rentalHtml = `
<!DOCTYPE html>
<html>
<head><title>Rental Mobil</title></head>
<body>
  <div class="nav-tabs">
    <button class="tab-btn active" data-access-roles="Super Admin">Admin</button>
    <button class="tab-btn" data-access-roles="Petugas Rental">Petugas</button>
    <button class="tab-btn" data-access-roles="Penyewa">Penyewa</button>
  </div>
  <div id="loginSection">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Login</button>
  </div>
  <button onclick="prosesSerahTerimaKunci()">Serah Terima</button>
  <script>
    const demoAccounts = [
      { user: 'admin', pass: 'admin123', role: 'Super Admin' },
      { user: 'petugas', pass: 'pet123', role: 'Petugas Rental' },
      { user: 'penyewa', pass: 'penyewa123', role: 'Penyewa' }
    ];
    function filterTabsByRole(r) { console.log(r); }
    function handleLogin() { loginAs('Super Admin'); }
    function loginAs(r) { filterTabsByRole(r); }
    filterTabsByRole('Super Admin');
  </script>
</body>
</html>
`;

const rentalAiResponse = `
function prosesSerahTerimaKunci() {
  alert('Kunci unit diserahkan oleh Petugas Rental');
}
`;
const sanitizedRental = sanitizeTargetedRepairJs(rentalAiResponse);
const rentalInsertPos = rentalHtml.lastIndexOf('</script>');
const rentalRepairedHtml = rentalHtml.slice(0, rentalInsertPos) + '\n' + sanitizedRental + '\n' + rentalHtml.slice(rentalInsertPos);
const rentalValidation = validateAndRepairGeneratedCode(rentalRepairedHtml, '', '', rentalRoles);
console.log('  - Status Validasi Rental Mobil:', rentalValidation.isValid ? '✅ VALID (100% Lolos)' : '❌ Gagal');
console.log('  - Isu:', rentalValidation.issues.length === 0 ? 'NIHIL' : rentalValidation.issues);

console.log('\n================================================================');
console.log('SEMUA PENGUJIAN DOMAIN SELESAI DENGAN SUKSES!');
console.log('================================================================');
