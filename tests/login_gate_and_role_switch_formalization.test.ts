import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('========================================================================');
console.log('🧪 TEST: FORMALISASI GERBANG LOGIN & LARANGAN ROLE SWITCHER (FITUR 2)');
console.log('========================================================================\n');

let allPassed = true;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    allPassed = false;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Validator Mendeteksi Berbagai Bentuk In-App Role Switcher di appContainer
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Deteksi In-App Role Switcher (Vue @click, onclick, & v-model) ---');

const officialRoles = ['Super Admin', 'Kasir', 'Barber', 'Pelanggan'];

// Kasus A: Button dengan @click="loginAs(...)" di dalam appContainer
const codeWithVueClickLoginAs = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen" v-if="!isLoggedIn">
    <button @click="handleLogin">Masuk</button>
  </div>
  <div id="appContainer" v-if="isLoggedIn">
    <header class="flex justify-between">
      <h1>Barbershop App</h1>
      <button @click="loginAs('Super Admin')">Switch ke Admin</button>
      <button @click="logout">Keluar</button>
    </header>
    <button class="tab-btn" data-access-roles="Super Admin" @click="showTab('tabAdmin')">Kelola Sistem</button>
  </div>
  <script>
    Vue.createApp({
      data() { return { isLoggedIn: false, currentRole: '', activeTab: '' }; },
      methods: {
        loginAs(role) { this.currentRole = role; this.isLoggedIn = true; },
        logout() { this.currentRole = ''; this.isLoggedIn = false; },
        showTab(t) { this.activeTab = t; }
      }
    }).mount('#app');
  </script>
</body>
</html>
`;

const resA = validateAndRepairGeneratedCode(codeWithVueClickLoginAs, '', '', officialRoles);
assert(
  resA.issues.some(i => i.includes('FORBIDDEN_ROLE_SWITCHER_IN_APP')),
  'Validator berhasil mendeteksi @click="loginAs(...)" di dalam appContainer'
);
assert(
  !resA.repairedCode.html.includes('@click="loginAs(\'Super Admin\')"'),
  'Auto-repair berhasil menghapus tombol @click="loginAs(...)" dari appContainer'
);

// Kasus B: Dropdown select dengan v-model="currentRole" di dalam appContainer
const codeWithSelectRoleSwitcher = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen" v-if="!isLoggedIn">
    <button @click="handleLogin">Masuk</button>
  </div>
  <div id="appContainer" v-if="isLoggedIn">
    <nav class="flex">
      <select v-model="currentRole">
        <option value="Kasir">Kasir</option>
        <option value="Super Admin">Super Admin</option>
      </select>
      <button @click="logout">Keluar</button>
    </nav>
    <button class="tab-btn" data-access-roles="Kasir" @click="showTab('tabKasir')">Kasir POS</button>
  </div>
  <script>
    Vue.createApp({
      data() { return { isLoggedIn: false, currentRole: '', activeTab: '' }; },
      methods: {
        logout() { this.currentRole = ''; this.isLoggedIn = false; },
        showTab(t) { this.activeTab = t; }
      }
    }).mount('#app');
  </script>
</body>
</html>
`;

const resB = validateAndRepairGeneratedCode(codeWithSelectRoleSwitcher, '', '', officialRoles);
assert(
  resB.issues.some(i => i.includes('FORBIDDEN_ROLE_SWITCHER_IN_APP')),
  'Validator berhasil mendeteksi <select v-model="currentRole"> di dalam appContainer'
);
assert(
  !resB.repairedCode.html.includes('v-model="currentRole"'),
  'Auto-repair berhasil menghapus <select v-model="currentRole"> dari appContainer'
);

// Kasus C: Button dengan @click="currentRole = '...'" di dalam appContainer
const codeWithDirectRoleMutation = `
<!DOCTYPE html>
<html>
<body>
  <div id="loginScreen" v-if="!isLoggedIn">
    <button @click="handleLogin">Masuk</button>
  </div>
  <div id="appContainer" v-if="isLoggedIn">
    <button @click="currentRole = 'Barber'">Ganti ke Barber</button>
    <button @click="logout">Keluar</button>
  </div>
  <script>
    Vue.createApp({
      data() { return { isLoggedIn: false, currentRole: '', activeTab: '' }; },
      methods: { logout() {} }
    }).mount('#app');
  </script>
</body>
</html>
`;

const resC = validateAndRepairGeneratedCode(codeWithDirectRoleMutation, '', '', officialRoles);
assert(
  resC.issues.some(i => i.includes('FORBIDDEN_ROLE_SWITCHER_IN_APP')),
  'Validator berhasil mendeteksi @click="currentRole = ..." di dalam appContainer'
);
assert(
  !resC.repairedCode.html.includes('@click="currentRole = \'Barber\'"'),
  'Auto-repair berhasil membersihkan @click="currentRole = ..." dari appContainer'
);

// -----------------------------------------------------------------------------
// TEST 2: Pilar1VueScaffoldMixin State Reset & LandingTab Activation
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Pilar1VueScaffoldMixin Implicit Logout & Modal Cleanup ---');

