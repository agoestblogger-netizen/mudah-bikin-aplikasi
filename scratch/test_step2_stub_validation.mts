import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('--- Testing Stub Form Field Validator (Langkah 2) ---');

// Test 1: HTML with Stub Form ("Field 2", "Value 2")
const htmlWithStub = `
<!DOCTYPE html>
<html>
<head><title>Test App</title></head>
<body>
  <div id="modalForm" class="modal">
    <form id="formData">
      <div class="form-group">
        <label for="f1">Nama</label>
        <input type="text" id="f1" placeholder="Masukkan nama...">
      </div>
      <div class="form-group">
        <label for="inputField2">Field 2</label>
        <input type="text" id="inputField2" placeholder="Value 2">
      </div>
      <button type="button" onclick="simpanForm()">Simpan</button>
    </form>
  </div>
  <script>
    function simpanForm() {}
  </script>
</body>
</html>
`;

const reportStub = validateAndRepairGeneratedCode(htmlWithStub, '', '');
const stubIssues = reportStub.issues.filter(i => i.startsWith('STUB_FORM_FIELDS'));
console.log('Test 1 (Stub detected):', stubIssues.length > 0 ? 'PASS ✅' : 'FAIL ❌');
console.log('Issues found in Test 1:', stubIssues);

// Test 2: HTML with valid schema fields
const htmlValid = `
<!DOCTYPE html>
<html>
<head><title>Test App</title></head>
<body>
  <div id="modalForm" class="modal">
    <form id="formData">
      <div class="form-group">
        <label for="inputNama">Nama Lengkap</label>
        <input type="text" id="inputNama" placeholder="Masukkan nama...">
      </div>
      <div class="form-group">
        <label for="inputKategori">Kategori</label>
        <select id="inputKategori">
          <option value="A">A</option>
        </select>
      </div>
      <button type="button" onclick="simpanForm()">Simpan</button>
    </form>
  </div>
  <script>
    function simpanForm() {}
  </script>
</body>
</html>
`;

const reportValid = validateAndRepairGeneratedCode(htmlValid, '', '');
const stubIssuesValid = reportValid.issues.filter(i => i.startsWith('STUB_FORM_FIELDS'));
console.log('Test 2 (Clean HTML passes):', stubIssuesValid.length === 0 ? 'PASS ✅' : 'FAIL ❌');
if (stubIssuesValid.length > 0) {
  console.log('Unexpected issues in Test 2:', stubIssuesValid);
}
