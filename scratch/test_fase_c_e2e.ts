import { detectMatchingMasterTemplate, formatTemplateContextForIdeation, detectSelectivePageTemplates, formatSelectivePageTemplatesForCodeGen } from '../src/lib/templates';
import { validateAndRepairGeneratedCode } from '../src/lib/codeValidator';

async function testFaseCE2E() {
  console.log('=== TEST FASE C END-TO-END VERIFICATION ===\n');

  // 1. Test Ideation Matcher
  const userPrompt = 'buatkan aplikasi laundry 4 role: Admin, Kasir, Petugas/Washer, dan Pelanggan';
  const matchedMT = detectMatchingMasterTemplate(userPrompt);
  console.log('1. Matcher Output for prompt:', userPrompt);
  console.log('   - Matched MT:', matchedMT ? `${matchedMT.template.id} (${matchedMT.template.nama})` : 'None');
  console.log('   - Variant:', matchedMT?.matchedVariant || 'None');

  // 2. Test Selective Page Template Matcher from Brief
  const sampleBrief = `
📋 Brief Kebutuhan
- Nama App: CleanFlow Laundry Management
- Orientasi UI: Responsif
- Tema Visual: Modern indigo, cyan teal, clean white
- Fitur Utama (V1):
  1. Dashboard & Statistik Laundry
  2. Papan Kerja Antrian Cucian (Washer)
  3. Form Input Pesanan & Kasir POS
  4. Manajemen Tagihan & Pembayaran
  5. Cek Status Cucian Pelanggan
- Job Description & Struktur Halaman per Role:
  * Admin:
    - Dashboard (default): section Ringkasan Statistik, section Aktivitas Terkini
    - Kelola Master: section Tarif Layanan, section Data Pelanggan
  * Kasir:
    - Input Pesanan (default): section Form Order Baru, section Keranjang Layanan
    - Tagihan: section Daftar Tagihan Belum Lunas, section Pembayaran Kasir
  * Petugas / Washer:
    - Antrian Kerja (default): section Papan Antrian Cucian, section Update Status Cuci
  * Pelanggan:
    - Status Cucian (default): section Lacak Resi Cucian, section Riwayat Order
`;

  const selectivePTs = detectSelectivePageTemplates(sampleBrief);
  console.log('\n2. Selective Page Template Mapping for Brief Kebutuhan:');
  selectivePTs.forEach((pt, idx) => {
    console.log(`   ${idx + 1}. [${pt.ptId}] ${pt.pageName} -> Default Components: ${pt.template.defaultComponents.slice(0, 4).join(', ')}`);
  });

  const ptDirective = formatSelectivePageTemplatesForCodeGen(selectivePTs);
  console.log('\n3. Formatted Selective Code Gen Directive Size:');
  console.log('   - Characters:', ptDirective.length);
  console.log('   - Lines:', ptDirective.split('\n').length);
  console.log('   - Preview:\n' + ptDirective.slice(0, 400) + '...\n');

  // 4. Test actual API call to /api/generate with this confirmation
  console.log('4. Testing Real Code Generation Pipeline via API...');
  const startTime = Date.now();
  
  const response = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ok setuju buatkan prototipenya sekarang',
      stage: 'TAHAP_1_PEMBUKAAN',
      chatHistory: [
        { sender: 'USER', text: userPrompt },
        { sender: 'AI', text: sampleBrief }
      ],
      currentCode: ''
    })
  });

  const durationMs = Date.now() - startTime;
  console.log(`   - HTTP Status: ${response.status} (Elapsed: ${(durationMs / 1000).toFixed(2)}s)`);

  const result = await response.json();
  console.log('   - Success:', result.success);
  console.log('   - Code Length:', result.code?.length || 0, 'characters');
  console.log('   - AI Reply Text:', result.replyText?.slice(0, 150) + '...');

  if (result.code) {
    console.log('\n5. Validating Generated Code (NFR-10b & DOM Checks)...');
    const validation = validateAndRepairGeneratedCode(result.code, '', '');
    console.log('   - Validation Valid:', validation.isValid);
    console.log('   - Issues Found:', validation.issues);
    console.log('   - Code Length after repair:', validation.repairedCode.html.length);

    // Verify key role elements in generated HTML
    const code = validation.repairedCode.html;
    console.log('\n6. Checking Specific Role & Page Template Structures in Code:');
    console.log('   - Has switchRole function:', code.includes('switchRole'));
    console.log('   - Has role selector/tabs (Admin, Kasir, Washer/Petugas, Pelanggan):',
      code.includes('Admin') && (code.includes('Kasir') || code.includes('kasir')) && (code.includes('Washer') || code.includes('Petugas'))
    );
    console.log('   - Has Antrian/Queue card/table structure (PT-07):', code.toLowerCase().includes('antrian') || code.toLowerCase().includes('queue') || code.toLowerCase().includes('cuci'));
    console.log('   - Has Kasir/Order Form structure (PT-08):', code.toLowerCase().includes('order') || code.toLowerCase().includes('pesanan') || code.toLowerCase().includes('kasir'));
    console.log('   - Has Dashboard/Stat card structure (PT-01):', code.toLowerCase().includes('stat') || code.toLowerCase().includes('ringkasan') || code.toLowerCase().includes('dashboard'));
    console.log('   - Has Payment/Tagihan structure (PT-09):', code.toLowerCase().includes('bayar') || code.toLowerCase().includes('tagihan') || code.toLowerCase().includes('lunas'));

  }
}

testFaseCE2E().catch(console.error);
