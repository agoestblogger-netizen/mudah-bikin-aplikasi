import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('=== TEST VALIDASI KONTAMINASI ROLE (UNIT TEST) ===\n');

const officialRoles = ['Dokter', 'Staf Klinik', 'Pasien'];

// Case 1: HTML yang benar (hanya role resmi)
const cleanHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <button onclick="loginAs('Dokter')">Dokter</button>
    <button onclick="loginAs('Staf Klinik')">Staf Klinik</button>
    <button onclick="loginAs('Pasien')">Pasien</button>
  </div>
  <div id="appContainer" style="display:none;">
    <button class="tab-btn" data-access-roles="Dokter" onclick="showTab('periksa')">Periksa</button>
    <button class="tab-btn" data-access-roles="Staf Klinik" onclick="showTab('antrian')">Antrian</button>
    <button class="tab-btn" data-access-roles="Pasien" onclick="showTab('status')">Status</button>
  </div>
  <script>
    let currentRole = null;
    function filterTabsByRole(r) {}
    function showTab(t) {}
    function render() {}
    function loginAs(role) {
      filterTabsByRole(role);
      showTab('periksa');
      render();
    }
  </script>
</body>
</html>
`;

const res1 = validateAndRepairGeneratedCode(cleanHtml, '', '', officialRoles);
console.log('Case 1 (Clean Roles):', res1.isValid ? '✅ VALID (0 issues)' : '❌ INVALID: ' + res1.issues.join('; '));

// Case 2: HTML terkontaminasi Washer & Kasir (dari laundry)
const contaminatedHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <button onclick="loginAs('Admin')">Admin</button>
    <button onclick="loginAs('Kasir')">Kasir</button>
    <button onclick="loginAs('Washer')">Washer</button>
    <button onclick="loginAs('Dokter')">Dokter</button>
  </div>
  <div id="appContainer" style="display:none;">
    <button class="tab-btn" data-access-roles="Admin" onclick="showTab('dash')">Dashboard</button>
    <button class="tab-btn" data-access-roles="Washer" onclick="showTab('antrian')">Antrian</button>
  </div>
  <script>
    let currentRole = null;
    function filterTabsByRole(r) {}
    function showTab(t) {}
    function render() {}
    function loginAs(role) {
      filterTabsByRole(role);
      showTab('dash');
      render();
    }
  </script>
</body>
</html>
`;

const res2 = validateAndRepairGeneratedCode(contaminatedHtml, '', '', officialRoles);
console.log('Case 2 (Contaminated Roles):', !res2.isValid ? '✅ BERHASIL MENCEGAH KONTAMINASI (Detected issues)' : '❌ GAGAL DETEKSI');
console.log('  Issues detected:');
res2.issues.forEach(i => console.log('   -', i));

console.log('\n=== UNIT TEST SELESAI ===');
