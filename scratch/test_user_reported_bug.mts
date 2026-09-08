import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

const officialRoles = ['Admin', 'Anggota'];

const switcherHtml = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen">
    <input type="text" id="loginUsername">
    <input type="password" id="loginPassword">
    <button onclick="handleLogin()">Masuk</button>
  </div>
  <div id="appContainer" style="display:none;">
    <header class="app-header">
      <div class="logo">AnggotaKu</div>
      <div>Peran: <span id="currentRoleBadge">Anggota</span></div>
      <button onclick="logout()">🚪 Keluar / Ganti Akun</button>
    </header>
    <!-- Role switcher yang keliru ditaruh di appContainer -->
    <div class="role-switcher">
      <button onclick="loginAs('Admin')">👥 Admin</button>
      <button onclick="loginAs('Anggota')">💳 Anggota</button>
    </div>
    <button class="tab-btn" data-access-roles="Admin" onclick="showTab('kelola')">👥 Data Anggota</button>
    <button class="tab-btn" data-access-roles="Anggota" onclick="showTab('kartu')">🪪 Kartu Digital</button>
  </div>
  <script>
    let currentRole = null;
    function filterTabsByRole(r) {}
    function showTab(t) {}
    function render() {}
    function handleLogin() { loginAs('Admin'); }
    function loginAs(role) { filterTabsByRole(role); }
    function logout() {}
  </script>
</body>
</html>
`;

const res = validateAndRepairGeneratedCode(switcherHtml, '', '', officialRoles);
const appHtml = res.repairedCode.html.split('<div id="appContainer"')[1].split('<script')[0];
console.log('APP CONTAINER HTML (Tanpa script):');
console.log(appHtml);
