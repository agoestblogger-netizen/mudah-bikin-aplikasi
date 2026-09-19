import {
  HYPERUI_THEME_BUNDLES,
  getAllThemeBundles,
  getThemeBundleById,
  getSemanticFallbackRecommendation,
  HyperUIThemeId,
} from '../src/lib/hyperui';

console.log('========================================================================');
console.log('🧪 TEST: KURASI HYPERUI & REGISTRY BUNDEL TEMA (TAHAP 1)');
console.log('========================================================================\n');

let allPassed = true;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    allPassed = false;
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Kelengkapan Registry & Struktur 6 Bundel Tema
// -----------------------------------------------------------------------------
console.log('--- TEST 1: Kelengkapan Registry 6 Bundel Tema ---');

const expectedThemeIds: HyperUIThemeId[] = [
  'modern_minimalist',
  'corporate_formal',
  'sleek_dark',
  'warm_pastel',
  'playful_neobrutalism',
  'vibrant_saas',
];

const allBundles = getAllThemeBundles();
assert(allBundles.length === 6, `Tepat 6 bundel tema terdaftar di registry (ditemukan: ${allBundles.length})`);

for (const id of expectedThemeIds) {
  const bundle = HYPERUI_THEME_BUNDLES[id];
  assert(Boolean(bundle), `Bundel '${id}' terdaftar di HYPERUI_THEME_BUNDLES`);
  assert(Boolean(bundle?.name && bundle?.tagline && bundle?.description), `Bundel '${id}' memiliki metadata nama, tagline, dan deskripsi`);
  assert(Boolean(bundle?.palette?.primary && bundle?.palette?.background), `Bundel '${id}' memiliki definisi palet warna lengkap`);
  assert(Boolean(bundle?.classes?.card && bundle?.classes?.table && bundle?.classes?.buttonPrimary), `Bundel '${id}' memiliki utility classes Tailwind lengkap`);
  assert(
    Boolean(
      bundle?.templates?.loginCard &&
      bundle?.templates?.tabNav &&
      bundle?.templates?.statCard &&
      bundle?.templates?.table &&
      bundle?.templates?.modal &&
      bundle?.templates?.reportBanner
    ),
    `Bundel '${id}' memiliki 6 template markup terkurasi (loginCard, tabNav, statCard, table, modal, reportBanner)`
  );
}

// Fallback lookup
assert(getThemeBundleById('unknown_xyz').id === 'modern_minimalist', 'Lookup tema tidak dikenal mengembalikan fallback modern_minimalist');
assert(getThemeBundleById('corporate_formal').id === 'corporate_formal', 'Lookup tema valid mengembalikan bundel yang tepat');

// -----------------------------------------------------------------------------
// TEST 2: Validasi Sintaks Template: Murni Direktif Vue 3 (Anti-Alpine & Anti-DOM Listener)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Validasi Sintaks Template Vue 3 Murni ---');

for (const bundle of allBundles) {
  const combinedTemplates = Object.values(bundle.templates).join('\n');

  // DILARANG ADA Alpine.js directives
  const hasAlpine = /x-data|x-show|x-bind|x-on|x-if|x-for/i.test(combinedTemplates);
  assert(!hasAlpine, `Bundel '${bundle.id}' 100% bebas dari Alpine.js (x-data/x-show)`);

  // DILARANG ADA manual DOM listener / scripts di template
  const hasScript = /<script\b|addEventListener|document\.getElementById/i.test(combinedTemplates);
  assert(!hasScript, `Bundel '${bundle.id}' 100% bebas dari <script> & addEventListener manual`);

  // WAJIB mengandung pola Vue 3 direktif pada tabNav & modal
  assert(bundle.templates.tabNav.includes('v-for="tab in tabs"'), `Bundel '${bundle.id}' tabNav menggunakan v-for="tab in tabs"`);
  assert(bundle.templates.tabNav.includes('v-show="isRoleAllowed('), `Bundel '${bundle.id}' tabNav menggunakan v-show="isRoleAllowed(...)"`);
  assert(bundle.templates.tabNav.includes('@click="showTab('), `Bundel '${bundle.id}' tabNav menggunakan @click="showTab(...)"`);
  assert(bundle.templates.modal.includes('v-if="modal.isOpen"'), `Bundel '${bundle.id}' modal menggunakan v-if="modal.isOpen"`);
  assert(bundle.templates.modal.includes('@click="closeModal"'), `Bundel '${bundle.id}' modal menggunakan @click="closeModal"`);
  assert(bundle.templates.modal.includes('@click="saveData"'), `Bundel '${bundle.id}' modal menggunakan @click="saveData"`);
}

