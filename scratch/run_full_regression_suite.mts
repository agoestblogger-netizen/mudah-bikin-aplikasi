import { execSync } from 'child_process';

interface TestResult {
  name: string;
  command: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  error?: string;
}

const testSuites = [
  { name: '1. Tailwind v2 Whitelist Validator & Negative Test', file: 'scratch/test_tailwind_v2_whitelist.mts' },
  { name: '2. Vue 3 AST Validators 6a, 6b, 6d (Negatif & Positif)', file: 'scratch/test_vue_validators_6a_6b_6d.mts' },
  { name: '3. Uji End-to-End Skema Asli Kursus Menyetir Mobil (Pilar 2)', file: 'scratch/test_kursus_mobil_skema_asli_validation.mts' },
  { name: '4. Dynamic Owner Role & Multi-Role Tab Gating (Pilar 1)', file: 'scratch/test_owner_role_dynamic.mts' },
  { name: '5. Vue Scaffold Pillar 1 Custom Owner Node Test', file: 'scratch/test_vue_scaffold_node.mts' },
  { name: '6. Vue.createApp Auto-Mixin Wrapper Runtime Test', file: 'scratch/test_vue_wrapper.mts' },
  { name: '7. Legacy Step 6a: checkMissingCreateBranches (Vanilla)', file: 'scratch/test_step6a_create_branch.mts' },
  { name: '8. Legacy Step 6b: checkMissingToastFeedbacks (Vanilla)', file: 'scratch/test_step6b_toast_feedback.mts' },
  { name: '9. Legacy Step 6c: checkMissingTypeBranches (Vanilla)', file: 'scratch/test_step6c_type_branch.mts' },
  { name: '10. Legacy Step 6d: checkMissingDeleteWiringAndFakeAction (Vanilla)', file: 'scratch/test_step6d_delete_action.mts' },
  { name: '11. Integrity Targeted Repair, Role Guard & Sanitasi', file: 'scratch/test_targeted_repair_integrity.mts' },
  { name: '12. UI RBAC Markdown Table & Responsive Fixes', file: 'scratch/test_poin55_rbac_ui_fixes.mts' }
];

console.log('================================================================');
console.log('🚀 MENJALANKAN FULL REGRESSION TEST SUITE (FASE 3)');
console.log('================================================================\n');

const results: TestResult[] = [];

for (const suite of testSuites) {
  const start = Date.now();
  process.stdout.write(`⏳ Menjalankan [${suite.name}]... `);
  const cmd = `npx tsx ${suite.file}`;
  try {
    execSync(cmd, { stdio: 'pipe' });
    const duration = Date.now() - start;
    console.log(`✅ PASS (${duration}ms)`);
    results.push({ name: suite.name, command: cmd, status: 'PASS', durationMs: duration });
  } catch (err: any) {
    const duration = Date.now() - start;
    console.log(`❌ FAIL (${duration}ms)`);
    results.push({
      name: suite.name,
      command: cmd,
      status: 'FAIL',
      durationMs: duration,
      error: err.stdout?.toString() || err.stderr?.toString() || err.message
    });
  }
}

console.log('\n================================================================');
console.log('📊 RINGKASAN HASIL FULL REGRESSION SUITE');
console.log('================================================================');

let passCount = 0;
let failCount = 0;

for (const r of results) {
  if (r.status === 'PASS') {
    passCount++;
    console.log(`  [PASS] ${r.name} (${r.durationMs}ms)`);
  } else {
    failCount++;
    console.log(`  [FAIL] ${r.name} (${r.durationMs}ms)`);
    if (r.error) {
      console.log(`    Detail Error: ${r.error.slice(0, 300)}`);
    }
  }
}

console.log('----------------------------------------------------------------');
console.log(`Total Suited: ${testSuites.length} | PASS: ${passCount} | FAIL: ${failCount}`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 SELURUH 12 TEST SUITE REGRESI LOLOS 100% TANPA REGRESI!');
}
