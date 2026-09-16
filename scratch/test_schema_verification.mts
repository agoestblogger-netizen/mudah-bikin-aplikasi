import fs from 'fs';
import path from 'path';

// Baca .env.local manual
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

import {
  generateDataSchemaWithAI,
  reviseDataSchemaWithAI,
  extractTablesAndCorrelationFromParsed
} from '../src/app/api/guided/route';

async function verifySchemaImprovements() {
  console.log('================================================================');
  console.log('🧪 VERIFIKASI GROUNDING SKEMA DATA & PARSER NORMALIZATION');
  console.log('================================================================\n');

  // 1. TEST PARSER TEMUAN C: RAW JSON ARRAY LANGSUNG
  console.log('--- TEST 1: PARSER ROBUST DENGAN ARRAY MENTAH [...] ---');
  const rawArrayJson = [
    {
      nama: 'murid',
      keterangan: 'Data murid kursus musik',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID unik murid' },
        { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama lengkap murid' },
        { nama: 'telepon', tipe: 'text', keterangan: 'Nomor telepon' },
        { nama: 'instrumen_favorit', tipe: 'text', keterangan: 'Pilihan instrumen favorit' }
      ]
    },
    {
      nama: 'pendaftaran_kursus',
      keterangan: 'Pendaftaran paket kursus musik',
      field: [
        { nama: 'id', tipe: 'text', keterangan: 'ID pendaftaran' },
        { nama: 'murid_id', tipe: 'relasi ke murid', keterangan: 'Relasi ke murid' },
        { nama: 'paket_kursus', tipe: 'text', keterangan: 'Paket kursus musik yang dipilih (Piano/Gitar/Drum)' }
      ]
    }
  ];

  console.log('Raw input JSON structure (Array langsung):', JSON.stringify(rawArrayJson).slice(0, 100) + '...');
  const extracted = await extractTablesAndCorrelationFromParsed(rawArrayJson, 'murid terhubung ke pendaftaran');
  if (extracted && extracted.tables.length === 2) {
    console.log('✅ [PASS] Parser berhasil mengekstrak 2 tabel dari Array JSON langsung!');
    console.log('Tabel diekstrak:', extracted.tables.map(t => t.nama));
    console.log('Field di murid:', extracted.tables[0].field.map(f => f.nama));
  } else {
    console.error('❌ [FAIL] Parser gagal mengekstrak array langsung!');
  }

  // 2. TEST REVISI SKEMA DATA DENGAN AI
  console.log('\n--- TEST 2: REVISE DATA SCHEMA DENGAN KOREKSI TAMBAH FIELD ---');
  const mockSession: any = {
    roles: { selected: ['Super Admin', 'Instruktur Musik', 'Murid'] },
    dataSchema: {
      tabel: [
        {
          nama: 'murid',
          keterangan: 'Data murid kursus musik',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID unik murid' },
            { nama: 'nama_lengkap', tipe: 'text', keterangan: 'Nama lengkap murid' }
          ]
        },
        {
          nama: 'jadwal',
          keterangan: 'Jadwal les',
          field: [
            { nama: 'id', tipe: 'text', keterangan: 'ID jadwal' },
            { nama: 'hari', tipe: 'text', keterangan: 'Hari les' }
          ]
        }
      ],
      korelasiRingkas: 'murid memiliki jadwal'
    }
  };

  const reviseRes = await reviseDataSchemaWithAI(
    mockSession,
    'Tambahkan field instrumen_pilihan pada tabel murid',
    'openai',
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  );

  const muridTable = reviseRes.tabel.find(t => t.nama === 'murid');
  const hasNewField = muridTable?.field.some(f => f.nama.includes('instrumen'));
  console.log('Tabel murid setelah revisi:', muridTable?.field.map(f => f.nama));
  if (hasNewField) {
    console.log('✅ [PASS] Koreksi skema data BERHASIL diterapkan ke session.dataSchema.tabel!');
  } else {
    console.error('❌ [FAIL] Field baru belum berhasil ditambahkan ke tabel murid!');
  }

  // 3. TEST GENERATE DATA SCHEMA KURSUS MUSIK PENUH
  console.log('\n--- TEST 3: GENERATE DATA SCHEMA PENUH KURSUS MUSIK DENGAN GROUNDING ALUR ---');
  const sessionKursusMusik: any = {
    step: 'SKEMA_DATA',
    match: {
      businessCategory: 'Kursus Musik',
      tier: 'BASIC',
      templateId: 'general_service'
    },
    storyline: {
      narasi: 'Aplikasi pengelolaan kursus musik untuk pencatatan murid, penugasan instruktur, jadwal les, dan pemantauan pembayaran kursus.',
      asumsiMasalah: 'Jadwal les sering bentrok dan pencatatan pembayaran murid masih manual.',
      asumsiAlurUtama: 'Pendaftaran Murid & Pemilihan Paket Kursus -> Penentuan Jadwal & Instruktur -> Pelaksanaan Les -> Pembayaran SPP Bulanan'
    },
    roles: {
      selected: ['Super Admin', 'Instruktur Musik', 'Murid', 'Petugas Admin'],
      wajib: ['Super Admin'],
      tambahan: ['Instruktur Musik', 'Murid', 'Petugas Admin']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Murid', aksi: 'Mendaftar & memilih paket kursus musik (misal: Piano, Gitar, Drum, Vokal)' },
        { step: 2, pelaku: 'Petugas Admin', aksi: 'Menentukan jadwal kelas dan menugaskan instruktur musik' },
        { step: 3, pelaku: 'Instruktur Musik', aksi: 'Mengisi absensi kehadiran dan materi pembelajaran les' },
        { step: 4, pelaku: 'Super Admin', aksi: 'Menerima pembayaran SPP kursus dan mencetak kuitansi' }
      ],
      alurPendukung: [
        {
          nama: 'Pendaftaran & Penjadwalan Kursus',
          steps: [
            { pelaku: 'Petugas Admin', aksi: 'Memverifikasi ketersediaan ruangan studio musik dan jadwal instruktur' }
          ]
        }
      ],
      fiturPendukung: [
        'Pencatatan Pilihan Instrumen & Paket Kursus (Gitar, Piano, Vokal, Drum)',
        'Manajemen Jadwal Les Mingguan & Ruangan Studio',
        'Kartu SPP & Bukti Pembayaran Digital',
        'Log Materi & Catatan Progres Murid'
      ]
    },
    rbac: {
      modul: [
        {
          nama: 'Manajemen Staf & Instruktur',
          deskripsiFungsional: 'Kelola data instruktur dan akun admin'
        },
        {
          nama: 'Jadwal & Absensi Les',
          deskripsiFungsional: 'Pengaturan jadwal les mingguan dan absensi murid'
        },
        {
          nama: 'Pendaftaran & SPP',
          deskripsiFungsional: 'Pendaftaran paket kursus baru dan pembayaran biaya SPP'
        }
      ]
    }
  };

  const schemaRes = await generateDataSchemaWithAI(
    sessionKursusMusik,
    'openai',
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  );

  console.log('\nTabel Hasil Generate Kursus Musik:');
  schemaRes.tabel.forEach(t => {
    console.log(`- Tabel "${t.nama}":`);
    t.field.forEach(f => {
      console.log(`    * ${f.nama} (${f.tipe}) - ${f.keterangan}`);
    });
  });

  const allFieldNames = schemaRes.tabel.flatMap(t => t.field.map(f => `${t.nama}.${f.nama} (${f.keterangan})`));
  const hasCourseOrPackage = allFieldNames.some(f => /paket|kursus|instrumen|jenis/i.test(f));
  if (hasCourseOrPackage) {
    console.log('\n✅ [PASS] Grounding Berhasil! Ditemukan field spesifik paket/jenis kursus:');
    allFieldNames.filter(f => /paket|kursus|instrumen|jenis/i.test(f)).forEach(f => console.log('   ->', f));
  } else {
    console.error('\n❌ [FAIL] Belum ditemukan field paket/jenis kursus di skema!');
  }
}

verifySchemaImprovements();
