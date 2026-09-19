import { generateDataSchemaWithAI } from '../src/app/api/guided/route';

async function testActorClassificationImpact() {
  console.log('=== TEST HIPOTESIS: DAMPAK KLARIFIKASI AKTOR & VARIAN PADA KURSUS MUSIK ===');

  // Skenario 1: Siswa diklasifikasikan sebagai ENTITAS_DATA (seperti alur klarifikasi aktor baru)
  const sessionWithEntityData: any = {
    step: 'SKEMA_DATA',
    match: {
      businessCategory: 'Kursus Musik',
      tier: 'BASIC',
      templateId: 'general_service'
    },
    storyline: {
      narasi: 'Aplikasi kursus musik untuk pencatatan murid, penugasan instruktur, jadwal les di studio, pemantauan pembayaran iuran murid, dan evaluasi perkembangan murid.',
      asumsiMasalah: 'Jadwal sering bentrok dan rekap perkembangan murid masih manual.',
      asumsiAlurUtama: 'Pendaftaran Murid -> Penjadwalan Studio -> Pembayaran Iuran -> Evaluasi Perkembangan Murid'
    },
    roles: {
      selected: ['Super Admin', 'Instruktur Musik', 'Petugas Admin'],
      wajib: ['Super Admin'],
      tambahan: ['Instruktur Musik', 'Petugas Admin']
    },
    actorsClassification: [
      {
        actor: 'Siswa',
        category: 'ENTITAS_DATA',
        explanation: 'Siswa adalah murid les yang didaftarkan dan dicatat oleh staf admin, tidak login ke sistem.',
        ownerRole: 'Petugas Admin'
      }
    ],
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Petugas Admin', aksi: 'Mendaftarkan siswa baru dan mencatat instrumen musik yang dipelajari' },
        { step: 2, pelaku: 'Petugas Admin', aksi: 'Mengatur jadwal studio musik dan instruktur' },
        { step: 3, pelaku: 'Petugas Admin', aksi: 'Menerima pembayaran iuran les siswa' },
        { step: 4, pelaku: 'Instruktur Musik', aksi: 'Mencatat perkembangan belajar murid di setiap sesi les' }
      ],
      fiturPendukung: [
        'Pencatatan Siswa & Instrumen',
        'Jadwal Studio Musik',
        'Pembayaran Iuran',
        'Rekap Perkembangan Murid'
      ]
    }
  };

  console.log('\nMenjalankan AI untuk Skenario 1 (Siswa = ENTITAS_DATA)...');
  const result1 = await generateDataSchemaWithAI(
    sessionWithEntityData,
    'openai',
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  );

  console.log('\nHasil Tabel Skenario 1:');
  for (const t of result1.tabel) {
    console.log(`- Tabel: ${t.nama}`);
    for (const f of t.field) {
      console.log(`    * ${f.nama} (${f.tipe}) - ${f.keterangan || ''} ${f.targetRole ? `[targetRole: ${f.targetRole}]` : ''}`);
    }
  }
}

testActorClassificationImpact().catch(console.error);