// -----------------------------------------------------------------------------
// TEST 3: Penalaran Semantik Rekomendasi Tema Berdasarkan Makna Narasi
// -----------------------------------------------------------------------------
console.log('\n--- TEST 3: Penalaran Semantik Rekomendasi Tema ---');

// Skenario A: Koperasi Simpan Pinjam (Plafon, Tenor, Bunga, Pengurus, Anggota) -> Corporate Formal
const recKoperasi = getSemanticFallbackRecommendation({
  domainName: 'Koperasi Simpan Pinjam Sejahtera',
  narrative: 'Anggota mengajukan pinjaman dengan tenor cicilan bulanan, diverifikasi oleh kasir, dan disetujui oleh pengurus dengan bunga flat tahunan.',
  roles: ['Super Admin', 'Pengurus Koperasi', 'Kasir Operasional', 'Anggota'],
});
assert(recKoperasi.recommendedThemeId === 'corporate_formal', `Koperasi Simpan Pinjam direkomendasikan corporate_formal (hasil: ${recKoperasi.recommendedThemeId})`);
assert(recKoperasi.reason.includes('struktur') || recKoperasi.reason.includes('formal') || recKoperasi.reason.includes('kredibilitas'), 'Alasan rekomendasi koperasi memuat kata kunci kredibilitas/struktur formal');

// Skenario B: Klinik Hewan & Petshop (Dokter Hewan, Perawatan, Vaksinasi) -> Warm Pastel
const recKlinik = getSemanticFallbackRecommendation({
  domainName: 'Klinik Hewan & Pet Care Harmoni',
  narrative: 'Pemilik hewan mendaftarkan kucing atau anjing untuk pemeriksaan dokter hewan, vaksinasi, dan asuhan perawatan mandi hangat.',
  roles: ['Super Admin', 'Dokter Hewan', 'Perawat', 'Pelanggan'],
});
assert(recKlinik.recommendedThemeId === 'warm_pastel', `Klinik Hewan direkomendasikan warm_pastel (hasil: ${recKlinik.recommendedThemeId})`);

// Skenario C: Rental Kamera & Komunitas Fotografi -> Playful Neobrutalism
const recRental = getSemanticFallbackRecommendation({
  domainName: 'Studio Sewa Kamera & Lensa Muda',
  narrative: 'Komunitas kreatif dan fotografer muda menyewa unit kamera mirrorless dan lensa untuk keperluan event fotografi dan clothing brand.',
  roles: ['Super Admin', 'Petugas Sewa', 'Pelanggan'],
});
assert(recRental.recommendedThemeId === 'playful_neobrutalism', `Sewa Kamera & Event Kreatif direkomendasikan playful_neobrutalism (hasil: ${recRental.recommendedThemeId})`);

// Skenario D: Platform SaaS Barbershop Online / Booking Modern -> Vibrant SaaS
const recSaas = getSemanticFallbackRecommendation({
  domainName: 'BarberFlow SaaS Booking Platform',
  narrative: 'Platform digital modern untuk reservasi antrian kapster secara real-time dengan model langganan membership digital.',
  roles: ['Super Admin', 'Kasir', 'Barber', 'Pelanggan'],
});
assert(recSaas.recommendedThemeId === 'vibrant_saas', `Barbershop Booking SaaS direkomendasikan vibrant_saas (hasil: ${recSaas.recommendedThemeId})`);

// Skenario E: Monitoring Server & IT Analytics -> Sleek Dark
const recDark = getSemanticFallbackRecommendation({
  domainName: 'Cloud Server & IoT Realtime Monitor',
  narrative: 'Developer memantau lalu lintas server cloud dan metrik performa IoT dengan sistem monitoring malam hari berkecepatan tinggi.',
  roles: ['Super Admin', 'DevOps', 'Developer'],
});
assert(recDark.recommendedThemeId === 'sleek_dark', `Monitoring Server/IoT direkomendasikan sleek_dark (hasil: ${recDark.recommendedThemeId})`);

// -----------------------------------------------------------------------------
// HASIL KESELURUHAN
// -----------------------------------------------------------------------------
console.log('\n========================================================================');
if (allPassed) {
  console.log('🎉 SEMUA TEST KURASI & REGISTRY HYPERUI LOLOS!');
  process.exit(0);
} else {
  console.error('❌ BEBERAPA TEST GAGAL!');
  process.exit(1);
}
