import fs from 'fs';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('================================================================');
console.log('🧪 VALIDASI PILAR 2 & REPAIR: KURSUS MENYETIR MOBIL VUE CODE');
console.log('================================================================\n');

const htmlContent = fs.readFileSync('scratch/test_kursus_mobil_compact_vue.html', 'utf-8');
const roles = ['Super Admin', 'Admin Pendaftaran', 'Instruktur Mengemudi', 'Murid'];
const owner = 'Super Admin';

const report = validateAndRepairGeneratedCode(htmlContent, '', '', roles, owner);

console.log('isValid:', report.isValid);
console.log('Issues found count:', report.issues.length);
if (report.issues.length > 0) {
  console.log('Issues:', report.issues);
}
console.log('\n--- RINGKASAN REPAIRED CODE ---');
console.log('Repaired HTML length:', report.repairedCode.html.length);
console.log('Repaired JS length:', report.repairedCode.js.length);

if (report.isValid) {
  console.log('🎉 VALIDASI SUKSES: Nol SyntaxError, Nol Mismatch Handler!');
} else {
  console.error('❌ VALIDASI GAGAL!');
  process.exit(1);
}
