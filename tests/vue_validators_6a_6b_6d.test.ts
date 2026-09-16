import assert from 'assert';
import {
  validateAndRepairGeneratedCode,
  extractMissingCreateBranches,
  extractMissingToastFeedbacks,
  extractMissingDeleteWiring,
  extractFakeDeleteActions
} from '../src/lib/codeValidator';

console.log('================================================================');
console.log('🧪 TEST POIN 2: VALIDATOR 6a, 6b, 6d VERSI VUE 3 (NEGATIF & POSITIF)');
console.log('================================================================\n');

// =============================================================================
// 1. UJI SUB-BUG 6a: checkMissingCreateBranches (Jalur CREATE pada Form Simpan)
// =============================================================================
console.log('--- [BAGIAN 1] VALIDATOR 6a: checkMissingCreateBranches ---');

// Subtest 1 (Negatif): Vue saveItem hanya punya cabang update (if this.modal.isEdit), tanpa .push()
console.log('\n[Subtest 1 - Negatif] Deteksi Vue method saveItem tanpa cabang CREATE (.push()):');
const vueBuggy6a = `<!DOCTYPE html>
<html lang="id">
<head><title>Test App</title></head>
<body>
  <div id="app">
    <div id="loginScreen" style="display:none;"></div>
    <div id="appContainer">
      <button class="tab-btn" data-access-roles="Super Admin" @click="showTab('tab1')">Tab 1</button>
      <form @submit.prevent="saveItem">
        <input v-model="modal.form.nama" placeholder="Nama">
        <button type="submit">Simpan</button>
      </form>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          currentRole: 'Super Admin',
          activeTab: 'tab1',
          modal: { isEdit: false, editId: null, form: { nama: '' } },
          db: { siswa: [{ id: '1', nama: 'Budi' }] }
        };
      },
      methods: {
        showTab(t) { this.activeTab = t; },
        saveItem() {
          if (this.modal.isEdit) {
            const idx = this.db.siswa.findIndex(s => s.id === this.modal.editId);
            if (idx !== -1) this.db.siswa[idx].nama = this.modal.form.nama;
          }
          // BUG 6a: TIDAK ADA CABANG CREATE! Tidak ada this.db.siswa.push(...)!
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const report6aBuggy = validateAndRepairGeneratedCode(vueBuggy6a, '', '', ['Super Admin']);
const issues6aBuggy = extractMissingCreateBranches(report6aBuggy.issues);
console.log('  Issues terdeteksi pada 6a buggy:', issues6aBuggy);
assert(issues6aBuggy.length > 0, 'FAILED: Validator 6a gagal menangkap Vue method saveItem tanpa cabang CREATE!');
assert(issues6aBuggy[0].includes('saveItem'), 'FAILED: Nama method saveItem harus tercantum di issue!');
console.log('  ✅ Subtest 1 PASS: MISSING_CREATE_BRANCH pada Vue berhasil ditangkap!');

// Subtest 2 (Positif): Vue saveItem lengkap dengan cabang CREATE (.push())
console.log('\n[Subtest 2 - Positif] Vue method saveItem lengkap dengan this.db[t].push():');
const vueValid6a = `<!DOCTYPE html>
<html lang="id">
<head><title>Test App</title></head>
<body>
  <div id="app">
    <div id="loginScreen" style="display:none;"></div>
    <div id="appContainer">
      <button class="tab-btn" data-access-roles="Super Admin" @click="showTab('tab1')">Tab 1</button>
      <form @submit.prevent="saveItem">
        <input v-model="modal.form.nama" placeholder="Nama">
        <button type="submit">Simpan</button>
      </form>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          currentRole: 'Super Admin',
          activeTab: 'tab1',
          modal: { isEdit: false, editId: null, form: { nama: '' } },
          db: { siswa: [{ id: '1', nama: 'Budi' }] }
        };
      },
      methods: {
        showTab(t) { this.activeTab = t; },
        saveItem() {
          if (this.modal.isEdit) {
            const idx = this.db.siswa.findIndex(s => s.id === this.modal.editId);
            if (idx !== -1) this.db.siswa[idx].nama = this.modal.form.nama;
          } else {
            this.db.siswa.push({ id: 'ID-' + Date.now(), ...this.modal.form });
          }
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const report6aValid = validateAndRepairGeneratedCode(vueValid6a, '', '', ['Super Admin']);
const issues6aValid = extractMissingCreateBranches(report6aValid.issues);
assert.strictEqual(issues6aValid.length, 0, 'FAILED: Vue saveItem dengan .push() tidak boleh memicu MISSING_CREATE_BRANCH!');
console.log('  ✅ Subtest 2 PASS: Vue method saveItem dengan .push() lolos bersih 100%!');

// =============================================================================
// 2. UJI SUB-BUG 6b: checkMissingToastFeedbacks (Notifikasi Toast pada Aksi)
// =============================================================================
console.log('\n--- [BAGIAN 2] VALIDATOR 6b: checkMissingToastFeedbacks ---');

// Subtest 3 (Negatif): Tombol @click="cetakKwitansi('ID-1')" hanya console.log tanpa this.showToast()
console.log('\n[Subtest 3 - Negatif] Deteksi tombol @click aksi tanpa feedback this.showToast():');
const vueBuggy6b = `<!DOCTYPE html>
<html lang="id">
<head><title>Test App</title></head>
<body>
  <div id="app">
    <div id="loginScreen" style="display:none;"></div>
    <div id="appContainer">
      <button class="tab-btn" data-access-roles="Super Admin" @click="showTab('tab1')">Tab 1</button>
      <button @click="cetakKwitansi('ID-001')">Cetak Kwitansi</button>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() { return { currentRole: 'Super Admin', activeTab: 'tab1' }; },
      methods: {
        showTab(t) { this.activeTab = t; },
        cetakKwitansi(id) {
          // BUG 6b: Hanya console.log tanpa memanggil this.showToast()!
          console.log('Mencetak kwitansi:', id);
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const report6bBuggy = validateAndRepairGeneratedCode(vueBuggy6b, '', '', ['Super Admin']);
const issues6bBuggy = extractMissingToastFeedbacks(report6bBuggy.issues);
console.log('  Issues terdeteksi pada 6b buggy:', issues6bBuggy);
assert(issues6bBuggy.length > 0, 'FAILED: Validator 6b gagal menangkap Vue action method tanpa showToast!');
assert(issues6bBuggy[0].includes('cetakKwitansi'), 'FAILED: Nama method cetakKwitansi harus tercantum di issue!');
console.log('  ✅ Subtest 3 PASS: MISSING_TOAST_FEEDBACK pada Vue @click berhasil ditangkap!');

// Subtest 4 (Positif): Vue action method memanggil this.showToast()
console.log('\n[Subtest 4 - Positif] Vue action method memanggil this.showToast():');
const vueValid6b = `<!DOCTYPE html>
<html lang="id">
<head><title>Test App</title></head>
<body>
  <div id="app">
    <div id="loginScreen" style="display:none;"></div>
    <div id="appContainer">
      <button class="tab-btn" data-access-roles="Super Admin" @click="showTab('tab1')">Tab 1</button>
      <button @click="cetakKwitansi('ID-001')">Cetak Kwitansi</button>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() { return { currentRole: 'Super Admin', activeTab: 'tab1' }; },
      methods: {
        showTab(t) { this.activeTab = t; },
        showToast(msg, type) {},
        cetakKwitansi(id) {
          this.showToast('Kwitansi berhasil dicetak!', 'success');
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const report6bValid = validateAndRepairGeneratedCode(vueValid6b, '', '', ['Super Admin']);
const issues6bValid = extractMissingToastFeedbacks(report6bValid.issues);
assert.strictEqual(issues6bValid.length, 0, 'FAILED: Vue action method dengan showToast tidak boleh memicu issue!');
console.log('  ✅ Subtest 4 PASS: Vue action method dengan this.showToast() lolos bersih 100%!');

// =============================================================================
// 3. UJI SUB-BUG 6d: checkMissingDeleteWiringAndFakeAction (Hapus Nyata & Binding)
// =============================================================================
console.log('\n--- [BAGIAN 3] VALIDATOR 6d: checkMissingDeleteWiringAndFakeAction ---');

// Subtest 5 (Negatif A - FAKE_DELETE_ACTION): executeDelete hanya tutup modal & toast tanpa .filter()/.splice()
console.log('\n[Subtest 5 - Negatif A] Deteksi FAKE_DELETE_ACTION pada Vue (tanpa .filter()/.splice()):');
const vueBuggy6dFake = `<!DOCTYPE html>
<html lang="id">
<head><title>Test App</title></head>
<body>
  <div id="app">
    <div id="loginScreen" style="display:none;"></div>
    <div id="appContainer">
      <button class="tab-btn" data-access-roles="Super Admin" @click="showTab('tab1')">Tab 1</button>
      <button @click="confirmDelete('siswa', 1)">Hapus</button>
      <div v-if="deleteModal.isOpen" id="deleteModal">
        <button @click="executeDelete">Ya, Hapus</button>
      </div>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          currentRole: 'Super Admin',
          activeTab: 'tab1',
          deleteModal: { isOpen: false, targetId: null },
          db: { siswa: [{ id: 1, nama: 'Andi' }] }
        };
      },
      methods: {
        showTab(t) { this.activeTab = t; },
        showToast(m) {},
        confirmDelete(tbl, id) {
          this.deleteModal.isOpen = true;
          this.deleteModal.targetId = id;
        },
        executeDelete() {
          // BUG 6d: Hanya tutup modal dan showToast tanpa .filter() atau .splice()!
          this.deleteModal.isOpen = false;
          this.showToast('Data berhasil dihapus!', 'success');
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const report6dFake = validateAndRepairGeneratedCode(vueBuggy6dFake, '', '', ['Super Admin']);
const issues6dFake = extractFakeDeleteActions(report6dFake.issues);
console.log('  Issues terdeteksi pada 6d fake delete:', issues6dFake);
assert(issues6dFake.length > 0, 'FAILED: Validator 6d gagal menangkap executeDelete tanpa mutasi array state!');
assert(issues6dFake[0].includes('executeDelete'), 'FAILED: Nama method executeDelete harus tercantum di issue!');
console.log('  ✅ Subtest 5 PASS: FAKE_DELETE_ACTION pada Vue berhasil ditangkap!');

// Subtest 6 (Negatif B - MISSING_DELETE_WIRING): Ada modal & executeDelete tapi tombol di tabel tidak memanggilnya
console.log('\n[Subtest 6 - Negatif B] Deteksi MISSING_DELETE_WIRING pada Vue (infrastruktur ada tapi tombol unwired):');
const vueBuggy6dUnwired = `<!DOCTYPE html>
<html lang="id">
<head><title>Test App</title></head>
<body>
  <div id="app">
    <div id="loginScreen" style="display:none;"></div>
    <div id="appContainer">
      <button class="tab-btn" data-access-roles="Super Admin" @click="showTab('tab1')">Tab 1</button>
      <!-- BUG: Tombol hapus di tabel tidak memanggil confirmDelete / bukaModalHapus -->
      <button>Detail Data</button>
      <div v-if="deleteModal.isOpen" id="deleteModal">
        <button @click="executeDelete">Ya, Hapus</button>
      </div>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          currentRole: 'Super Admin',
          activeTab: 'tab1',
          deleteModal: { isOpen: false, targetId: null },
          db: { siswa: [{ id: 1, nama: 'Andi' }] }
        };
      },
      methods: {
        showTab(t) { this.activeTab = t; },
        confirmDelete(tbl, id) {
          this.deleteModal.isOpen = true;
        },
        executeDelete() {
          this.db.siswa = this.db.siswa.filter(s => s.id !== this.deleteModal.targetId);
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const report6dUnwired = validateAndRepairGeneratedCode(vueBuggy6dUnwired, '', '', ['Super Admin']);
const issues6dUnwired = extractMissingDeleteWiring(report6dUnwired.issues);
console.log('  Issues terdeteksi pada 6d unwired:', issues6dUnwired);
assert(issues6dUnwired.length > 0, 'FAILED: Validator 6d gagal mendeteksi tombol hapus yang unwired di UI!');
console.log('  ✅ Subtest 6 PASS: MISSING_DELETE_WIRING pada Vue berhasil ditangkap!');

// Subtest 7 (Positif): Aksi hapus Vue lengkap (@click confirmDelete + executeDelete dengan .filter())
console.log('\n[Subtest 7 - Positif] Aksi hapus Vue lengkap & nyata:');
const vueValid6d = `<!DOCTYPE html>
<html lang="id">
<head><title>Test App</title></head>
<body>
  <div id="app">
    <div id="loginScreen" style="display:none;"></div>
    <div id="appContainer">
      <button class="tab-btn" data-access-roles="Super Admin" @click="showTab('tab1')">Tab 1</button>
      <button @click="confirmDelete('siswa', 1)">Hapus</button>
      <div v-if="deleteModal.isOpen" id="deleteModal">
        <button @click="executeDelete">Ya, Hapus</button>
      </div>
    </div>
  </div>
  <script>
    const app = Vue.createApp({
      data() {
        return {
          currentRole: 'Super Admin',
          activeTab: 'tab1',
          deleteModal: { isOpen: false, targetId: null },
          db: { siswa: [{ id: 1, nama: 'Andi' }] }
        };
      },
      methods: {
        showTab(t) { this.activeTab = t; },
        showToast(m) {},
        confirmDelete(tbl, id) {
          this.deleteModal.isOpen = true;
          this.deleteModal.targetId = id;
        },
        executeDelete() {
          this.db.siswa = this.db.siswa.filter(s => s.id !== this.deleteModal.targetId);
          this.deleteModal.isOpen = false;
          this.showToast('Data berhasil dihapus!', 'success');
        }
      }
    });
    app.mount('#app');
  </script>
</body>
</html>`;

const report6dValid = validateAndRepairGeneratedCode(vueValid6d, '', '', ['Super Admin']);
const issues6dFakeValid = extractFakeDeleteActions(report6dValid.issues);
const issues6dUnwiredValid = extractMissingDeleteWiring(report6dValid.issues);
assert.strictEqual(issues6dFakeValid.length, 0, 'FAILED: Vue executeDelete nyata tidak boleh dilaporkan FAKE_DELETE_ACTION!');
assert.strictEqual(issues6dUnwiredValid.length, 0, 'FAILED: Vue delete wired tidak boleh dilaporkan MISSING_DELETE_WIRING!');
console.log('  ✅ Subtest 7 PASS: Aksi hapus Vue lengkap lolos bersih 100%!\n');

console.log('================================================================');
console.log('🎉 SEMUA 7 SUBTEST VALIDATOR 6a, 6b, 6d VERSI VUE: PASS (100%)');
console.log('================================================================');
