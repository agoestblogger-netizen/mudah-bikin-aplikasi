import assert from 'assert';
import * as acorn from 'acorn';
import {
  checkMissingDeleteWiringAndFakeAction,
  extractMissingDeleteWiring,
  extractFakeDeleteActions
} from '../src/lib/codeValidator';

console.log('=== TEST SUB-BUG 6d: DELETE WIRING & FAKE ACTION VALIDATOR ===\n');

// -------------------------------------------------------------------------
// Subtest 1: Kasus Nyata Kursus Menyetir Mobil - FAKE_DELETE_ACTION
// eksekusiHapus() hanya tutup modal dan showToast tanpa .splice() atau .filter()
// -------------------------------------------------------------------------
console.log('[Subtest 1] Deteksi FAKE_DELETE_ACTION (hanya tutup modal & toast tanpa hapus state):');

const htmlWithModal = `
<!DOCTYPE html>
<html>
<body>
  <table>
    <tbody id="siswaBody"></tbody>
  </table>
  <div id="modalHapus" class="modal">
    <button onclick="eksekusiHapus()">Ya, Hapus</button>
  </div>
</body>
</html>
`;

const jsFakeDelete = `
let siswaList = [{ id: 'SIS-001', nama: 'Andi' }];
let deleteId = null;

function bukaModalHapus(id) {
  deleteId = id;
  document.getElementById('modalHapus').style.display = 'block';
}

function eksekusiHapus() {
  // BUG NYATA: Hanya tutup modal dan showToast, data TIDAK DIHAPUS dari array!
  document.getElementById('modalHapus').style.display = 'none';
  showToast('Data siswa berhasil dihapus', 'success');
}

function renderTable() {
  const tbody = document.getElementById('siswaBody');
  tbody.innerHTML = siswaList.map(s => \`
    <tr>
      <td>\${s.nama}</td>
      <td><button onclick="bukaModalHapus('\${s.id}')">Hapus</button></td>
    </tr>
  \`).join('');
}
`;

const ast1 = acorn.parse(jsFakeDelete, { ecmaVersion: 'latest', sourceType: 'script' });
const issues1 = checkMissingDeleteWiringAndFakeAction(ast1, htmlWithModal, jsFakeDelete);

console.log('  Issues terdeteksi pada fake delete:', issues1);
const fakeIssues = extractFakeDeleteActions(issues1);
assert.strictEqual(fakeIssues.length, 1, 'Harus mendeteksi 1 issue FAKE_DELETE_ACTION');
assert.ok(fakeIssues[0].includes('eksekusiHapus'), 'Harus menyebut nama fungsi eksekusiHapus');
console.log('  ✅ Subtest 1 PASS: FAKE_DELETE_ACTION berhasil ditangkap!\n');


// -------------------------------------------------------------------------
// Subtest 2: Kasus Nyata Kursus Menyetir Mobil - MISSING_DELETE_WIRING
// modalHapus & bukaModalHapus ada, tapi tidak ada tombol di tabel yang memanggilnya
// -------------------------------------------------------------------------
console.log('[Subtest 2] Deteksi MISSING_DELETE_WIRING (infrastruktur ada, tapi tidak ada tombol hapus di tabel):');

const jsUnwiredDelete = `
let siswaList = [{ id: 'SIS-001', nama: 'Andi' }];
let deleteId = null;

function bukaModalHapus(id) {
  deleteId = id;
  document.getElementById('modalHapus').style.display = 'block';
}

function eksekusiHapus() {
  const idx = siswaList.findIndex(s => s.id === deleteId);
  if (idx !== -1) siswaList.splice(idx, 1);
  document.getElementById('modalHapus').style.display = 'none';
  showToast('Berhasil dihapus');
}

function renderTable() {
  const tbody = document.getElementById('siswaBody');
  // BUG NYATA: Hanya ada tombol Edit dan Detail, tombol Hapus lupa dipasang!
  tbody.innerHTML = siswaList.map(s => \`
    <tr>
      <td>\${s.nama}</td>
      <td>
        <button onclick="bukaModalEdit('\${s.id}')">Edit</button>
        <button onclick="lihatDetail('\${s.id}')">Detail</button>
      </td>
    </tr>
  \`).join('');
}
`;

