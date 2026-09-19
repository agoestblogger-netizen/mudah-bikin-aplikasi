import { analyzeActorClassificationWithAI, generateDataSchemaWithAI } from '../src/app/api/guided/route';

async function testNarasumberTelaahLive() {
  console.log('=== TEST LIVE: NARASUMBER TELAAH (KLASIFIKASI LAPIS 2 AI & SKEMA DATA) ===\n');

  // Skenario: Lembaga Kajian Kebijakan Publik
  // Pelaku: "Narasumber Telaah" (menghindari 27 kata kerja regex Lapis 1)
  const telaahSession: any = {
    step: 'STORYTELLING',
    match: {
      templateId: 'MT-20',
      overlayIds: [],
      patternIds: [],
      tier: 'BASIC',
      businessCategory: 'Kajian Kebijakan Publik'
    },
    storyline: {
      narasi: 'Lembaga kajian kebijakan publik. Peneliti berhadapan langsung dengan Narasumber Telaah di ruang wawancara khusus guna menggali perspektif regulasi industri.',
      asumsiMasalah: 'Dokumentasi wawancara sering tercecer tanpa transkrip rapi.',
      asumsiAktor: ['Super Admin', 'Peneliti', 'Narasumber Telaah'],
      asumsiAlurUtama: 'Peneliti bersiap di bilik dialog -> Narasumber Telaah duduk berhadapan -> Peneliti mendengarkan pemaparan -> Rekaman tersimpan otomatis',
      detailAktor: {
        'Peneliti': {
          narasi: 'Tenaga ahli yang menyusun transkrip dan memantau rekaman audio.',
          tanggungJawab: ['Menghidupkan alat perekam di bilik', 'Menyusun naskah transkrip wawancara']
        },
        'Narasumber Telaah': {
          narasi: 'Tokoh pakar yang memberikan pandangan lisan saat sesi tanya jawab.',
          tanggungJawab: ['Berbicara di depan mikrofon bilik wawancara']
        }
      },
      statusKonfirmasi: 'disetujui'
    }
  };

  console.log('1. Menjalankan Klasifikasi Aktor dengan AI Live (Lapis 2 Semantik)...');
  const classificationResult = await analyzeActorClassificationWithAI(
    telaahSession,
    'openai',
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  );

  console.log('Hasil Klasifikasi:');
  for (const c of classificationResult.classifications) {
    console.log(`- ${c.actor}: [${c.category}] (confidence: ${c.confidence}, source: ${c.matchSource}) -> ${c.explanation}`);
  }

  const narasumberClass = classificationResult.classifications.find(c => c.actor === 'Narasumber Telaah');
  console.log('\nVerifikasi Narasumber Telaah:');
  console.log('Category:', narasumberClass?.category);
  console.log('MatchSource:', narasumberClass?.matchSource);

  // 2. Sekarang bawa ke Step Skema Data
  console.log('\n2. Menguji Step Skema Data untuk domain Kajian Kebijakan Publik...');
  const schemaSession: any = {
    step: 'SKEMA_DATA',
    match: {
      businessCategory: 'Kajian Kebijakan Publik',
      tier: 'BASIC',
      templateId: 'general_service'
    },
    storyline: telaahSession.storyline,
    roles: {
      selected: ['Super Admin', 'Peneliti'],
      wajib: ['Super Admin'],
      tambahan: ['Peneliti']
    },
    actorsClassification: classificationResult.classifications,
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Peneliti', aksi: 'Mendaftarkan narasumber telaah dan memilih topik kajian regulasi' },
        { step: 2, pelaku: 'Peneliti', aksi: 'Mengatur jadwal wawancara di bilik dialog khusus' },
        { step: 3, pelaku: 'Peneliti', aksi: 'Merekam sesi dialog pemaparan narasumber' },
        { step: 4, pelaku: 'Peneliti', aksi: 'Menyusun transkrip hasil telaah dan catatan analisis kebijakan' }
      ],
      fiturPendukung: [
        'Pencatatan Narasumber & Topik Kajian',
        'Jadwal Wawancara Bilik Dialog',
        'Log Rekaman Audio & Transkrip',
        'Rekap Hasil Analisis Kebijakan'
      ]
    },
    rbac: {
      modul: [
        { nama: 'Manajemen Peneliti', deskripsiFungsional: 'Kelola akun staf peneliti' },
        { nama: 'Topik & Sesi Kajian', deskripsiFungsional: 'Pengaturan topik kajian dan pendaftaran sesi wawancara' },
        { nama: 'Transkrip & Analisis', deskripsiFungsional: 'Pencatatan transkrip dan laporan analisis' }
      ]
    }
  };

  const schemaResult = await generateDataSchemaWithAI(
    schemaSession,
    'openai',
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  );

  console.log('\nHasil Tabel Skema Data Kajian Kebijakan:');
  for (const t of schemaResult.tabel) {
    console.log(`- Tabel: ${t.nama}`);
    for (const f of t.field) {
      console.log(`    * ${f.nama} (${f.tipe}) - ${f.keterangan || ''} ${f.targetRole ? `[targetRole: ${f.targetRole}]` : ''}`);
    }
  }
}

testNarasumberTelaahLive().catch(console.error);
