import { execSync } from 'child_process';
import path from 'path';

console.log('========================================================================');
console.log('🚀 MASTER TEST SUITE RUNNER: MUDAH BIKIN APLIKASI (VUE 3 FULL PIPELINE)');
console.log('========================================================================\n');

const testFiles = [
  {
    id: 1,
    name: 'Tailwind CSS v2 Whitelist Enforcement',
    file: 'tests/tailwind_v2_whitelist.test.ts',
    desc: 'Memvalidasi 39.062 kelas precompiled, menolak arbitrary values [...] dan utility v3+'
  },
  {
    id: 2,
    name: 'Vue AST Parameterized CRUD & Safety Mixin',
    file: 'tests/vue_validators_6a_6b_6d.test.ts',
    desc: 'Memverifikasi create/edit/delete generic branches dan deteksi method pada Vue methods: {}'
  },
  {
    id: 3,
    name: 'End-to-End Skema Kursus Menyetir Mobil',
    file: 'tests/kursus_mobil_skema_asli.test.ts',
    desc: 'Validasi skema asli 4 role, 4 tabel, 5 modul RBAC tanpa syntax/handler/tailwind issues'
  },
  {
    id: 4,
    name: 'Dynamic Owner Role Resolution',
    file: 'tests/owner_role_dynamic.test.ts',
    desc: 'Resolusi owner role non-Super Admin (Ketua Koperasi, Dokter, Admin Toko, dll)'
  },
  {
    id: 5,
    name: 'Vue 3 CDN Scaffold & Deterministic Safety Bridge',
    file: 'tests/vue_scaffold_node.test.ts',
    desc: 'Verifikasi injeksi Pilar 1 safety mixin & bridge window.VueSafetyMixin di buildSrcDoc'
  },
  {
    id: 6,
    name: 'Vue Options API Object AST Traversal',
    file: 'tests/vue_wrapper.test.ts',
    desc: 'Verifikasi Acorn Property walker mengenali methods Vue tanpa False Positives'
  },
  {
    id: 7,
    name: 'Targeted Repair Integrity & DOM Elements',
    file: 'tests/targeted_repair_integrity.test.ts',
    desc: 'Memastikan auto-repair tidak merusak struktur skrip dan menjaga konsistensi DOM'
  },
  {
    id: 8,
    name: 'RBAC Tab Gating & UI Consistency',
    file: 'tests/rbac_ui_fixes.test.ts',
    desc: 'Memastikan tab navigasi terisolasi per role (v-show / data-access-roles) dan login gate'
  },
  {
    id: 9,
    name: 'Sales Prospek CRM Domain Regeneration',
    file: 'tests/sales_prospek_crm.test.ts',
    desc: 'Verifikasi 3 roles, 3 tables, GPS check-in, Foto bukti, Funnel pipeline, & Leaderboard'
  },
  {
    id: 10,
    name: 'Multi-Schema Execution & State Isolation',
    file: 'tests/multi_schema_isolation.test.ts',
    desc: 'Verifikasi 0 kebocoran tablesConfig, 0 cross-contamination db, & isolasi total antar 3 domain'
  }
];

let passed = 0;
let failed = 0;
const startTime = Date.now();

for (const t of testFiles) {
  process.stdout.write(`[${t.id}/10] Menjalankan: ${t.name}... `);
  const startT = Date.now();
  try {
    execSync(`npx tsx ${t.file}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.resolve(__dirname, '..')
    });
    const dur = ((Date.now() - startT) / 1000).toFixed(2);
    console.log(`✅ PASS (${dur}s)`);
    passed++;
  } catch (err: any) {
    const dur = ((Date.now() - startT) / 1000).toFixed(2);
    console.log(`❌ FAIL (${dur}s)`);
    console.error('\n--- Output Error ---');
    console.error(err.stdout ? err.stdout.toString() : '');
    console.error(err.stderr ? err.stderr.toString() : '');
    console.error('--------------------\n');
    failed++;
  }
}

const totalDur = ((Date.now() - startTime) / 1000).toFixed(2);
console.log('\n========================================================================');
console.log(`RINGKASAN HASIL TEST SUITE:`);
console.log(`Total: ${testFiles.length} | Lolos (PASS): ${passed} | Gagal (FAIL): ${failed}`);
console.log(`Waktu Eksekusi: ${totalDur} detik`);
console.log('========================================================================\n');

if (failed > 0) {
  process.exit(1);
}
