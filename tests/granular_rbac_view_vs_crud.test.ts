import assert from 'assert';
import {
  repairVueTabAndTableAlignment,
  repairVueHardcodedRoleChecks
} from '../src/lib/codeValidator';

console.log('========================================================================');
console.log('🧪 TEST SUITE: TEGAKKAN GRANULARITAS RBAC (VIEW-ONLY VS CRUD PENUH)');
console.log('========================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: repairVueTabAndTableAlignment
// -----------------------------------------------------------------------------
console.log('--- [TEST 1] Ekstraksi editRoles & Auto-Guard HTML ---');

const sampleHtml = `
<div id="app">
  <div v-for="(cfg, tblKey) in tablesConfig" :key="tblKey" v-show="activeTab === tblKey">
    <h2>{{ cfg.label }}</h2>
    <button @click="openCreate(tblKey)">+ Tambah Data</button>
    <table>
      <thead>
        <tr>
          <th>Nama</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in db[tblKey]">
          <td>{{ row.nama }}</td>
          <td>
            <button @click="openEdit(tblKey, row)">Edit</button>
            <button @click="confirmDelete(tblKey, row.id)">Hapus</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
`;

const sampleJs = `
const app = Vue.createApp({
  data() {
    return {
      activeTab: 'superadmin',
      currentRole: 'Super Admin',
      isLoggedIn: true,
      demoAccounts: [
        { role: 'Super Admin', username: 'admin', password: '123', landingTab: 'superadmin' },
        { role: 'Petugas Rental', username: 'petugas', password: '123', landingTab: 'petugasrental' }
      ],
      // Role-slug tabs that trigger tab rebuild
      tabs: [
        { id: 'superadmin', label: 'Super Admin' },
        { id: 'petugasrental', label: 'Petugas Rental' }
      ],
      tablesConfig: {
        katalog_sepeda: {
          label: 'Katalog Sepeda',
          roles: ['Super Admin', 'Petugas Rental'],
          editRoles: ['Super Admin', 'Petugas Rental']
        },
        transaksi_sewa: {
          label: 'Transaksi Sewa',
          roles: ['Super Admin', 'Petugas Rental'],
          editRoles: ['Petugas Rental'] // Super Admin is VIEW-ONLY!
        }
      },
      db: {
        katalog_sepeda: [{ id: '1', nama: 'Sepeda Gunung' }],
        transaksi_sewa: [{ id: 'T1', nama: 'Sewa #1' }]
      }
    };
  }
});
`;

const { html, js } = repairVueTabAndTableAlignment(sampleHtml, sampleJs);

// a. Button openCreate diguard dengan canEditCurrentTab()
assert(html.includes('v-if="canEditCurrentTab()"'), 'HTML harus memuat v-if="canEditCurrentTab()"');
assert(/<button\s+v-if="canEditCurrentTab\(\)"\s+@click="openCreate\(tblKey\)">/.test(html), 'Tombol openCreate harus diguard dengan canEditCurrentTab()');
console.log('✅ a. Tombol + Tambah berhasil diguard dengan v-if="canEditCurrentTab()"');

// b. Header Aksi diguard dengan canEditCurrentTab()
assert(/<th\s+v-if="canEditCurrentTab\(\)"[^>]*>\s*Aksi\s*<\/th>/.test(html), 'Header Aksi harus diguard dengan canEditCurrentTab()');
console.log('✅ b. Header <th>Aksi</th> berhasil diguard dengan v-if="canEditCurrentTab()"');

// c. Cell Aksi diguard dengan canEditCurrentTab()
assert(/<td\s+v-if="canEditCurrentTab\(\)"[^>]*>[\s\S]*?openEdit/.test(html), 'Sel data Aksi harus diguard dengan canEditCurrentTab()');
console.log('✅ c. Sel data aksi <td> berhasil diguard dengan v-if="canEditCurrentTab()"');

// d. Banner Read-only disuntikkan
assert(html.includes('!canEditCurrentTab()'), 'Banner supervisi & audit harus disuntikkan');
assert(html.includes('Mode Supervisi & Audit (Read-Only)'), 'Teks banner supervisi harus sesuai');
console.log('✅ d. Banner "Mode Supervisi & Audit (Read-Only)" berhasil disuntikkan');

// e. Tabs rebuilt memuat editRoles
assert(js.includes('"editRoles"'), 'Rebuilt tabs harus memiliki properti editRoles');
assert(/editRoles[\s\S]*?Super Admin[\s\S]*?Petugas Rental/.test(js), 'editRoles katalog_sepeda harus memuat kedua role');
assert(/transaksi_sewa[\s\S]*?editRoles[\s\S]*?Petugas Rental/.test(js), 'editRoles transaksi_sewa harus memuat Petugas Rental');
console.log('✅ e. Rebuilt tabs berhasil memuat konfigurasi granular editRoles');

// -----------------------------------------------------------------------------
// Test 2: repairVueHardcodedRoleChecks
// -----------------------------------------------------------------------------
console.log('\n--- [TEST 2] Kanonikalisasi canEditCurrentTab() ---');

const dirtyJs = `
const app = Vue.createApp({
  methods: {
    canEditCurrentTab() {
      if (this.currentRole === 'Super Admin') return true;
      return this.activeTab === 'transaksi_sewa';
    }
  }
});
`;

const cleanedJs = repairVueHardcodedRoleChecks(dirtyJs);
assert(cleanedJs.includes('const editRoles = this.currentTableConfig.editRoles'), 'Kanonikalisasi harus memeriksa currentTableConfig.editRoles');
assert(cleanedJs.includes('return editRoles.includes(this.currentRole)'), 'Kanonikalisasi harus mencocokkan currentRole ke editRoles');
assert(!cleanedJs.includes("if (this.currentRole === 'Super Admin') return true;"), 'Kanonikalisasi harus menghapus bypass naive Super Admin');
console.log('✅ Kanonikalisasi canEditCurrentTab() berhasil menegakkan editRoles dan menghapus bypass Super Admin.');

// -----------------------------------------------------------------------------
// Test 3: Evaluasi Logika canEditCurrentTab()
// -----------------------------------------------------------------------------
console.log('\n--- [TEST 3] Evaluasi Logika Runtime canEditCurrentTab() ---');

const mixinMethods: any = {
  isRoleAllowed(this: any, roles: string[]) {
    if (!roles || !roles.length) return true;
    const owner = 'Super Admin';
    if (this.currentRole === owner) return true;
    return roles.includes(this.currentRole) || roles.includes('*');
  },
  canEditCurrentTab(this: any) {
    // 1. Cek editRoles pada currentTableConfig
    if (this.currentTableConfig) {
      const editRoles = this.currentTableConfig.editRoles || this.currentTableConfig.canEditRoles;
      if (Array.isArray(editRoles)) {
        return editRoles.includes(this.currentRole) || editRoles.includes('*');
      }
    }
    // 2. Cek editRoles pada tablesConfig berdasarkan activeTab
    if (this.tablesConfig) {
      const key = (this.activeTab || '').replace(/^(?:tab_|view_)/, '');
      const cfg = this.tablesConfig[key] || this.tablesConfig[this.activeTab];
      if (cfg) {
        const editRoles = cfg.editRoles || cfg.canEditRoles;
        if (Array.isArray(editRoles)) {
          return editRoles.includes(this.currentRole) || editRoles.includes('*');
        }
      }
    }
    // 3. Cek editRoles pada tabs array
    if (this.tabs && this.tabs.length) {
      const curTab = this.tabs.find((t: any) => t.id === this.activeTab);
      if (curTab) {
        if (curTab.isView) return false;
        const editRoles = curTab.editRoles || curTab.canEditRoles;
        if (Array.isArray(editRoles)) {
          return editRoles.includes(this.currentRole) || editRoles.includes('*');
        }
      }
    }
    // 4. Fallback jika editRoles belum didefinisikan secara granular
    if (this.currentTableConfig) {
      const allowed = this.currentTableConfig.roles || this.currentTableConfig.allowRoles || [];
      if (allowed.length) return this.isRoleAllowed(allowed);
    }
    if (this.tablesConfig) {
      const key2 = (this.activeTab || '').replace(/^(?:tab_|view_)/, '');
      const cfg2 = this.tablesConfig[key2] || this.tablesConfig[this.activeTab];
      if (cfg2) {
        const allowedCfg = cfg2.roles || cfg2.allowRoles || [];
        if (allowedCfg.length) return this.isRoleAllowed(allowedCfg);
      }
    }
    if (this.tabs && this.tabs.length) {
      const curTab2 = this.tabs.find((t: any) => t.id === this.activeTab);
      if (curTab2) {
        if (curTab2.isView) return false;
        const tabRoles = curTab2.roles || curTab2.allowRoles || [];
        if (tabRoles.length) return this.isRoleAllowed(tabRoles);
      }
    }
    const owner = 'Super Admin';
    return this.currentRole === owner;
  }
};

const mockAppState: any = {
  ...mixinMethods,
  activeTab: 'transaksi_sewa',
  currentRole: 'Super Admin',
  tablesConfig: {
    katalog_sepeda: {
      label: 'Katalog Sepeda',
      roles: ['Super Admin', 'Petugas Rental'],
      editRoles: ['Super Admin', 'Petugas Rental']
    },
    transaksi_sewa: {
      label: 'Transaksi Sewa',
      roles: ['Super Admin', 'Petugas Rental'],
      editRoles: ['Petugas Rental'] // Super Admin is VIEW-ONLY!
    }
  },
  tabs: [
    { id: 'katalog_sepeda', label: 'Katalog Sepeda', roles: ['Super Admin', 'Petugas Rental'], editRoles: ['Super Admin', 'Petugas Rental'] },
    { id: 'transaksi_sewa', label: 'Transaksi Sewa', roles: ['Super Admin', 'Petugas Rental'], editRoles: ['Petugas Rental'] },
    { id: 'view_rekap', label: 'Rekap', roles: ['Super Admin'], editRoles: [], isView: true }
  ]
};

// Kasus A: Super Admin di tabel Transaksi Sewa (Supervisi & Audit) -> canEdit HARUS FALSE
mockAppState.currentRole = 'Super Admin';
mockAppState.activeTab = 'transaksi_sewa';
assert.strictEqual(mockAppState.canEditCurrentTab(), false, 'Super Admin harus VIEW-ONLY di transaksi_sewa!');
console.log('✅ Kasus A: Super Admin di tab Transaksi Sewa -> canEditCurrentTab() = FALSE (View-Only)');

// Kasus B: Petugas Rental di tabel Transaksi Sewa (Catat & Proses) -> canEdit HARUS TRUE
mockAppState.currentRole = 'Petugas Rental';
mockAppState.activeTab = 'transaksi_sewa';
assert.strictEqual(mockAppState.canEditCurrentTab(), true, 'Petugas Rental harus memiliki akses CRUD di transaksi_sewa!');
console.log('✅ Kasus B: Petugas Rental di tab Transaksi Sewa -> canEditCurrentTab() = TRUE (Full CRUD)');

// Kasus C: Super Admin di tabel Katalog Sepeda (Master Data) -> canEdit HARUS TRUE
mockAppState.currentRole = 'Super Admin';
mockAppState.activeTab = 'katalog_sepeda';
assert.strictEqual(mockAppState.canEditCurrentTab(), true, 'Super Admin harus memiliki akses CRUD di katalog_sepeda!');
console.log('✅ Kasus C: Super Admin di tab Katalog Sepeda -> canEditCurrentTab() = TRUE (Full CRUD)');

// Kasus D: Tab Laporan Terhitung (isView: true) -> canEdit HARUS FALSE untuk semua role
mockAppState.activeTab = 'view_rekap';
mockAppState.currentRole = 'Super Admin';
assert.strictEqual(mockAppState.canEditCurrentTab(), false, 'Tab view_rekap harus selalu FALSE untuk Super Admin!');
mockAppState.currentRole = 'Petugas Rental';
assert.strictEqual(mockAppState.canEditCurrentTab(), false, 'Tab view_rekap harus selalu FALSE untuk Petugas Rental!');
console.log('✅ Kasus D: Tab Laporan Terhitung -> canEditCurrentTab() = FALSE untuk semua role');

console.log('\n🎉 SEMUA PENGUJIAN GRANULAR RBAC BERHASIL 100%!');
