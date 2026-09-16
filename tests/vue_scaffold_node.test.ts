import { JSDOM } from 'jsdom';

console.log('================================================================');
console.log('🧪 UJI UNIT VUE SCAFFOLD PILAR 1: DYNAMIC OWNER ROLE TEST');
console.log('================================================================\n');

function createVueScaffold(ownerRoleName: string, activeRoles: string[]) {
  const resolvedOwner = (ownerRoleName || '').trim() || (activeRoles && activeRoles[0]) || 'Super Admin';
  
  return `
  var OWNER_ROLE_NAME = typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : '${resolvedOwner}';
  if (typeof window !== 'undefined') window.OWNER_ROLE_NAME = OWNER_ROLE_NAME;

  var Pilar1VueScaffoldMixin = {
    data() {
      return {
        ownerRole: typeof window !== 'undefined' && window.OWNER_ROLE_NAME ? window.OWNER_ROLE_NAME : '${resolvedOwner}',
        currentRole: '',
        activeTab: '',
        toast: { visible: false, message: '', type: 'info' }
      };
    },
    methods: {
      isRoleAllowed(roles) {
        if (!this.currentRole) return false;
        // Resolusi peran Owner dinamis tanpa hardcode string nama peran
        const owner = this.ownerRole || (typeof window !== 'undefined' ? window.OWNER_ROLE_NAME : '${resolvedOwner}');
        if (owner && String(this.currentRole).trim().toLowerCase() === String(owner).trim().toLowerCase()) {
          return true;
        }
        if (!roles) return false;
        const allowed = (Array.isArray(roles) ? roles : String(roles).split(',')).map(r => String(r).trim().toLowerCase());
        const cur = String(this.currentRole).trim().toLowerCase();
        return allowed.includes(cur) || allowed.includes('*') || allowed.includes('all');
      },
      showTab(tabId) {
        this.activeTab = tabId;
      },
      loginAs(role) {
        this.currentRole = role;
        const matched = (this.demoAccounts || []).find(a => String(a.role).toLowerCase() === String(role).toLowerCase());
        if (matched && matched.landingTab) {
          this.showTab(matched.landingTab);
        } else if (this.tabs && this.tabs.length) {
          const firstAllowed = this.tabs.find(t => this.isRoleAllowed(t.roles));
          if (firstAllowed) this.showTab(firstAllowed.id);
        }
        this.showToast('Masuk sebagai ' + role, 'success');
      },
      logout() {
        this.currentRole = '';
        this.activeTab = '';
        this.showToast('Berhasil keluar.', 'info');
      },
      showToast(msg, type = 'info') {
        this.toast = { visible: true, message: msg, type };
      }
    }
  };
  `;
}

// Test Case 1: Custom Non-Standard Owner "Ketua Dewan Adat"
console.log('--- Test 1: Non-Standard Owner = "Ketua Dewan Adat" ---');
const owner1 = 'Ketua Dewan Adat';
const roles1 = ['Ketua Dewan Adat', 'Juru Tulis', 'Bendahara Kampung', 'Warga Pemohon'];

const tabs1 = [
  { id: 'tabSidang', label: 'Sidang & Keputusan', roles: ['Ketua Dewan Adat'] },
  { id: 'tabSurat', label: 'Arsip Surat Adat', roles: ['Juru Tulis'] },
  { id: 'tabKas', label: 'Kas Adat', roles: ['Bendahara Kampung'] },
  { id: 'tabPermohonan', label: 'Permohonan Layanan', roles: ['Warga Pemohon'] }
];

const scaffoldCode1 = createVueScaffold(owner1, roles1);
const dom1 = new JSDOM(`<!DOCTYPE html><html><body><script>${scaffoldCode1}</script></body></html>`, { runScripts: 'dangerously' });
const win1 = dom1.window as any;

