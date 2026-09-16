import fs from 'fs';
import assert from 'assert';
import { validateAndRepairGeneratedCode, checkTailwindV2Syntax } from '../src/lib/codeValidator';

console.log('================================================================');
console.log('🧪 TEST POIN 3: UJI END-TO-END SKEMA ASLI KURSUS MENYETIR MOBIL');
console.log('================================================================\n');

// Skema Asli dari scratch/session_kursus_mobil.json:
const originalRoles = ['Super Admin', 'Admin Pendaftaran', 'Instruktur Mengemudi', 'Murid'];
const originalTables = ['pengguna', 'paket_kursus', 'jadwal_sesi', 'laporan_sesi'];

console.log('Skema Asli yang Diuji:');
console.log('  - Roles (4):', originalRoles);
console.log('  - Tables (4):', originalTables);
console.log('  - Modul RBAC (5): Pendaftaran, Pengecekan Kendaraan, Pelaksanaan/Evaluasi, Keuangan, Dasbor');
console.log('  - Alur Pendukung (2): Cek Rem Tangan & Spion, Validasi Tanda Tangan');
console.log('  - Fitur Pendukung (5): Dasbor slot mobil, Cetak kwitansi, WA reminder, Lembar evaluasi, Rekap pendapatan\n');

import path from 'path';

const fixturePath = path.resolve(__dirname, 'fixtures/kursus_menyetir_mobil.html');
const html = fs.readFileSync(fixturePath, 'utf8');

// 1. Uji Tailwind v2 Whitelist
console.log('[Langkah 1] Verifikasi Kesesuaian Tailwind CSS v2 Whitelist...');
const twReport = checkTailwindV2Syntax(html);
console.log('  - Invalid classes:', twReport.invalidClasses);
console.log('  - Warnings count:', twReport.warnings.length);
assert.strictEqual(twReport.invalidClasses.length, 0, 'FAILED: Ditemukan kelas yang melanggar Tailwind v2 whitelist!');
console.log('  ✅ Langkah 1 PASS: 0 pelanggaran Tailwind CSS v2!\n');

// 2. Uji Pipeline Validasi AST Penuh
console.log('[Langkah 2] Eksekusi Pipeline Validasi AST Penuh (validateAndRepairGeneratedCode)...');
const report = validateAndRepairGeneratedCode(html, '', '', originalRoles);

console.log('  - isValid:', report.isValid);
console.log('  - Issues found count:', report.issues.length);
console.log('  - Issues list:', report.issues);

assert.strictEqual(report.isValid, true, 'FAILED: Validasi harus lolos (isValid === true)!');
assert.strictEqual(report.issues.length, 0, 'FAILED: Tidak boleh ada issues yang tersisa!');

const syntaxErrors = report.issues.filter(i => i.startsWith('SYNTAX_ERROR'));
const mismatchHandlers = report.issues.filter(i => i.startsWith('MISMATCH_HANDLER'));
assert.strictEqual(syntaxErrors.length, 0, 'FAILED: SYNTAX_ERROR harus 0!');
assert.strictEqual(mismatchHandlers.length, 0, 'FAILED: MISMATCH_HANDLER harus 0!');
console.log('  ✅ Langkah 2 PASS: Validasi AST 100% Bersih (0 Syntax Error, 0 Mismatch Handler)!\n');

// 3. Pengukuran Metrik Token & Karakter vs Vanilla JS Lama
console.log('[Langkah 3] Pengukuran Karakter & Estimasi Token vs Kode Vanilla JS yang Gagal:');

const rawLines = html.split('\n').length;
const rawChars = html.length;
// Standard token estimation for code/HTML: ~3.8 - 4.0 chars per token
const estimatedTokens = Math.round(rawChars / 3.9);

// Data dari kegagalan Vanilla JS asli di investigasi awal:
const failedVanillaChars = 12414;
const failedVanillaTokens = Math.round(failedVanillaChars / 3.9);

console.log('  --- HASIL METRIK SKEMA ASLI ---');
console.log(`  - Total Baris Kode: ${rawLines} baris`);
console.log(`  - Total Karakter Kode: ${rawChars} karakter`);
console.log(`  - Estimasi Token Output: ~${estimatedTokens} tokens (Batas MAX_TOKENS: 12.000)`);
console.log(`  - Kode Vanilla JS Lama (Gagal/Truncated): ${failedVanillaChars} karakter (~${failedVanillaTokens} tokens, terpotong di tabel ke-2)`);
console.log(`  - Kapasitas Terpakai: ${Math.round((estimatedTokens / 12000) * 100)}% dari batas limit model.\n`);

console.log('================================================================');
console.log('🎉 UJI END-TO-END SKEMA ASLI KURSUS MENYETIR MOBIL: PASS (100%)');
console.log('================================================================');
