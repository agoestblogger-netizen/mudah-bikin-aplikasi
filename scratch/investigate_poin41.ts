/**
 * INVESTIGASI POIN 41 — Cek HTML mentah "Antrian Klinik Cerdas"
 * Tujuan: lihat tab-btn asli, data-access-roles-nya, dan simulasi filterTabsByRole()
 */

async function investigateAntrianKlinik() {
  console.log('=== INVESTIGASI POIN 41: Antrian Klinik Cerdas ===\n');

  const brief = `📋 **Brief Kebutuhan**
- **Nama App**: Antrian Klinik Cerdas
- **Orientasi UI**: Desktop-first
- **Tema Visual**: Biru medis modern
- **Fitur Utama (V1)**:
  1. Manajemen Antrian Klinik
  2. Status Pemeriksaan
  3. Manajemen Layanan
- **Job Description & Struktur Halaman per Role** (Mekanisme Akses: Login demo Dokter, Staf Klinik + Akses Publik Pasien):
  * **Dokter**:
    - Pemeriksaan (default): section Pasien Menunggu, section Input Diagnosa & Resep
  * **Staf Klinik**:
    - Antrian (default): section Daftar Antrian, section Panggil/Selesaikan Antrian
    - Layanan: section Master Layanan, section Tarif
  * **Pasien** (Publik):
    - Status (default): section Input No. Antrian, section Status & Estimasi`;

  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ya sudah sesuai dan pas, buatkan aplikasinya sekarang',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi antrian klinik dengan role Dokter, Staf Klinik, dan Pasien' },
        { sender: 'AI', text: brief },
        { sender: 'USER', text: 'ya sudah sesuai dan pas, buatkan aplikasinya sekarang' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const json = await res.json();
  if (!json.success) {
    console.error('Generate GAGAL:', json.error);
    return;
  }

  const html: string = json.code?.html || '';
  console.log(`HTML length: ${html.length} chars\n`);

  // === CEK 1: Tab-btn dengan data-access-roles (markup asli) ===
  console.log('=== CEK 1: MARKUP TAB-BTN ASLI ===');
  const tabBtnRegex = /<button[^>]*class=[^>]*tab-btn[^>]*>/gi;
  const tabBtns = [...html.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*>([^<]*)<\/button>/gi)];
  
  if (tabBtns.length === 0) {
    // Coba tanpa closing tag
    const openTagOnly = [...html.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*>/gi)];
    console.log(`Total tab-btn ditemukan: ${openTagOnly.length}`);
    openTagOnly.forEach((m, i) => {
      const tag = m[0];
      const hasAccessRoles = tag.includes('data-access-roles');
      const rolesMatch = tag.match(/data-access-roles=["']([^"']+)["']/);
      console.log(`\nTab ${i+1}: ${tag.substring(0, 120)}`);
      console.log(`  data-access-roles: ${hasAccessRoles ? (rolesMatch?.[1] || 'ADA tapi kosong?') : '❌ TIDAK ADA'}`);
    });
  } else {
    console.log(`Total tab-btn dengan teks: ${tabBtns.length}`);
    tabBtns.forEach((m, i) => {
      const tag = m[0];
      const label = m[1]?.trim();
      const hasAccessRoles = tag.includes('data-access-roles');
      const rolesMatch = tag.match(/data-access-roles=["']([^"']+)["']/);
      console.log(`\nTab ${i+1} — Label: "${label}"`);
      console.log(`  Markup: ${tag.substring(0, 150)}`);
      console.log(`  data-access-roles: ${hasAccessRoles ? (rolesMatch?.[1] || 'ADA tapi kosong?') : '❌ TIDAK ADA'}`);
    });
  }

  // === CEK 2: Apakah filterTabsByRole() ada di JS? ===
  console.log('\n=== CEK 2: KEBERADAAN FUNGSI filterTabsByRole() ===');
  const hasFilterFunc = html.includes('filterTabsByRole');
  console.log(`filterTabsByRole ada di HTML: ${hasFilterFunc ? '✅ YA' : '❌ TIDAK'}`);
  
  if (hasFilterFunc) {
    const filterFuncMatch = html.match(/function\s+filterTabsByRole\s*\([^)]*\)\s*\{([^}]*)\}/s);
    if (filterFuncMatch) {
      console.log(`Isi fungsi:\n${filterFuncMatch[0]}`);
    }
  }

  // === CEK 3: Apakah loginAs() memanggil filterTabsByRole()? ===
  console.log('\n=== CEK 3: loginAs() MEMANGGIL filterTabsByRole()? ===');
  const loginAsFuncMatch = html.match(/function\s+loginAs\s*\([^)]*\)\s*\{([\s\S]*?)(?=\n\s*function |\n\s*(?:const|let|var) |\n\s*\/\/\s*─|$)/);
  if (loginAsFuncMatch) {
    const body = loginAsFuncMatch[1];
    console.log(`loginAs() body:\n${body.substring(0, 600)}`);
    console.log(`\nMemanggil filterTabsByRole(): ${body.includes('filterTabsByRole') ? '✅ YA' : '❌ TIDAK'}`);
    console.log(`Memanggil render(): ${body.includes('render()') ? '✅ YA' : '❌ TIDAK'}`);
  } else {
    console.log('loginAs() function tidak ditemukan atau polanya berbeda');
    // Coba cari dengan pola berbeda
    const altMatch = html.match(/loginAs\s*=\s*function\s*\([^)]*\)\s*\{([\s\S]*?)(?=\})/);
    if (altMatch) {
      console.log(`loginAs (arrow/expression) body:\n${altMatch[1].substring(0, 400)}`);
    }
  }

  // === CEK 4: Simulasi filterTabsByRole() per role ===
  console.log('\n=== CEK 4: SIMULASI filterTabsByRole() PER ROLE ===');
  const allTabBtnTags = [...html.matchAll(/<button[^>]*class=[^>]*tab-btn[^>]*>/gi)];
  const roles = ['Dokter', 'Staf Klinik', 'Pasien'];
  
  roles.forEach(role => {
    console.log(`\nRole: "${role}"`);
    let visibleCount = 0;
    let hiddenCount = 0;
    allTabBtnTags.forEach(m => {
      const tag = m[0];
      const rolesMatch = tag.match(/data-access-roles=["']([^"']+)["']/);
      if (!rolesMatch) {
        console.log(`  ⚠️ Tab tanpa data-access-roles → SELALU TERLIHAT (bug!): ${tag.substring(0, 80)}`);
        visibleCount++;
        return;
      }
      const allowed = rolesMatch[1].split(',').map((r: string) => r.trim());
      const isVisible = allowed.includes(role);
      const onclickMatch = tag.match(/onclick=["']showTab\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      const tabId = onclickMatch?.[1] || 'unknown';
      console.log(`  Tab "${tabId}" [${rolesMatch[1]}] → ${isVisible ? '✅ TERLIHAT' : '🚫 TERSEMBUNYI'}`);
      if (isVisible) visibleCount++;
      else hiddenCount++;
    });
    console.log(`  Ringkasan: ${visibleCount} terlihat, ${hiddenCount} tersembunyi`);
  });

  // === CEK 5: Apakah ada render() yang MASIH hardcode getElementById per tab? ===
  console.log('\n=== CEK 5: RENDER() MASIH HARDCODE getElementById? ===');
  const hardcodedTabFilter = [...html.matchAll(/getElementById\s*\(\s*['"]tab-btn-[^'"]+['"]\s*\)/g)];
  if (hardcodedTabFilter.length > 0) {
    console.log(`❌ MASIH ADA ${hardcodedTabFilter.length} pola hardcoded:`);
    hardcodedTabFilter.forEach(m => console.log(`  ${m[0]}`));
  } else {
    console.log('✅ Bersih dari hardcoded getElementById(tab-btn-...)');
  }

  // === CEK 6: Simpan HTML mentah untuk inspeksi manual ===
  const fs = await import('fs');
  const outputPath = '/Users/macbook/Documents/Vibecoding/mudah-bikin-aplikasi/scratch/antrian_klinik_debug.html';
  fs.writeFileSync(outputPath, html);
  console.log(`\n=== HTML mentah disimpan ke: ${outputPath} ===`);
  console.log('Buka file ini untuk inspeksi manual langsung.\n');
}

investigateAntrianKlinik().catch(console.error);
