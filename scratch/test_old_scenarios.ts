import { generateDataSchemaWithAI } from '../src/app/api/guided/route';

async function testOldScenarios() {
  console.log('=== TEST 2 SKENARIO LAMA: UJI LAB MUTU PANGAN & TAMBAL BAN ===\n');

  // 1. Uji Lab Mutu Pangan
  const sessionLabPangan: any = {
    step: 'SKEMA_DATA',
    match: { businessCategory: 'Laboratorium Pengujian Mutu Pangan', tier: 'BASIC', templateId: 'general_service' },
    storyline: {
      narasi: 'Sistem pengujian sampel laboratorium pangan. Klien mendaftarkan sampel dan memilih parameter pengujian mikrobiologi atau kimia pangan. Analis melakukan uji lab dan dokter/manajer memverifikasi hasil uji.',
      asumsiMasalah: 'Pencatatan sampel dan rekap hasil pengujian masih lambat.',
      asumsiAlurUtama: 'Pendaftaran Sampel & Pilihan Parameter Uji -> Analisis Laboratorium -> Verifikasi Hasil -> Penerbitan Sertifikat Uji'
    },
    roles: {
      selected: ['Super Admin', 'Klien Perusahaan', 'Analis Lab', 'Manajer Mutu'],
      wajib: ['Super Admin'],
      tambahan: ['Klien Perusahaan', 'Analis Lab', 'Manajer Mutu']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Klien Perusahaan', aksi: 'Mendaftarkan sampel bahan makanan dan memilih parameter uji (misal: Uji Logam Berat, Uji Bakteri E-Coli, Uji Kadar Air)' },
        { step: 2, pelaku: 'Analis Lab', aksi: 'Melakukan pengujian di laboratorium dan memasukkan nilai hasil pengukuran' },
        { step: 3, pelaku: 'Manajer Mutu', aksi: 'Memverifikasi hasil uji dan menyetujui sertifikat hasil uji' }
      ]
    }
  };

  console.log('Menjalankan AI untuk Uji Lab Mutu Pangan...');
  const resLab = await generateDataSchemaWithAI(sessionLabPangan, 'openai', process.env.OPENAI_API_KEY, 'gpt-4o-mini');
  console.log('Tabel Uji Lab Mutu Pangan:');
  for (const t of resLab.tabel) {
    console.log(`- ${t.nama} (${t.field.map(f => `${f.nama}: ${f.tipe}`).join(', ')})`);
  }

  // 2. Servis Tambal Ban
  const sessionTambalBan: any = {
    step: 'SKEMA_DATA',
    match: { businessCategory: 'Bengkel Tambal Ban', tier: 'BASIC', templateId: 'general_service' },
    storyline: {
      narasi: 'Pelanggan datang ke bengkel tambal ban saat ban bocor. Montir memeriksa kondisi kebocoran, menambal ban motor atau mobil, dan pelanggan membayar tunai di tempat.',
      asumsiMasalah: 'Pencatatan kas harian dan jumlah ban yang ditambal sering lupa dicatat.',
      asumsiAlurUtama: 'Pelanggan Datang -> Pemeriksaan & Pengerjaan Tambal -> Pembayaran Kasir Selesai'
    },
    roles: {
      selected: ['Super Admin', 'Montir Tambal Ban'],
      wajib: ['Super Admin'],
      tambahan: ['Montir Tambal Ban']
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Montir Tambal Ban', aksi: 'Memeriksa ban bocor dan mencatat nama pelanggan serta jenis kendaraan' },
        { step: 2, pelaku: 'Montir Tambal Ban', aksi: 'Menambal ban dan menerima pembayaran langsung' }
      ]
    }
  };

  console.log('\nMenjalankan AI untuk Servis Tambal Ban...');
  const resTambal = await generateDataSchemaWithAI(sessionTambalBan, 'openai', process.env.OPENAI_API_KEY, 'gpt-4o-mini');
  console.log('Tabel Servis Tambal Ban:');
  for (const t of resTambal.tabel) {
    console.log(`- ${t.nama} (${t.field.map(f => `${f.nama}: ${f.tipe}`).join(', ')})`);
  }
}

testOldScenarios().catch(console.error);
