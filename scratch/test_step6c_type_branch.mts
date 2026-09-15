import assert from 'assert';
import * as acorn from 'acorn';
import {
  checkMissingTypeBranches,
  extractMissingTypeBranches,
  validateGeneratedCode
} from '../src/lib/codeValidator';

console.log('=== TEST SUB-BUG 6c: MISSING_TYPE_BRANCH VALIDATOR ===\n');

// -------------------------------------------------------------------------
// Subtest 1: Kasus Nyata Kursus Menyetir Mobil -
// bukaModalUser dipanggil dengan 'sesi', tapi branch 'sesi' cuma hide fields
// -------------------------------------------------------------------------
console.log('[Subtest 1] Deteksi modal dipakai lintas tipe tapi branch hanya hide elements:');

const htmlBugDrivingSchool = `
<!DOCTYPE html>
<html>
<body>
  <div id="tab-pengguna">
    <button onclick="bukaModalUser('USR-001', 'user')">Edit Pengguna</button>
  </div>
  <div id="tab-sesi">
    <button onclick="bukaModalUser('SES-001', 'sesi')">Detail Sesi</button>
  </div>
  <div id="modalUser" class="modal">
    <div id="groupUserFields">
      <input id="namaUser" />
      <input id="peranUser" />
    </div>
    <div id="groupSesiFields">
      <div id="sesiInfo"></div>
    </div>
  </div>
</body>
</html>
`;

const jsBugDrivingSchool = `
function bukaModalUser(id, type) {
  if (type === 'sesi') {
    // BUG NYATA: Hanya sembunyikan field user, tapi tidak ada pengisian data sama sekali!
    document.getElementById('groupUserFields').style.display = 'none';
  } else {
    document.getElementById('groupUserFields').style.display = 'block';
    document.getElementById('namaUser').value = 'Budi';
    document.getElementById('peranUser').value = 'Instruktur';
  }
}
`;

const astBug1 = acorn.parse(jsBugDrivingSchool, { ecmaVersion: 'latest', sourceType: 'script' });
const issues1 = checkMissingTypeBranches(astBug1, htmlBugDrivingSchool, jsBugDrivingSchool);

console.log('  Issues terdeteksi pada kasus hide-only:', issues1);
assert.strictEqual(issues1.length, 1, 'Harus mendeteksi 1 issue MISSING_TYPE_BRANCH untuk tipe "sesi"');
assert.ok(
  issues1[0].includes('hanya menyembunyikan elemen tanpa mengisi data'),
  'Pesan harus spesifik menyebut hanya menyembunyikan elemen tanpa mengisi data'
);
console.log('  ✅ Subtest 1 PASS: Branch kosong/hide-only berhasil ditangkap!\n');


// -------------------------------------------------------------------------
// Subtest 2: Fungsi dipanggil dengan tipe 'sesi' tapi TIDAK ADA branch sama sekali
// -------------------------------------------------------------------------
console.log('[Subtest 2] Deteksi fungsi dipanggil dengan tipe yang tidak ada branch-nya sama sekali:');

const jsNoBranch = `
function bukaModalUser(id, type) {
  if (type === 'user') {
    const user = { id: id, nama: 'Budi' };
    document.getElementById('namaUser').value = user.nama;
  }
  // Sama sekali tidak ada cabang untuk 'sesi'
}
`;

const astBug2 = acorn.parse(jsNoBranch, { ecmaVersion: 'latest', sourceType: 'script' });
const issues2 = checkMissingTypeBranches(astBug2, htmlBugDrivingSchool, jsNoBranch);

console.log('  Issues terdeteksi pada ketiadaan branch:', issues2);
assert.strictEqual(issues2.length, 1, 'Harus mendeteksi 1 issue MISSING_TYPE_BRANCH');
assert.ok(
  issues2[0].includes('TIDAK memiliki percabangan kode'),
  'Pesan harus spesifik menyebut tidak memiliki percabangan kode'
);
console.log('  ✅ Subtest 2 PASS: Tipe tanpa branch sama sekali berhasil ditangkap!\n');


// -------------------------------------------------------------------------
// Subtest 3: Fungsi dengan pengisian konten/data yang benar untuk kedua tipe
// -------------------------------------------------------------------------
console.log('[Subtest 3] Fungsi dengan pengisian data/konten nyata harus lolos bersih:');

const jsFixedWithContent = `
function bukaModalUser(id, type) {
  if (type === 'sesi') {
    document.getElementById('groupUserFields').style.display = 'none';
    document.getElementById('groupSesiFields').style.display = 'block';
    document.getElementById('sesiInfo').innerHTML = 'Detail Sesi: ' + id;
  } else {
    document.getElementById('groupUserFields').style.display = 'block';
    document.getElementById('groupSesiFields').style.display = 'none';
    document.getElementById('namaUser').value = 'Budi';
    document.getElementById('peranUser').value = 'Instruktur';
  }
}
`;

const astFixed = acorn.parse(jsFixedWithContent, { ecmaVersion: 'latest', sourceType: 'script' });
const issues3 = checkMissingTypeBranches(astFixed, htmlBugDrivingSchool, jsFixedWithContent);

console.log('  Issues pada kode yang sudah diperbaiki:', issues3);
assert.strictEqual(issues3.length, 0, 'Kode yang mengisi konten untuk kedua tipe harus 0 issue');
console.log('  ✅ Subtest 3 PASS: Kode dengan pengisian data nyata lolos bersih!\n');


// -------------------------------------------------------------------------
// Subtest 4: Fungsi dengan showToast alternatif untuk tipe kedua harus lolos
// -------------------------------------------------------------------------
console.log('[Subtest 4] Fungsi dengan showToast untuk tipe kedua harus lolos:');

const jsFixedWithToast = `
function bukaModalUser(id, type) {
  if (type === 'sesi') {
    showToast('Menampilkan ringkasan sesi ID: ' + id, 'info');
    return;
  }
  document.getElementById('namaUser').value = 'Budi';
}
`;

const astToast = acorn.parse(jsFixedWithToast, { ecmaVersion: 'latest', sourceType: 'script' });
const issues4 = checkMissingTypeBranches(astToast, htmlBugDrivingSchool, jsFixedWithToast);

console.log('  Issues pada kode dengan showToast:', issues4);
assert.strictEqual(issues4.length, 0, 'Kode dengan showToast untuk cabang tipe harus 0 issue');
console.log('  ✅ Subtest 4 PASS: Branch tipe dengan showToast lolos bersih!\n');


// -------------------------------------------------------------------------
// Subtest 5: Navigasi tab (showTab) tidak boleh salah dituduh
// -------------------------------------------------------------------------
console.log('[Subtest 5] Navigasi tab tidak boleh salah dituduh:');

const htmlTabNav = `
<button onclick="showTab('dashboard')">Dashboard</button>
<button onclick="showTab('sesi')">Sesi</button>
`;

const jsTabNav = `
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
}
`;

const astTab = acorn.parse(jsTabNav, { ecmaVersion: 'latest', sourceType: 'script' });
const issues5 = checkMissingTypeBranches(astTab, htmlTabNav, jsTabNav);

console.log('  Issues pada navigasi tab:', issues5);
assert.strictEqual(issues5.length, 0, 'Navigasi tab tidak boleh dituduh');
console.log('  ✅ Subtest 5 PASS: Navigasi tab aman dari false positive!\n');

console.log('🎉 SEMUA SUBTEST SUB-BUG 6c BERHASIL 100%!');