// Simulasikan instance vue dengan mixin
const vm1 = {
  ...win1.Pilar1VueScaffoldMixin.data(),
  ...win1.Pilar1VueScaffoldMixin.methods,
  tabs: tabs1,
  demoAccounts: [
    { role: 'Ketua Dewan Adat', landingTab: 'tabSidang' },
    { role: 'Juru Tulis', landingTab: 'tabSurat' },
    { role: 'Bendahara Kampung', landingTab: 'tabKas' },
    { role: 'Warga Pemohon', landingTab: 'tabPermohonan' }
  ]
};

// 1. Uji Owner
vm1.loginAs('Ketua Dewan Adat');
const ownerTabs = vm1.tabs.filter((t: any) => vm1.isRoleAllowed(t.roles));
console.log(`  Owner "${owner1}" dapat melihat: ${ownerTabs.length} dari ${tabs1.length} tab.`);
if (ownerTabs.length !== tabs1.length) {
  throw new Error(`Owner "${owner1}" gagal melihat seluruh tab! Hanya ${ownerTabs.length} terlihat.`);
}
console.log('  ✅ PASS: Owner non-standard memiliki full access.');

// 2. Uji Staf
vm1.loginAs('Juru Tulis');
const staffTabs = vm1.tabs.filter((t: any) => vm1.isRoleAllowed(t.roles));
console.log(`  Staf "Juru Tulis" dapat melihat: ${staffTabs.length} tab (${staffTabs[0].label}).`);
if (staffTabs.length !== 1 || staffTabs[0].id !== 'tabSurat') {
  throw new Error('Staf "Juru Tulis" tidak ter-gate dengan benar!');
}
console.log('  ✅ PASS: Staff role gating akurat.');

// 3. Uji Logout
vm1.logout();
const loggedOutTabs = vm1.tabs.filter((t: any) => vm1.isRoleAllowed(t.roles));
if (loggedOutTabs.length !== 0 || vm1.currentRole !== '') {
  throw new Error('Logout state tidak ter-reset!');
}
console.log('  ✅ PASS: Logout reset state berhasil.\n');

// Test Case 2: Custom Non-Standard Owner "Direktur Operasional Tambang"
console.log('--- Test 2: Non-Standard Owner = "Direktur Operasional Tambang" ---');
const owner2 = 'Direktur Operasional Tambang';
const roles2 = ['Direktur Operasional Tambang', 'Kepala Shift', 'Operator Alat Berat'];
const tabs2 = [
  { id: 'tabExecutive', label: 'Executive Dashboard', roles: ['Direktur Operasional Tambang'] },
  { id: 'tabShift', label: 'Shift Roster', roles: ['Kepala Shift'] },
  { id: 'tabHeavy', label: 'Fleet Logs', roles: ['Operator Alat Berat'] }
];

const scaffoldCode2 = createVueScaffold(owner2, roles2);
const dom2 = new JSDOM(`<!DOCTYPE html><html><body><script>${scaffoldCode2}</script></body></html>`, { runScripts: 'dangerously' });
const win2 = dom2.window as any;

const vm2 = {
  ...win2.Pilar1VueScaffoldMixin.data(),
  ...win2.Pilar1VueScaffoldMixin.methods,
  tabs: tabs2
};

vm2.loginAs('Direktur Operasional Tambang');
const owner2Tabs = vm2.tabs.filter((t: any) => vm2.isRoleAllowed(t.roles));
console.log(`  Owner "${owner2}" dapat melihat: ${owner2Tabs.length} dari ${tabs2.length} tab.`);
if (owner2Tabs.length !== tabs2.length) {
  throw new Error(`Owner "${owner2}" gagal melihat seluruh tab!`);
}
console.log('  ✅ PASS: Owner custom tambang memiliki full access.');

console.log('================================================================');
console.log('🎉 SEMUA TEST SUITE VUE SCAFFOLD PILAR 1 LULUS 100%!');
console.log('================================================================');
