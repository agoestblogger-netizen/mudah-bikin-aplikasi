import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('=== TEST VALIDASI MULTI-ROLE TAB SYNC ===\n');

const officialRoles = ['Admin', 'Anggota'];

// Case A: Multi-role TANPA TAB sama sekali (kasus bug AnggotaKu yang dikomplain user)
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
    <table><tr><td>John Doe</td><td><button>Edit</button><button>Hapus</button></td></tr></table>
  </div>
  <script>
    let currentRole = null;
    function render() {}
    function handleLogin() { loginAs('Admin'); }
    function loginAs(role) {
      currentRole = role;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appContainer').style.display = 'block';
    }
  </script>
</body>
</html>
`;

const resA = validateAndRepairGeneratedCode(bugAnggotaKuHtml, '', '', officialRoles);
console.log('Case A (Tanpa Tab Sama Sekali):');
console.log('  isValid:', resA.isValid);
console.log('  Issues:', resA.issues.filter(i => i.includes('TAB')));

// Case B: Multi-role tapi hanya ada tab Admin, tidak ada tab Anggota
const partialTabHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>
  <div id="appContainer" style="display:none;">
    <button class="tab-btn" data-access-roles="Admin" onclick="showTab('kelola')">Kelola Anggota</button>
  </div>
  <script>
    let currentRole = null;
    function filterTabsByRole(r) {}
    function showTab(t) {}
    function render() {}
    function handleLogin() { loginAs('Admin'); }
    function loginAs(role) {
      filterTabsByRole(role);
      render();
    }
  </script>
</body>
</html>
`;

const resB = validateAndRepairGeneratedCode(partialTabHtml, '', '', officialRoles);
console.log('\nCase B (Tab Anggota Hilang):');
console.log('  isValid:', resB.isValid);
console.log('  Issues:', resB.issues.filter(i => i.includes('TAB')));

// Case C: Multi-role LENGKAP dengan tab untuk Admin dan Anggota
const completeTabHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>
  <div id="appContainer" style="display:none;">
    <button class="tab-btn" data-access-roles="Admin" onclick="showTab('kelola')">Kelola Anggota</button>
    <button class="tab-btn" data-access-roles="Anggota" onclick="showTab('kartu')">Kartu Digital</button>
  </div>
  <script>
    let currentRole = null;
    function filterTabsByRole(r) {}
    function showTab(t) {}
    function render() {}
    function handleLogin() { loginAs('Admin'); }
    function loginAs(role) {
      filterTabsByRole(role);
      render();
    }
  </script>
</body>
</html>
`;

const resC = validateAndRepairGeneratedCode(completeTabHtml, '', '', officialRoles);
console.log('\nCase C (Tab Lengkap Admin & Anggota):');
console.log('  isValid:', resC.isValid);
console.log('  Issues:', resC.issues.filter(i => i.includes('TAB')));
