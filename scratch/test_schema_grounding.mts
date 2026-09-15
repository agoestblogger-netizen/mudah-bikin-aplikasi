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

import { generateDataSchemaWithAI } from '../src/app/api/guided/route';

async function testKursusMusikSchema() {
  console.log('=== TEST GENERATE DATA SCHEMA KURSUS MUSIK ===\n');

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
        { step: 1, pelaku: 'Murid', aksi: 'Mendaftar & memilih paket kursus' },
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

  const res = await generateDataSchemaWithAI(
    sessionKursusMusik,
    'openai',
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL || 'gpt-4o-mini'
  );

  console.log('Result Tables:');
  res.tabel.forEach(t => {
    console.log(`\nTabel: ${t.nama} (${t.keterangan || ''})`);
    t.field.forEach(f => {
      console.log(`  - ${f.nama} (${f.tipe}): ${f.keterangan}`);
    });
  });

  console.log('\nKorelasi:', res.korelasiRingkas);

  // Cek apakah ada field yang mewakili "paket kursus" / "jenis kursus" / "instrumen"
  const allFieldNames = res.tabel.flatMap(t => t.field.map(f => `${t.nama}.${f.nama} (${f.keterangan})`));
  const hasCourseType = allFieldNames.some(f => /paket|jenis|instrumen|kategori|kursus/i.test(f));
  console.log('\nField jenis/paket kursus terdeteksi?', hasCourseType);
  if (!hasCourseType) {
    console.log('❌ TIDAK DITEMUKAN FIELD JENIS/PAKET KURSUS!');
  } else {
    console.log('Matching fields:', allFieldNames.filter(f => /paket|jenis|instrumen|kategori|kursus/i.test(f)));
  }
}

testKursusMusikSchema();
