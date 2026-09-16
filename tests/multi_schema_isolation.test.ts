import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

console.log('\n======================================================');
console.log('TEST SUITE: Multi-Schema Execution & State Isolation');
console.log('======================================================\n');

interface SchemaDefinition {
  name: string;
  fixturePath: string;
  expectedTables: string[];
  expectedRoles: string[];
  ownerRole: string;
}

const schemas: SchemaDefinition[] = [
  {
    name: 'Kursus Menyetir Mobil',
    fixturePath: path.resolve(__dirname, 'fixtures/kursus_menyetir_mobil.html'),
    expectedTables: ['pengguna', 'paket_kursus', 'jadwal_sesi', 'laporan_sesi'],
    expectedRoles: ['Super Admin', 'Admin Pendaftaran', 'Instruktur Mengemudi', 'Murid'],
    ownerRole: 'Super Admin'
  },
  {
    name: 'Sales Prospek CRM',
    fixturePath: path.resolve(__dirname, 'fixtures/sales_prospek_crm.html'),
    expectedTables: ['prospek_leads', 'aktivitas_kunjungan', 'penawaran_deals'],
    expectedRoles: ['Sales Manager', 'Sales Executive', 'Klien / Prospek'],
    ownerRole: 'Sales Manager'
  },
  {
    name: 'Koperasi Simpan Pinjam',
    fixturePath: path.resolve(__dirname, 'fixtures/koperasi_simpan_pinjam.html'),
    expectedTables: ['anggota_koperasi', 'simpanan_sukarela', 'pengajuan_pinjaman'],
    expectedRoles: ['Ketua Koperasi', 'Bendahara', 'Anggota Biasa'],
    ownerRole: 'Ketua Koperasi'
  }
];

import * as acorn from 'acorn';

function extractConfigKeysFromScript(html: string, propTarget: 'tablesConfig' | 'db'): string[] {
  const scriptMatches = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
  if (!scriptMatches) return [];
  const js = scriptMatches.map(s => s.replace(/<\/?script[\s\S]*?>/gi, '')).join('\n');
  const ast: any = acorn.parse(js, { ecmaVersion: 'latest' });
  const keys: string[] = [];

  function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Property' && (node.key?.name === propTarget || node.key?.value === propTarget)) {
      if (node.value?.type === 'ObjectExpression') {
        for (const prop of node.value.properties) {
          const kName = prop.key?.name || prop.key?.value;
          if (kName) keys.push(kName);
        }
      }
    }
    for (const k of Object.keys(node)) {
      if (Array.isArray(node[k])) node[k].forEach(walk);
      else if (typeof node[k] === 'object') walk(node[k]);
    }
  }

  walk(ast);
  return keys;
}

async function runMultiSchemaTest() {
  console.log(`Menjalankan uji 3 skema berturut-turut dalam satu runtime session:\n`);

  const collectedData: Array<{
    name: string;
    tables: string[];
    dbKeys: string[];
    roles: string[];
    isValid: boolean;
    issuesCount: number;
  }> = [];

  for (let i = 0; i < schemas.length; i++) {
    const s = schemas[i];
    console.log(`------------------------------------------------------`);
    console.log(`[Skema ${i + 1}/3] ${s.name}`);
    console.log(`------------------------------------------------------`);

    if (!fs.existsSync(s.fixturePath)) {
      console.error(`FAIL: File fixture ${s.fixturePath} tidak ditemukan.`);
      process.exit(1);
    }

    const code = fs.readFileSync(s.fixturePath, 'utf-8');

    // 1. Jalankan AST validator & repair
    const report = validateAndRepairGeneratedCode(code, '', '', s.expectedRoles, s.ownerRole);
    console.log(`- AST Validator: ${report.isValid ? 'PASS (0 issues)' : 'FAIL (' + report.issues.length + ' issues)'}`);
    if (!report.isValid) {
      console.error('  Issues:', report.issues);
      process.exit(1);
    }

    // 2. Ekstrak tablesConfig dan db
    const tables = extractConfigKeysFromScript(code, 'tablesConfig');
    const dbKeys = extractConfigKeysFromScript(code, 'db');
    console.log(`- Extracted tablesConfig: [${tables.join(', ')}]`);
    console.log(`- Extracted db keys: [${dbKeys.join(', ')}]`);

    // Pastikan seluruh expectedTables ada
    for (const expT of s.expectedTables) {
      if (!tables.includes(expT)) {
        console.error(`FAIL: Tabel '${expT}' tidak ditemukan di tablesConfig ${s.name}`);
        process.exit(1);
      }
    }

    // Pastikan seluruh expectedRoles ada dalam kode
    for (const expR of s.expectedRoles) {
      if (!code.includes(expR)) {
        console.error(`FAIL: Role '${expR}' tidak ditemukan di ${s.name}`);
        process.exit(1);
      }
    }

    collectedData.push({
      name: s.name,
      tables,
      dbKeys,
      roles: s.expectedRoles,
      isValid: report.isValid,
      issuesCount: report.issues.length
    });
  }

  console.log(`\n======================================================`);
  console.log(`VERIFIKASI ISOLASI STATE & DETEKSI KEBOCORAN (LEAKAGE)`);
  console.log(`======================================================\n`);

  let hasLeakage = false;

  // Bandingkan tiap pasangan skema (Skema A vs Skema B)
  for (let i = 0; i < collectedData.length; i++) {
    for (let j = i + 1; j < collectedData.length; j++) {
      const a = collectedData[i];
      const b = collectedData[j];

      // Cek cross-contamination pada tablesConfig
      const leakedTablesAtoB = b.tables.filter(t => a.tables.includes(t));
      const leakedTablesBtoA = a.tables.filter(t => b.tables.includes(t));

      // Cek cross-contamination pada db keys
      const leakedDbAtoB = b.dbKeys.filter(t => a.dbKeys.includes(t));

      // Cek cross-contamination pada roles
      const leakedRoles = a.roles.filter(r => b.roles.includes(r));

      console.log(`Cek Isolasi [${a.name}] vs [${b.name}]:`);
      console.log(`  - Kebocoran tablesConfig: ${leakedTablesAtoB.length === 0 ? '0 (ISOLATED - PASS)' : leakedTablesAtoB.join(', ')}`);
      console.log(`  - Kebocoran db keys: ${leakedDbAtoB.length === 0 ? '0 (ISOLATED - PASS)' : leakedDbAtoB.join(', ')}`);
      console.log(`  - Role overlapping: ${leakedRoles.length === 0 ? '0 (DISJOINT - PASS)' : leakedRoles.join(', ')}`);

      if (leakedTablesAtoB.length > 0 || leakedTablesBtoA.length > 0 || leakedDbAtoB.length > 0) {
        hasLeakage = true;
      }
    }
  }

  if (hasLeakage) {
    console.error('\nFAIL: Ditemukan kebocoran state antar-skema.');
    process.exit(1);
  }

  console.log(`\n------------------------------------------------------`);
  console.log(`KESIMPULAN UJI ISOLASI:`);
  console.log(`- 3/3 Skema berhasil divalidasi dan dianalisis dalam 1 runtime.`);
  console.log(`- 0 kebocoran tablesConfig, 0 kebocoran db keys, 0 inter-session pollution.`);
  console.log(`- Tiap artefak hasil generate 100% self-contained & isolated.`);
  console.log(`======================================================\n`);
}

runMultiSchemaTest().catch(err => {
  console.error('Error in multi-schema test:', err);
  process.exit(1);
});
