import { validateAndRepairGeneratedCode, extractMissingCreateBranches } from '../src/lib/codeValidator';

console.log('=== TEST SUB-BUG 6a: MISSING_CREATE_BRANCH VALIDATOR ===');

// Skenario 1: Kasus Bug Nyata — simpanSiswa hanya punya if (editId), tanpa else untuk CREATE
console.log('\n[Subtest 1] Deteksi fungsi simpan tanpa cabang CREATE (hanya UPDATE):');
const htmlBuggy = `<!DOCTYPE html>
<html>
<head><title>Kursus Menyetir Mobil</title></head>
<body>
  <div id="loginScreen" style="display:none;"></div>
  <div id="appContainer">
    <button class="tab-btn" onclick="showTab('tabSiswa')">Siswa</button>
    <div id="tabSiswa">
      <button onclick="bukaModalTambahSiswa()">➕ Tambah Siswa</button>
      <div id="modalSiswa">
        <form onsubmit="simpanSiswa(event)">
          <input type="hidden" id="editSiswaId" value="">
          <input type="text" id="namaSiswa" placeholder="Nama Siswa">
          <button type="submit">Simpan</button>
        </form>
      </div>
    </div>
  </div>
  <script>
    let daftarSiswa = [
      { id: 'SIS-001', nama: 'Budi Santoso' }
    ];

    function showTab(id) {}
    function bukaModalTambahSiswa() {
      document.getElementById('editSiswaId').value = '';
    }

    function simpanSiswa(e) {
      if (e) e.preventDefault();
      const editId = document.getElementById('editSiswaId').value;
      if (editId) {
        const idx = daftarSiswa.findIndex(s => s.id === editId);
        if (idx !== -1) {
          daftarSiswa[idx].nama = document.getElementById('namaSiswa').value;
        }
      }
      // BUG: TIDAK ADA ELSE! TIDAK ADA daftarSiswa.push(...)!
    }
  </script>
</body>
</html>`;

const reportBuggy = validateAndRepairGeneratedCode(htmlBuggy, '', '', ['Super Admin']);
console.log('  Issues ditemukan:', reportBuggy.issues);
const createIssues = extractMissingCreateBranches(reportBuggy.issues);
console.log('  extractMissingCreateBranches:', createIssues);

if (createIssues.length === 0) {
  throw new Error('Subtest 1 FAILED: Validator gagal menangkap fungsi simpanSiswa yang tidak punya jalur CREATE!');
}
if (!createIssues[0].includes('simpanSiswa')) {
  throw new Error(`Subtest 1 FAILED: Nama fungsi simpanSiswa tidak disebutkan dengan benar: ${createIssues[0]}`);
}
console.log('  ✅ Subtest 1 PASS: MISSING_CREATE_BRANCH berhasil ditangkap!');

// Skenario 2: Fungsi simpan yang benar — ada branch else untuk CREATE
console.log('\n[Subtest 2] Fungsi simpan dengan branch else yang memanggil .push() harus lolos bersih:');
const htmlFixed = `<!DOCTYPE html>
<html>
<head><title>Kursus Menyetir Mobil</title></head>
<body>
  <div id="loginScreen" style="display:none;"></div>
  <div id="appContainer">
    <button class="tab-btn" onclick="showTab('tabSiswa')">Siswa</button>
    <div id="tabSiswa">
      <button onclick="bukaModalTambahSiswa()">➕ Tambah Siswa</button>
      <div id="modalSiswa">
        <form onsubmit="simpanSiswa(event)">
          <input type="hidden" id="editSiswaId" value="">
          <input type="text" id="namaSiswa" placeholder="Nama Siswa">
          <button type="submit">Simpan</button>
        </form>
      </div>
    </div>
  </div>
  <script>
    let daftarSiswa = [
      { id: 'SIS-001', nama: 'Budi Santoso' }
    ];

    function showTab(id) {}
    function bukaModalTambahSiswa() {
      document.getElementById('editSiswaId').value = '';
    }

    function simpanSiswa(e) {
      if (e) e.preventDefault();
      const editId = document.getElementById('editSiswaId').value;
      if (editId) {
        const idx = daftarSiswa.findIndex(s => s.id === editId);
        if (idx !== -1) {
          daftarSiswa[idx].nama = document.getElementById('namaSiswa').value;
        }
      } else {
        const newSiswa = {
          id: 'SIS-' + String(daftarSiswa.length + 1).padStart(3, '0'),
          nama: document.getElementById('namaSiswa').value
        };
        daftarSiswa.push(newSiswa);
      }
    }
  </script>
</body>
</html>`;

const reportFixed = validateAndRepairGeneratedCode(htmlFixed, '', '', ['Super Admin']);
const createIssuesFixed = extractMissingCreateBranches(reportFixed.issues);
console.log('  Issues create pada kode benar:', createIssuesFixed);

if (createIssuesFixed.length > 0) {
  throw new Error(`Subtest 2 FAILED: Kode yang valid malah ditandai memiliki isu CREATE: ${createIssuesFixed.join('; ')}`);
}
console.log('  ✅ Subtest 2 PASS: Kode dengan else CREATE lolos bersih!');

// Skenario 3: Fungsi simpan murni tambah baru (tanpa if editId)
console.log('\n[Subtest 3] Fungsi simpan murni CREATE tanpa if editId harus lolos:');
const htmlPureAdd = `<!DOCTYPE html>
<html>
<head><title>Aplikasi Kasir</title></head>
<body>
  <div id="loginScreen" style="display:none;"></div>
  <div id="appContainer">
    <button class="tab-btn" onclick="showTab('tabTransaksi')">Transaksi</button>
    <button onclick="simpanTransaksi()">Simpan Transaksi</button>
  </div>
  <script>
    let transaksi = [];
    function showTab(id) {}
    function simpanTransaksi() {
      const item = { id: 'TRX-001', nominal: 50000 };
      transaksi.push(item);
    }
  </script>
</body>
</html>`;

const reportPureAdd = validateAndRepairGeneratedCode(htmlPureAdd, '', '', ['Super Admin']);
const createIssuesPureAdd = extractMissingCreateBranches(reportPureAdd.issues);
console.log('  Issues create pada tambah murni:', createIssuesPureAdd);

if (createIssuesPureAdd.length > 0) {
  throw new Error(`Subtest 3 FAILED: Tambah murni ditandai salah: ${createIssuesPureAdd.join('; ')}`);
}
console.log('  ✅ Subtest 3 PASS: Tambah murni lolos bersih!');

console.log('\n🎉 SEMUA SUBTEST SUB-BUG 6a BERHASIL 100%!');
