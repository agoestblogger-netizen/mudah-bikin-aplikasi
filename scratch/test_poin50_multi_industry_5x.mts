// Helper membaca SSE stream dari /api/generate
async function fetchStreamReply(promptText: string, history: any[] = [], ip: string = '127.0.0.1'): Promise<string> {
  const res = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip
    },
    body: JSON.stringify({
      prompt: promptText,
      chatHistory: history,
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const bodyText = await res.text();
  let accumulatedText = '';
  let finalDoneText = '';

  const lines = bodyText.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
      try {
        const json = JSON.parse(line.substring(6));
        if (json.type === 'chunk' && json.text) {
          accumulatedText += json.text;
        } else if (json.type === 'done' && json.replyText) {
          finalDoneText = json.replyText;
        }
      } catch (_) {}
    }
  }

  return finalDoneText || accumulatedText;
}

interface TestResult {
  industry: string;
  trial: number;
  prompt: string;
  adminConsolidated: boolean;
  variantsPreserved: boolean;
  noRedundantOffer: boolean;
  passed: boolean;
  extractedRolesSnippet: string;
}

async function run5xTest() {
  console.log('=== TEST POIN 50: MULTI-INDUSTRY 5X REPETITION VERIFICATION (15 TRIALS) ===\n');

  const testScenarios = [
    {
      industry: 'Healthcare (Klinik)',
      prompt: 'Aplikasi klinik dokter umum dan dokter gigi',
      expectedVariants: ['Dokter Umum', 'Dokter Gigi']
    },
    {
      industry: 'Service (Laundry)',
      prompt: 'Aplikasi laundry dengan kasir, washer kiloan, dan washer satuan',
      expectedVariants: ['Washer Kiloan', 'Washer Satuan']
    },
    {
      industry: 'Retail & POS',
      prompt: 'Aplikasi toko retail dengan kasir toko fisik dan admin online shop',
      expectedVariants: ['Kasir Toko Fisik', 'Admin Online Shop']
    }
  ];

  const results: TestResult[] = [];
  let ipCounter = 1;

  for (const sc of testScenarios) {
    console.log(`\n============================================================`);
    console.log(` Pengujian Industri: ${sc.industry} (5 Percobaan)`);
    console.log(` Prompt: "${sc.prompt}"`);
    console.log(` Expected Variants: ${sc.expectedVariants.join(', ')}`);
    console.log(`============================================================\n`);

    for (let trial = 1; trial <= 5; trial++) {
      const clientIp = `10.0.${ipCounter}.${trial}`;
      ipCounter++;
      process.stdout.write(`- Menjalankan Percobaan #${trial}... `);
      const reply = await fetchStreamReply(sc.prompt, [], clientIp);

      if (!reply || reply.length < 50) {
        console.log(`❌ FAIL (Response kosong / Error API: ${reply})`);
        results.push({
          industry: sc.industry,
          trial,
          prompt: sc.prompt,
          adminConsolidated: false,
          variantsPreserved: false,
          noRedundantOffer: false,
          passed: false,
          extractedRolesSnippet: 'EMPTY_RESPONSE'
        });
        continue;
      }

      // 1. Cek Konsolidasi Admin (tidak ada hierarki bertingkat Owner + Manager + Admin sekaligus)
      const hasBothOwnerAndManager = /\bOwner\b/i.test(reply) && /\bManager\b/i.test(reply) && /\bAdmin\b/i.test(reply);
      const adminConsolidated = !hasBothOwnerAndManager;

      // 2. Cek Varian Eksplisit Tetap Utuh Terpisah
      const variantsPreserved = sc.expectedVariants.every(v => {
        const regex = new RegExp(v.replace(/\s+/g, '\\s+'), 'i');
        return regex.test(reply);
      });

      // 3. Cek Anti-Redundan (Poin 48): Jika di dalam DAFTAR USULAN PERAN (sebelum pertanyaan/penutup) SUDAH ADA role Admin/Owner/Manager,
      // maka DILARANG ada paragraf tawaran Admin ("Selain peran ... butuh 1 role Admin") di bawahnya.
      const roleListSection = reply.split(/(?:Selain\s+(?:itu|peran|role)|Apakah\s+pembagian|Apakah\s+Brief)/i)[0] || '';
      const hasAdminInRoleList = /(?:\d+[\.\)]|[\*\-])\s*(?:\*\*)?(?:Role\s+)?(?:Admin|Super\s*Admin|Owner|Manager)\b/i.test(roleListSection);
      
      const hasRedundantOffer = hasAdminInRoleList && /(?:Selain\s+(?:itu|peran|role)[^\n]*?(?:butuh|menambahkan|perlu|sangat\s+berguna)[^\n]*?(?:role\s+)?(?:admin|super\s*admin)[^\n]*?\?)/i.test(reply);
      const noRedundantOffer = !hasRedundantOffer;

      const passed = adminConsolidated && variantsPreserved && noRedundantOffer;

      // Ambil cuplikan daftar peran
      const roleLines = reply.split('\n').filter(l => /(?:\d+[\.\)]|[\*\-])\s*(?:\*\*)?(?:Role\s+)?[A-Za-z]/i.test(l)).slice(0, 5).join(' | ');

      results.push({
        industry: sc.industry,
        trial,
        prompt: sc.prompt,
        adminConsolidated,
        variantsPreserved,
        noRedundantOffer,
        passed,
        extractedRolesSnippet: roleLines || reply.slice(0, 120).replace(/\n/g, ' ')
      });

      if (passed) {
        console.log(`✅ PASS (Admin: OK, Varian: OK, Anti-Redundan: OK)`);
      } else {
        console.log(`❌ FAIL (Consolidated: ${adminConsolidated}, Variants: ${variantsPreserved}, Anti-Redundant: ${noRedundantOffer})`);
      }
    }
  }

  console.log('\n\n============================================================');
  console.log('📊 REKAPITULASI HASIL 15 PERCOBAAN (3 INDUSTRI x 5 REPETISI)');
  console.log('============================================================\n');

  console.table(results.map(r => ({
    Industri: r.industry,
    'Trial #': r.trial,
    'Admin 1-Role': r.adminConsolidated ? '✅ Ya' : '❌ Berlapis',
    'Varian Terjaga': r.variantsPreserved ? '✅ Utuh' : '❌ Hilang/Digabung',
    'Anti-Redundan': r.noRedundantOffer ? '✅ Bersih' : '❌ Redundan',
    Status: r.passed ? '✅ PASS' : '❌ FAIL'
  })));

  const totalPass = results.filter(r => r.passed).length;
  console.log(`\nTOTAL KELULUSAN: ${totalPass} / ${results.length} (${((totalPass / results.length) * 100).toFixed(1)}%)`);

  if (totalPass === results.length) {
    console.log('🎉 100% KONSISTENSI TERCAPAI PADA SEMUA INDUSTRI!');
  } else {
    console.error('⚠️ MASIH ADA KEGAGALAN — PERIKSA DETAIL PERCOBAAN DI ATAS.');
    process.exit(1);
  }
}

run5xTest().catch(console.error);
