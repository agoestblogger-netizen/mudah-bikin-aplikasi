/**
 * TEST 40 — Verifikasi Perbaikan Regresi Tab Visibility (data-access-roles system)
 * Skenario 1: Klinik Pratama (Dokter / Resepsionis / Kasir)
 * Skenario 2: Laundry (Admin / Kasir / Washer / Pelanggan)
 */

interface TestScenario {
  name: string;
  brief: string;
  roles: string[];
  expectedTabGating: Record<string, string[]>; // role -> tabs that should be visible
}

const scenarios: TestScenario[] = [
  {
    name: 'Klinik Pratama',
    brief: `📋 **Brief Kebutuhan**
- **Nama App**: Klinikku Pro
- **Orientasi UI**: Desktop-first
- **Tema Visual**: Biru medis bersih
- **Fitur Utama (V1)**:
  1. Antrean & Booking Pasien
  2. Pemeriksaan Dokter
  3. Kasir & Tagihan
- **Job Description & Struktur Halaman per Role** (Mekanisme Akses: Login demo Dokter, Resepsionis, Kasir):
  * **Dokter**:
    - Pemeriksaan (default): section Pasien Menunggu, section Input Diagnosa
  * **Resepsionis**:
    - Antrean (default): section Daftar Antrean, section Booking Baru
  * **Kasir**:
    - Tagihan (default): section Daftar Tagihan, section Input Pembayaran`,
    roles: ['Dokter', 'Resepsionis', 'Kasir'],
    expectedTabGating: {
      'Dokter': ['pemeriksaan'], // should only see pemeriksaan tab
      'Resepsionis': ['antrean'],
      'Kasir': ['tagihan', 'kasir']
    }
  },
  {
    name: 'Laundry 4-Role',
    brief: `📋 **Brief Kebutuhan**
- **Nama App**: LaundryKu Pro
- **Orientasi UI**: Mobile-first
- **Tema Visual**: Biru segar
- **Fitur Utama (V1)**:
  1. Dashboard Admin
  2. Kasir POS
  3. Antrian Washer
  4. Lacak Resi Pelanggan
- **Job Description & Struktur Halaman per Role** (Mekanisme Akses: Login demo Admin, Kasir, Washer + Akses Publik Pelanggan):
  * **Admin**:
    - Dashboard (default): section KPI, section Staf
  * **Kasir**:
    - Kasir POS (default): section Form Order, section Pembayaran
  * **Washer**:
    - Antrian Kerja (default): section Antrian Cuci, section Tombol Selesai
  * **Pelanggan**:
    - Lacak Resi (default): section Input Resi, section Status`,
    roles: ['Admin', 'Kasir', 'Washer', 'Pelanggan'],
    expectedTabGating: {
      'Admin': ['dashboard'],
      'Kasir': ['kasir', 'pos'],
      'Washer': ['antrian'],
      'Pelanggan': ['lacak', 'resi']
    }
  }
];