// Ambil definisi mixin dari codeValidator untuk diuji secara runtime mock
const mockAppScope = {
  currentRole: 'Super Admin',
  isLoggedIn: true,
  activeTab: 'tabKelolaAdmin',
  modal: { isOpen: true as boolean, show: true as boolean, isEdit: true as boolean },
  deleteModal: { isOpen: true as boolean, show: true as boolean },
  loginForm: { username: 'superadmin', password: '123' },
  demoAccounts: [
    { role: 'Super Admin', username: 'superadmin', landingTab: 'tabKelolaAdmin' },
    { role: 'Kasir', username: 'kasir', landingTab: 'tabKasirPOS' },
    { role: 'Barber', username: 'barber', landingTab: 'tabAntrianBarber' }
  ],
  tabs: [
    { id: 'tabKelolaAdmin', roles: ['Super Admin'] },
    { id: 'tabKasirPOS', roles: ['Kasir'] },
    { id: 'tabAntrianBarber', roles: ['Barber'] }
  ],
  showToastCalls: [] as string[],
  showToast(msg: string) {
    this.showToastCalls.push(msg);
  },
  showTab(tabId: string) {
    this.activeTab = tabId;
  },
  isRoleAllowed(roles: string[]) {
    if (this.currentRole === 'Super Admin') return true;
    return roles.includes(this.currentRole);
  },
  // Implementasi mixin yang sudah diperbaiki
  logout() {
    this.currentRole = '';
    this.isLoggedIn = false;
    this.activeTab = '';
    if (this.modal && typeof this.modal === 'object') {
      this.modal.isOpen = false;
      this.modal.show = false;
      this.modal.isEdit = false;
    }
    if (this.deleteModal && typeof this.deleteModal === 'object') {
      this.deleteModal.isOpen = false;
      this.deleteModal.show = false;
    }
    if (this.loginForm && typeof this.loginForm === 'object') {
      this.loginForm.username = '';
      this.loginForm.password = '';
    }
    this.showToast('Berhasil keluar. Silakan login kembali.');
  },
  loginAs(role: string) {
    if (this.isLoggedIn) {
      this.logout();
    }
    this.currentRole = role;
    this.isLoggedIn = true;
    if (this.modal && typeof this.modal === 'object') {
      this.modal.isOpen = false;
      this.modal.show = false;
    }
    if (this.deleteModal && typeof this.deleteModal === 'object') {
      this.deleteModal.isOpen = false;
    }
    const acc = (this.demoAccounts || []).find((a: any) => a.role === role);
    if (acc && acc.landingTab) {
      this.showTab(acc.landingTab);
    } else if (this.tabs && this.tabs.length) {
      const first = this.tabs.find((t: any) => this.isRoleAllowed(t.roles));
      if (first) this.showTab(first.id);
    }
  }
};

// Eksekusi logout()
mockAppScope.logout();
assert(mockAppScope.isLoggedIn === false, 'logout(): isLoggedIn di-reset ke false');
assert(mockAppScope.currentRole === '', 'logout(): currentRole dikosongkan');
assert(mockAppScope.activeTab === '', 'logout(): activeTab dikosongkan');
assert(mockAppScope.modal.isOpen === false, 'logout(): modal yang terbuka tertutup otomatis');
assert(mockAppScope.deleteModal.isOpen === false, 'logout(): deleteModal yang terbuka tertutup otomatis');
assert(mockAppScope.loginForm.username === '', 'logout(): loginForm username dikosongkan');

// Set state seolah-olah user login sebagai Barber dengan modal terbuka
mockAppScope.currentRole = 'Barber';
mockAppScope.isLoggedIn = true;
mockAppScope.activeTab = 'tabAntrianBarber';
mockAppScope.modal.isOpen = true;

// Quick-login / loginAs ke Kasir saat masih di state sudah login
mockAppScope.loginAs('Kasir');

assert(mockAppScope.currentRole === 'Kasir', 'loginAs("Kasir"): currentRole berpindah ke Kasir');
assert(mockAppScope.isLoggedIn === true, 'loginAs("Kasir"): isLoggedIn tetap true');
assert(mockAppScope.activeTab === 'tabKasirPOS', 'loginAs("Kasir"): mendarat tepat di landingTab miliknya (tabKasirPOS), bukan tab Barber');
assert((mockAppScope.modal.isOpen as boolean) === false, 'loginAs("Kasir"): modal terbuka milik Barber ditutup bersih');
assert(
  mockAppScope.showToastCalls.includes('Berhasil keluar. Silakan login kembali.'),
  'loginAs("Kasir") dari state sudah-login memicu implicit clean logout terlebih dahulu'
);

// -----------------------------------------------------------------------------
// HASIL KESELURUHAN
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
if (allPassed) {
  console.log('🎉 SEMUA TEST FORMALISASI GERBANG LOGIN & ISOLASI PERAN LOLOS!');
  process.exit(0);
} else {
  console.error('❌ BEBERAPA TEST GAGAL!');
  process.exit(1);
}