const ast2 = acorn.parse(jsUnwiredDelete, { ecmaVersion: 'latest', sourceType: 'script' });
const issues2 = checkMissingDeleteWiringAndFakeAction(ast2, htmlWithModal, jsUnwiredDelete);

console.log('  Issues terdeteksi pada unwired delete:', issues2);
const unwiredIssues = extractMissingDeleteWiring(issues2);
assert.strictEqual(unwiredIssues.length, 1, 'Harus mendeteksi 1 issue MISSING_DELETE_WIRING');
assert.ok(unwiredIssues[0].includes('bukaModalHapus') || unwiredIssues[0].includes('modalHapus'), 'Harus menyebut modal atau opener');
console.log('  ✅ Subtest 2 PASS: MISSING_DELETE_WIRING berhasil ditangkap!\n');


// -------------------------------------------------------------------------
// Subtest 3: Kode Lengkap dan Benar (Ada tombol di tabel & eksekusiHapus pakai .splice)
// -------------------------------------------------------------------------
console.log('[Subtest 3] Aksi hapus lengkap dan nyata harus lolos bersih:');

const jsFixedComplete = `
let siswaList = [{ id: 'SIS-001', nama: 'Andi' }];
let deleteId = null;

function bukaModalHapus(id) {
  deleteId = id;
  document.getElementById('modalHapus').style.display = 'block';
}

function eksekusiHapus() {
  const idx = siswaList.findIndex(s => s.id === deleteId);
  if (idx !== -1) {
    siswaList.splice(idx, 1);
    renderTable();
    showToast('Data berhasil dihapus', 'success');
  }
  document.getElementById('modalHapus').style.display = 'none';
}

function renderTable() {
  const tbody = document.getElementById('siswaBody');
  tbody.innerHTML = siswaList.map(s => \`
    <tr>
      <td>\${s.nama}</td>
      <td>
        <button onclick="bukaModalEdit('\${s.id}')">Edit</button>
        <button onclick="bukaModalHapus('\${s.id}')" class="btn-danger">Hapus</button>
      </td>
    </tr>
  \`).join('');
}
`;

const ast3 = acorn.parse(jsFixedComplete, { ecmaVersion: 'latest', sourceType: 'script' });
const issues3 = checkMissingDeleteWiringAndFakeAction(ast3, htmlWithModal, jsFixedComplete);

console.log('  Issues pada kode hapus yang benar:', issues3);
assert.strictEqual(issues3.length, 0, 'Kode hapus yang lengkap dan nyata harus 0 issue');
console.log('  ✅ Subtest 3 PASS: Aksi hapus lengkap lolos bersih!\n');


// -------------------------------------------------------------------------
// Subtest 4: Aplikasi tanpa modal hapus (misal read-only view) tidak boleh dituduh
// -------------------------------------------------------------------------
console.log('[Subtest 4] Aplikasi tanpa infrastruktur hapus tidak boleh salah dituduh:');

const htmlReadOnly = `
<div>
  <h1>Dashboard Monitoring</h1>
  <p>Status: Aktif</p>
</div>
`;

const jsReadOnly = `
function updateStatus() {
  console.log('status updated');
}
`;

const ast4 = acorn.parse(jsReadOnly, { ecmaVersion: 'latest', sourceType: 'script' });
const issues4 = checkMissingDeleteWiringAndFakeAction(ast4, htmlReadOnly, jsReadOnly);

console.log('  Issues pada read-only:', issues4);
assert.strictEqual(issues4.length, 0, 'Aplikasi tanpa modal hapus tidak boleh dituduh');
console.log('  ✅ Subtest 4 PASS: Aplikasi read-only aman!\n');

console.log('🎉 SEMUA SUBTEST SUB-BUG 6d BERHASIL 100%!');
