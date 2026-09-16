import fs from 'fs';
import path from 'path';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('\n======================================================');
console.log('TEST SUITE: Sales Prospek CRM (Vue 3 Pipeline)');
console.log('======================================================\n');

async function runTest() {
  const filePath = path.resolve(__dirname, 'fixtures/sales_prospek_crm.html');
  const code = fs.readFileSync(filePath, 'utf-8');

  const expectedRoles = ['Sales Manager', 'Sales Executive', 'Klien / Prospek'];
  const expectedTables = ['prospek_leads', 'aktivitas_kunjungan', 'penawaran_deals'];

  console.log(`[1] Menjalankan AST Validator pada fixtures/sales_prospek_crm.html...`);
  const result = validateAndRepairGeneratedCode(code, '', '', expectedRoles, 'Sales Manager');

  console.log(`- isValid: ${result.isValid}`);
  console.log(`- issues count: ${result.issues?.length || 0}`);
  if (result.issues?.length > 0) {
    console.log(`- issues list:`, result.issues);
  }

  if (!result.isValid) {
    console.error('FAIL: Validator mendeteksi pelanggaran:');
    const syntaxErrors = result.issues.filter(i => i.startsWith('SYNTAX_ERROR'));
    const mismatchHandlers = result.issues.filter(i => i.startsWith('MISMATCH_HANDLER'));
    const tailwindViolations = result.issues.filter(i => i.startsWith('TAILWIND_V2'));
    if (syntaxErrors.length) console.error('Syntax Errors:', syntaxErrors);
    if (mismatchHandlers.length) console.error('Mismatch Handlers:', mismatchHandlers);
    if (tailwindViolations.length) console.error('Tailwind Violations:', tailwindViolations);
    process.exit(1);
  }

  console.log('\n[2] Memverifikasi Domain-Specific Features:');
  
  // 1. GPS Check-in
  const hasGps = code.includes('ambilLokasiGps') && code.includes('navigator.geolocation');
  console.log(`- GPS Check-in (ambilLokasiGps + geolocation): ${hasGps ? 'PASS' : 'FAIL'}`);

  // 2. Foto Kunjungan
  const hasPhoto = code.includes('foto_kunjungan_url') && (code.includes('type="file"') || code.includes('handleUploadFoto'));
  console.log(`- Foto Bukti Kunjungan: ${hasPhoto ? 'PASS' : 'FAIL'}`);

  // 3. Approval Diskon Deal
  const hasDiscountApproval = code.includes('setujuiDiskon') && code.includes('diskon_persen');
  console.log(`- Approval Diskon (Sales Manager): ${hasDiscountApproval ? 'PASS' : 'FAIL'}`);

  // 4. Cetak Quotation
  const hasQuotationPrint = code.includes('cetakQuotation') && code.includes('window.print');
  console.log(`- Cetak Quotation Penawaran: ${hasQuotationPrint ? 'PASS' : 'FAIL'}`);

  // 5. Funnel Pipeline & Leaderboard
  const hasFunnel = code.includes('countLeadsByStage') && code.includes('status_tahap');
  const hasLeaderboard = code.includes('leaderboard') && code.includes('totalNilai');
  console.log(`- Funnel Pipeline Leads/Deals: ${hasFunnel ? 'PASS' : 'FAIL'}`);
  console.log(`- Leaderboard Performa Sales: ${hasLeaderboard ? 'PASS' : 'FAIL'}`);

  // 6. Parameterized CRUD tablesConfig
  const hasAllTables = expectedTables.every(t => code.includes(t));
  console.log(`- Parameterized CRUD 3 Tabel (${expectedTables.join(', ')}): ${hasAllTables ? 'PASS' : 'FAIL'}`);

  // 7. RBAC Roles
  const hasAllRoles = expectedRoles.every(r => code.includes(r));
  console.log(`- RBAC 3 Roles (${expectedRoles.join(', ')}): ${hasAllRoles ? 'PASS' : 'FAIL'}`);

  const allPassed = hasGps && hasPhoto && hasDiscountApproval && hasQuotationPrint && hasFunnel && hasLeaderboard && hasAllTables && hasAllRoles && result.isValid;

  if (allPassed) {
    console.log('\n======================================================');
    console.log('ALL CHECKS PASSED: Sales Prospek CRM Vue 3 Pipeline');
    console.log('======================================================\n');
  } else {
    console.error('\nFAIL: Beberapa pengecekan fitur tidak terpenuhi.');
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});
