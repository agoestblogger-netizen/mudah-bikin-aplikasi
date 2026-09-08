import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('=== TEST VALIDASI MULTI-ROLE TAB SYNC & ROLE ISOLATION ===\n');

const officialRoles = ['Admin', 'Anggota'];

// Case A: Multi-role TANPA TAB sama sekali
const bugAnggotaKuHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>
  <div id="appContainer" style="display:none;">
    <h2>AnggotaKu</h2>
    <p>TOTAL ANGGOTA: 4</p>
  </div>
  <script>
    let currentRole = null;
    function render() {}
    function handleLogin() { loginAs('Admin'); }
    function loginAs(role) {}
  </script>
</body>
</html>
`;
const resA = validateAndRepairGeneratedCode(bugAnggotaKuHtml, '', '', officialRoles);
console.log('Case A (Tanpa Tab Sama Sekali):', resA.issues.some(i => i.includes('MULTI_ROLE_MISSING_TABS')) ? '✅ CAUGHT' : '❌ MISSED');

// Case B: Tab diberi nama peran mentah [Admin] [Anggota] (seperti di screenshot komplain user)
const rawRoleTabHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>
  <div id="appContainer" style="display:none;">
    <button class="tab-btn" data-access-roles="Admin" onclick="showTab('admin')">Admin</button>
    <button class="tab-btn" data-access-roles="Anggota" onclick="showTab('anggota')">Anggota</button>
  </div>
  <script>
    let currentRole = null;
    function filterTabsByRole(r) {}
    function showTab(t) {}
    function render() {}
    function handleLogin() { loginAs('Admin'); }
    function loginAs(role) {}
  </script>
</body>
</html>
`;
const resB = validateAndRepairGeneratedCode(rawRoleTabHtml, '', '', officialRoles);
console.log('Case B (Tab Berlabel Nama Peran Mentah):', resB.issues.some(i => i.includes('ROLE_AS_TAB_LABEL')) ? '✅ CAUGHT' : '❌ MISSED');
console.log('   Issues:', resB.issues.filter(i => i.includes('ROLE_AS_TAB_LABEL')));

// Case C: Role switcher di dalam appContainer
const switcherInAppHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>
  <div id="appContainer" style="display:none;">
    <button onclick="loginAs('Admin')">Ganti ke Admin</button>
    <button class="tab-btn" data-access-roles="Admin" onclick="showTab('kelola')">Kelola Anggota</button>
    <button class="tab-btn" data-access-roles="Anggota" onclick="showTab('kartu')">Kartu Digital</button>
  </div>
  <script>
    let currentRole = null;
    function filterTabsByRole(r) {}
    function showTab(t) {}
    function render() {}
    function handleLogin() { loginAs('Admin'); }
    function loginAs(role) {}
  </script>
</body>
</html>
`;
const resC = validateAndRepairGeneratedCode(switcherInAppHtml, '', '', officialRoles);
console.log('Case C (Role Switcher di dalam appContainer):', resC.issues.some(i => i.includes('FORBIDDEN_ROLE_SWITCHER_IN_APP')) ? '✅ CAUGHT' : '❌ MISSED');
console.log('   Issues:', resC.issues.filter(i => i.includes('FORBIDDEN_ROLE_SWITCHER_IN_APP')));

// Case D: Benar (Tab nama fitur, tidak ada switcher di appContainer, hanya login screen)
const cleanValidHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>
  <div id="appContainer" style="display:none;">
    <button onclick="logout()">Keluar</button>
    <button class="tab-btn" data-access-roles="Admin" onclick="showTab('kelola')">👥 Kelola Anggota</button>
    <button class="tab-btn" data-access-roles="Anggota" onclick="showTab('kartu')">🪪 Kartu Digital</button>
  </div>
  <script>
    let currentRole = null;
    function filterTabsByRole(r) {}
    function showTab(t) {}
    function render() {}
    function handleLogin() { loginAs('Admin'); }
    function loginAs(role) {}
    function logout() {}
  </script>
</body>
</html>
`;
const resD = validateAndRepairGeneratedCode(cleanValidHtml, '', '', officialRoles);
console.log('Case D (Valid Bersih):', resD.isValid ? '✅ VALID (0 issues)' : '❌ INVALID: ' + resD.issues.join('; '));
