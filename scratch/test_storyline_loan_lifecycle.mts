/**
 * Test Verifikasi: Cakupan Lengkap Siklus Pinjaman & Simpanan pada Narasi DUA_ARAH
 */

import { generateStorylineWithAI } from '../src/app/api/guided/route';
import {
  buildKasusGandaFromSession,
  REQUIRED_ROLE
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';
import fs from 'fs';

// Baca .env.local secara native
if (fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

let pass = 0;
let fail = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    pass++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    fail++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TEST 1: KOPERASI SIMPAN PINJAM (Verifikasi Bug Temuan User)');
  console.log('================================================================');

  console.log('Testing: "aplikasi koperasi simpan pinjam"...');
  const resKoperasi = await generateStorylineWithAI('aplikasi koperasi simpan pinjam');
  console.log('\n--- Hasil Storyline Koperasi ---');
  console.log('Kondisi:', resKoperasi.analisisArah?.kondisi);
  console.log('Pemisahan Role:', resKoperasi.analisisArah?.duaArah?.pemisahanRole);
  console.log('Narasi:\n', resKoperasi.narasi);
  console.log('Alur Utama:\n', resKoperasi.asumsiAlurUtama);
  console.log('Aktor:', resKoperasi.asumsiAktor);

  const fullText = (resKoperasi.narasi + ' ' + resKoperasi.asumsiAlurUtama).toLowerCase();

  // 1.1 Sisi Simpanan
  const hasSimpan = /simpan|setor|tabung/i.test(fullText);
  assert(hasSimpan, 'Mencakup sisi simpanan/setor tabungan');

  // 1.2 Sisi Pinjaman: Pengajuan & Verifikasi / Analisis
  const hasPengajuan = /aju|pengajuan|permohonan|mengajukan/i.test(fullText);
  assert(hasPengajuan, 'Mencakup proses pengajuan/permohonan pinjaman oleh anggota');

  // 1.3 Sisi Pinjaman: Pencairan / Penyaluran Dana
  const hasPencairan = /cair|pencairan|menyalurkan|penyaluran/i.test(fullText);
  assert(hasPencairan, 'Mencakup proses pencairan/penyaluran dana pinjaman, bukan cuma pelunasan cicilan');

  // 1.4 Verifikasi Alur Kasus Ganda di Step ALUR
  const sessionKoperasi: MockupSessionState = {
    step: 'STORYTELLING',
    match: { templateId: 'MT-20', overlayIds: [], patternIds: [], tier: 'MEDIUM' },
    storyline: {
      narasi: resKoperasi.narasi,
      asumsiMasalah: resKoperasi.asumsiMasalah,
      asumsiAktor: resKoperasi.asumsiAktor,
      asumsiAlurUtama: resKoperasi.asumsiAlurUtama,
      detailAktor: resKoperasi.detailAktor,
      statusKonfirmasi: 'disetujui',
      analisisArah: resKoperasi.analisisArah
    },
    roles: { selected: [REQUIRED_ROLE, ...resKoperasi.asumsiAktor] },
    flow: {
      dualFlowPreDecided: true,
      dualProcessNames: {
        processA: resKoperasi.analisisArah?.duaArah?.prosesA || 'Penerimaan Simpanan',
        processB: resKoperasi.analisisArah?.duaArah?.prosesB || 'Penyaluran Pinjaman'
      }
    }
  };

  const kasusGanda = buildKasusGandaFromSession(
    sessionKoperasi,
    sessionKoperasi.flow.dualProcessNames!.processA,
    sessionKoperasi.flow.dualProcessNames!.processB
  );

  console.log('\n--- Alur Inti Kasus A (Simpanan) ---');
  kasusGanda[0]?.alurInti.forEach((s) => console.log(`  ${s.step}. [${s.pelaku}] ${s.aksi}`));

  console.log('\n--- Alur Inti Kasus B (Pinjaman) ---');
  kasusGanda[1]?.alurInti.forEach((s) => console.log(`  ${s.step}. [${s.pelaku}] ${s.aksi}`));

  const pinjamSteps = kasusGanda[1]?.alurInti.map((s) => s.aksi).join(' ').toLowerCase();
  assert(
    /permohonan|pengajuan/i.test(pinjamSteps) && /cair|pencairan/i.test(pinjamSteps),
    'Alur Kasus Pinjaman di step ALUR memuat pengajuan pinjaman dan pencairan dana'
  );

  console.log('\n================================================================');
  console.log('TEST 2: DOMAIN LAIN KONDISI GABUNG (Money Changer, Warung Sembako)');
  console.log('================================================================');

  // 2.1 Money Changer
  console.log('\nTesting: "aplikasi money changer penukaran valas rupiah"...');
  const resMoney = await generateStorylineWithAI('aplikasi money changer penukaran valas rupiah');
  const moneyText = (resMoney.narasi + ' ' + resMoney.asumsiAlurUtama).toLowerCase();
  assert(
    resMoney.analisisArah?.duaArah?.pemisahanRole?.keputusan === 'GABUNG',
    'Money changer tetap GABUNG'
  );
  assert(
    /beli|kurs|asing/i.test(moneyText) && /jual|rupiah|valas/i.test(moneyText),
    'Money changer mencakup kedua arah penukaran valas'
  );

  // 2.2 Warung Sembako
  console.log('\nTesting: "warung sembako melayani penjualan sembako serta tukar galon dan tabung gas"...');
  const resWarung = await generateStorylineWithAI('warung sembako melayani penjualan sembako serta tukar galon dan tabung gas');
  const warungText = (resWarung.narasi + ' ' + resWarung.asumsiAlurUtama).toLowerCase();
  assert(
    resWarung.analisisArah?.duaArah?.pemisahanRole?.keputusan === 'GABUNG',
    'Warung sembako tetap GABUNG'
  );
  assert(
    /sembako/i.test(warungText) && /galon|gas/i.test(warungText),
    'Warung sembako mencakup penjualan sembako dan tukar galon/gas'
  );

  console.log('\n================================================================');
  console.log('TEST 3: DOMAIN KONDISI PISAH (Toko Motor Jual-Beli)');
  console.log('================================================================');

  console.log('Testing: "aplikasi toko jual beli sepeda motor"...');
  const resMotor = await generateStorylineWithAI('aplikasi toko jual beli sepeda motor');
  assert(
    resMotor.analisisArah?.duaArah?.pemisahanRole?.keputusan === 'PISAH',
    'Toko motor tetap PISAH (appraisal vs sales)'
  );
  const motorText = (resMotor.narasi + ' ' + resMotor.asumsiAlurUtama).toLowerCase();
  assert(
    /baru|showroom|display/i.test(motorText) && /bekas|taksir|appraisal|lama/i.test(motorText),
    'Toko motor mencakup penjualan unit baru dan pembelian motor bekas'
  );

  console.log('\n================================================================');
  console.log(`HASIL AKHIR: ${pass} PASS, ${fail} FAIL`);
  console.log('================================================================');
  if (fail > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
