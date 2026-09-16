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
  },
  {
    id: 11,
    name: 'Four Real Vue Bugs Fixes & Fallback Safety',
    file: 'tests/four_vue_bugs_fix.test.ts',
    desc: 'Verifikasi perbaikan 4 bug nyata (panel luar app, DOM manual, canEditCurrentTab, mixin registration)'
  },
  {
    id: 12,
    name: 'Role Tab Navigation & Public Role Security Gate',
    file: 'tests/role_tab_and_public_role.test.ts',
    desc: 'Bug 1: deteksi & auto-repair ROLE_MISSING_TAB_NAVIGATION (Petugas Perawat Hewan dll). Bug 2: fix false positive PUBLIC_ROLE_UNFILTERED_ON_LOAD di Vue reactive gate app'
  },
  {
    id: 13,
    name: '3-Tier Schema Pattern & Relation Integrity',
    file: 'tests/schema_pattern_and_relation_integrity.test.ts',
    desc: 'Verifikasi pola katalog master + tabel pendaftaran penghubung + tabel turunan, deteksi relasi tabel tidak ada, dan auto-repair peran'
  },
  {
    id: 14,
    name: 'Tailwind Plugin Whitelist & Simulasi DB Quality',
    file: 'tests/tw_plugin_and_simulasi_db.test.ts',
    desc: 'Bug A: larangan plugin class (scrollbar-hide dll) & alternatif CSS custom. Bug B: perbaikan semantik kerusakan fisik (bukan jalan) & konsistensi skala nominal deposit vs tagihan'
  },
  {
    id: 15,
    name: 'Actor Classification & Semantic Owner Role Resolution',
    file: 'tests/actor_classification_and_owner_role.test.ts',
    desc: 'Klasifikasi Pelaku (Pengguna Sistem vs Entitas Data), sub-step klarifikasi Bagian A, filter Bagian B, resolusi ownerRole AI alur, Skema Data tanpa kredensial, & Simulasi DB tanpa akun demo entitas'
  },
  {
    id: 16,
    name: 'Bug 1a (Dangling Config Reference) & Bug 1b (ownerRole Priority)',
    file: 'tests/bug1a_and_1b_fix.test.ts',
    desc: 'Bug 1a: deteksi DANGLING_CONFIG_REFERENCE & resilient canEditCurrentTab multi-role. Bug 1b: eliminasi pelimpahan tugas salah pada ENTITAS_DATA & kepastian ownerRole di terdaftar_oleh'
  },
  {
    id: 17,
    name: 'Fitur Baru: Pertanyaan Variasi Produk/Layanan & Nilai Katalog Simulasi DB',
    file: 'tests/product_variant_question.test.ts',
    desc: 'Pertanyaan variasi produk di awal alur (SEBELUM klarifikasi aktor), append narasi untuk heuristik Bagian D (3 Lapis), default Tunggal, skip transaksional/CRM, & nilai varian riil di Simulasi DB'
  },
  {
    id: 18,
    name: 'Skema Laundry Tab Repair (& chars) & Tailwind active: Variant Cleanup',
    file: 'tests/laundry_schema_tabs_and_tailwind_active.test.ts',
    desc: 'Auto-repair non-blocking untuk peran dengan karakter khusus (&, /, -, ()), bracket depth balancing, dan pembersihan otomatis variant active:*/disabled:* dengan alternatif CSS :active'
  }
];

let passed = 0;
let failed = 0;
const startTime = Date.now();

for (const t of testFiles) {
  process.stdout.write(`[${t.id}/${testFiles.length}] Menjalankan: ${t.name}... `);
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