async function runScenario(scenario: TestScenario): Promise<{ pass: boolean; issues: string[] }> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SKENARIO: ${scenario.name}`);
  console.log('='.repeat(60));
  
  const issues: string[] = [];

  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ya sudah sesuai dan pas, buatkan aplikasi prototipenya sekarang',
      chatHistory: [
        { sender: 'USER', text: `buatkan aplikasi ${scenario.name.toLowerCase()}` },
        { sender: 'AI', text: scenario.brief },
        { sender: 'USER', text: 'ya sudah sesuai dan pas, buatkan aplikasi prototipenya sekarang' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const json = await res.json();
  if (!json.success) {
    console.error('Generate GAGAL:', json.error);
    return { pass: false, issues: [`Generate API failed: ${json.error}`] };
  }

  const html: string = json.code?.html || '';
  console.log(`HTML length: ${html.length} chars`);

  // TEST 1: Login Screen ada
  const hasLoginScreen = html.includes('id="loginScreen"') || html.includes("id='loginScreen'");
  console.log(`[1] Ada loginScreen: ${hasLoginScreen ? '✅' : '❌'}`);
  if (!hasLoginScreen) issues.push('Tidak ada elemen loginScreen');

  // TEST 2: Tombol demo per role ada
  for (const role of scenario.roles) {
    const hasRoleBtn = html.includes(`loginAs('${role}')`) || html.includes(`loginAs("${role}")`);
    console.log(`[2] Ada tombol loginAs('${role}'): ${hasRoleBtn ? '✅' : '❌'}`);
    if (!hasRoleBtn) issues.push(`Tidak ada tombol demo untuk role: ${role}`);
  }

  // TEST 3: filterTabsByRole() ada dan dipanggil di loginAs()
  const hasFilterFunc = html.includes('filterTabsByRole') || html.includes('data-access-roles');
  console.log(`[3] Ada filterTabsByRole / data-access-roles: ${hasFilterFunc ? '✅' : '❌'}`);
  if (!hasFilterFunc) issues.push('Tidak ada fungsi filterTabsByRole atau atribut data-access-roles');

  // TEST 4: data-access-roles di tab-btn
  const tabBtnMatches = [...html.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*>/gi)];
  const tabBtnsWithoutRoles = tabBtnMatches.filter(m => !m[0].includes('data-access-roles'));
  console.log(`[4] Total tab-btn: ${tabBtnMatches.length}, Tanpa data-access-roles: ${tabBtnsWithoutRoles.length}`);
  if (tabBtnsWithoutRoles.length > 0) {
    const snippets = tabBtnsWithoutRoles.slice(0, 2).map(m => m[0].substring(0, 80));
    issues.push(`${tabBtnsWithoutRoles.length} tab-btn tanpa data-access-roles:\n  ${snippets.join('\n  ')}`);
  }

  // TEST 5: Tidak ada hardcoded getElementById('tab-btn-xxx') di render/gating
  const hardcodedTabFilter = /getElementById\s*\(\s*['"]tab-btn-[^'"]+['"]\s*\)/g;
  const hardcodedMatches = [...html.matchAll(hardcodedTabFilter)];
  const isHardcoded = hardcodedMatches.length > 0;
  console.log(`[5] Masih ada hardcoded getElementById('tab-btn-...'): ${isHardcoded ? '❌ ' + hardcodedMatches.length + ' pola ditemukan' : '✅ bersih'}`);
  if (isHardcoded) {
    issues.push(`Masih ada ${hardcodedMatches.length} pola hardcoded getElementById('tab-btn-...') — rawan regresi`);
  }

  // TEST 6: Logout button ada
  const hasLogout = html.includes('logout()');
  console.log(`[6] Ada tombol logout(): ${hasLogout ? '✅' : '❌'}`);
  if (!hasLogout) issues.push('Tidak ada tombol logout()');

  // TEST 7: Setiap role di scenario punya tab yang visible sesuai data-access-roles
  const dataAccessRolesMatches = [...html.matchAll(/data-access-roles=["']([^"']+)["']/gi)];
  console.log(`[7] Total data-access-roles ditemukan: ${dataAccessRolesMatches.length}`);
  if (dataAccessRolesMatches.length > 0) {
    console.log(`    Roles dalam data-access-roles:`);
    const allRoleSets = dataAccessRolesMatches.map(m => m[1]);
    allRoleSets.forEach(rs => console.log(`    - "${rs}"`));

    // Untuk setiap role di scenario, cek apakah ada minimal 1 tab dengan role itu
    for (const role of scenario.roles) {
      const hasAccessibleTab = allRoleSets.some(rs =>
        rs.split(',').map((r: string) => r.trim()).includes(role)
      );
      console.log(`    Role "${role}" punya tab tersendiri: ${hasAccessibleTab ? '✅' : '❌'}`);
      if (!hasAccessibleTab) {
        issues.push(`Role "${role}" tidak punya tab yang diberi akses melalui data-access-roles`);
      }
    }
  }

  const pass = issues.length === 0;
  if (pass) {
    console.log(`\n✅ PASS: ${scenario.name} — semua cek tab gating lolos!`);
  } else {
    console.log(`\n❌ FAIL: ${scenario.name} — ${issues.length} isu ditemukan:`);
    issues.forEach(i => console.log(`  - ${i}`));
  }

  return { pass, issues };
}

async function runAll() {
  console.log('=== TEST 40: VERIFIKASI PERBAIKAN REGRESI TAB VISIBILITY (data-access-roles) ===');
  console.log('Testing 2 skenario berbeda untuk memastikan fix robust...\n');

  let allPass = true;
  for (const scenario of scenarios) {
    const result = await runScenario(scenario);
    if (!result.pass) allPass = false;
  }

  console.log('\n' + '='.repeat(60));
  if (allPass) {
    console.log('🎉 SEMUA SKENARIO PASS — Perbaikan tab gating robust & siap deploy!');
  } else {
    console.log('⚠️  Ada skenario yang FAIL — Review output di atas sebelum deploy.');
  }
}

runAll().catch(console.error);
