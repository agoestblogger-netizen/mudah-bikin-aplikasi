import { validateAndRepairGeneratedCode, extractMissingToastFeedbacks } from '../src/lib/codeValidator';

console.log('=== TEST SUB-BUG 6b: MISSING_TOAST_FEEDBACK VALIDATOR ===');

// Skenario 1: Kasus Bug Nyata — cetakSertifikat hanya memanggil console.log tanpa showToast
console.log('\n[Subtest 1] Deteksi tombol aksi yang hanya console.log tanpa showToast:');
const htmlBuggy = `<!DOCTYPE html>
<html>
<head><title>Kursus Menyetir Mobil</title></head>
<body>
  <div id="loginScreen" style="display:none;"></div>
  <div id="appContainer">
    <button class="tab-btn" onclick="showTab('tabSiswa')">Siswa</button>
    <div id="tabSiswa">
      <button onclick="cetakSertifikat('SIS-001')">Cetak Sertifikat</button>
    </div>
  </div>
  <script>
    function showTab(id) {}
    function cetakSertifikat(id) {
      console.log('Mencetak sertifikat untuk ID:', id);
    }
  </script>
</body>
</html>`;

const reportBuggy = validateAndRepairGeneratedCode(htmlBuggy, '', '', ['Super Admin']);
console.log('  Issues ditemukan:', reportBuggy.issues);
const toastIssues = extractMissingToastFeedbacks(reportBuggy.issues);
console.log('  extractMissingToastFeedbacks:', toastIssues);

if (toastIssues.length === 0) {
  throw new Error('Subtest 1 FAILED: Validator gagal menangkap fungsi cetakSertifikat yang hanya console.log!');
}
if (!toastIssues[0].includes('cetakSertifikat')) {
  throw new Error(`Subtest 1 FAILED: Nama fungsi cetakSertifikat tidak disebutkan dengan benar: ${toastIssues[0]}`);
}
console.log('  ✅ Subtest 1 PASS: MISSING_TOAST_FEEDBACK berhasil ditangkap!');

// Skenario 2: Fungsi aksi yang benar — memanggil showToast
console.log('\n[Subtest 2] Fungsi aksi yang memanggil showToast harus lolos bersih:');
const htmlFixed = `<!DOCTYPE html>
<html>
<head><title>Kursus Menyetir Mobil</title></head>
<body>
  <div id="loginScreen" style="display:none;"></div>
  <div id="appContainer">
    <button class="tab-btn" onclick="showTab('tabSiswa')">Siswa</button>
    <div id="tabSiswa">
      <button onclick="cetakSertifikat('SIS-001')">Cetak Sertifikat</button>
    </div>
  </div>
  <script>
    function showTab(id) {}
    function showToast(pesan, tipe) {
      console.log(pesan);
    }
    function cetakSertifikat(id) {
      showToast('Sertifikat berhasil disiapkan dan dicetak!', 'success');
    }
  </script>
</body>
</html>`;

const reportFixed = validateAndRepairGeneratedCode(htmlFixed, '', '', ['Super Admin']);
const toastIssuesFixed = extractMissingToastFeedbacks(reportFixed.issues);
console.log('  Issues toast pada kode benar:', toastIssuesFixed);

if (toastIssuesFixed.length > 0) {
  throw new Error(`Subtest 2 FAILED: Fungsi dengan showToast malah ditandai memiliki isu: ${toastIssuesFixed.join('; ')}`);
}
console.log('  ✅ Subtest 2 PASS: Fungsi aksi dengan showToast lolos bersih!');

// Skenario 3: Navigasi tab biasa (showTab) tidak boleh ditandai sebagai pelanggaran
console.log('\n[Subtest 3] Navigasi tab / modal toggle tidak boleh dituntut showToast:');
const htmlNav = `<!DOCTYPE html>
<html>
<head><title>Aplikasi</title></head>
<body>
  <div id="loginScreen" style="display:none;"></div>
  <div id="appContainer">
    <button class="tab-btn" onclick="showTab('tab1')">Tab 1</button>
    <button onclick="bukaModal()">Buka</button>
  </div>
  <script>
    function showTab(id) {}
    function bukaModal() {
      document.getElementById('modal').style.display = 'block';
    }
  </script>
</body>
</html>`;

const reportNav = validateAndRepairGeneratedCode(htmlNav, '', '', ['Super Admin']);
const toastIssuesNav = extractMissingToastFeedbacks(reportNav.issues);
if (toastIssuesNav.length > 0) {
  throw new Error(`Subtest 3 FAILED: Navigasi salah dituduh: ${toastIssuesNav.join('; ')}`);
}
console.log('  ✅ Subtest 3 PASS: Navigasi tidak dituduh!');

console.log('\n🎉 SEMUA SUBTEST SUB-BUG 6b BERHASIL 100%!');
