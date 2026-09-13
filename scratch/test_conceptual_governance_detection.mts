import {
  isGovernanceRole,
  buildKasusGandaFromSession,
  getDomainFlowDetails,
  applyGuidedAnswer
} from '../src/lib/templates/processes/guided';
import { generateSupportingFlowsAndFeaturesWithAI } from '../src/app/api/guided/route';
import { type MockupSessionState } from '../src/lib/templates/types';

async function testConceptualGovernance() {
  console.log('=== START TEST: Conceptual Governance Detection (Anti-Keyword Matching) ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. TEST KONSEPTUAL: Peran Governance dengan Nama Novel: "Komite Audit"
  console.log('--- 1. Testing Novel Governance Name: "Komite Audit" ---');
  const detailAktorAudit = {
    'Komite Audit': {
      narasi: 'Penilai independen yang mengawasi kepatuhan operasional dan menyetujui kebijakan mitigasi risiko keuangan.',
      tanggungJawab: [
        'Mengevaluasi laporan audit kepatuhan dan manajemen risiko kredit',
        'Menyetujui skema restrukturisasi pinjaman khusus dan regulasi plafon',
        'Memeriksa berita acara fisik kas opname secara berkala'
      ]
    },
    'Kasir Operasional': {
      narasi: 'Staf garis depan yang melayani transaksi simpan pinjam.',
      tanggungJawab: [
        'Melayani setoran tunai dan pencairan dana pinjaman',
        'Menghitung fisik uang brankas harian'
      ]
    }
  };

  const isGovAudit = isGovernanceRole('Komite Audit', detailAktorAudit);
  assert(isGovAudit === true, 'Komite Audit terdeteksi sebagai governance murni dari isi tanggung jawabnya');

  const sessionAudit: MockupSessionState = {
    domain: 'koperasi simpan pinjam syariah',
    step: 'ROLE',
    match: { templateId: 'tpl_koperasi', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Koperasi' },
    roles: {
      selected: ['Super Admin', 'Kasir Operasional', 'Komite Audit', 'Anggota Koperasi'],
      wajib: ['Super Admin', 'Kasir Operasional']
    },
    storyline: {
      narasi: 'Koperasi melayani pembiayaan anggota dan penerimaan simpanan sukarela.',
      asumsiAktor: ['Anggota Koperasi', 'Kasir Operasional', 'Komite Audit', 'Super Admin'],
      asumsiAlurUtama: 'Anggota mengajukan pinjaman -> Kasir memverifikasi simpanan -> Komite Audit mengevaluasi kelayakan -> Kasir mencairkan dana.',
      detailAktor: detailAktorAudit
    },
    flow: {}
  };

  const resAudit = await generateSupportingFlowsAndFeaturesWithAI(sessionAudit);
  const auditActors = resAudit.alurPendukung.flatMap(ap => ap.steps.map(s => s.pelaku));
  console.log('Aktor alur pendukung Komite Audit:', auditActors);
  assert(auditActors.includes('Komite Audit'), 'Komite Audit TERLIBAT NYATA di langkah Alur Pendukung');

  // 2. TEST KONSEPTUAL: Peran Governance dengan Nama Novel: "Badan Pengawas"
  console.log('\n--- 2. Testing Novel Governance Name: "Badan Pengawas" ---');
  const detailAktorPengawas = {
    'Badan Pengawas': {
      narasi: 'Badan otoritas tata kelola yang mengesahkan kebijakan dan mengevaluasi kesehatan organisasi.',
      tanggungJawab: [
        'Menetapkan regulasi strategis dan mengevaluasi neraca likuiditas',
        'Otorisasi restrukturisasi kredit bermasalah',
        'Verifikasi kas opname dan kepatuhan hukum'
      ]
    }
  };

  const isGovPengawas = isGovernanceRole('Badan Pengawas', detailAktorPengawas);
  assert(isGovPengawas === true, 'Badan Pengawas terdeteksi sebagai governance murni dari isi tanggung jawabnya');

  const sessionPengawas: MockupSessionState = {
    domain: 'koperasi simpan pinjam',
    step: 'ROLE',
    match: { templateId: 'tpl_koperasi', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Koperasi' },
    roles: {
      selected: ['Super Admin', 'Kasir Operasional', 'Badan Pengawas', 'Anggota Koperasi'],
      wajib: ['Super Admin', 'Kasir Operasional']
    },
    storyline: {
      narasi: 'Koperasi simpan pinjam melayani pembiayaan dan tabungan.',
      asumsiAktor: ['Anggota Koperasi', 'Kasir Operasional', 'Badan Pengawas', 'Super Admin'],
      asumsiAlurUtama: 'Anggota mengajukan pinjaman -> Kasir memproses -> Kasir mencairkan.',
      detailAktor: detailAktorPengawas
    },
    flow: {}
  };

  const resPengawas = await generateSupportingFlowsAndFeaturesWithAI(sessionPengawas);
  const pengawasActors = resPengawas.alurPendukung.flatMap(ap => ap.steps.map(s => s.pelaku));
  console.log('Aktor alur pendukung Badan Pengawas:', pengawasActors);
  assert(pengawasActors.includes('Badan Pengawas'), 'Badan Pengawas TERLIBAT NYATA di langkah Alur Pendukung');

  // 3. TEST REGRESI: "Pengurus Komite Kredit"
  console.log('\n--- 3. Testing Regression: "Pengurus Komite Kredit" ---');
  const detailAktorKredit = {
    'Pengurus Komite Kredit': {
      narasi: 'Pengambil keputusan pembiayaan dan analisis risiko plafon pinjaman anggota.',
      tanggungJawab: [
        'Menganalisis kelayakan kredit dan menyetujui restrukturisasi angsuran',
        'Mengawasi rasio pinjaman bermasalah dan audit kas brankas'
      ]
    }
  };

  const isGovKredit = isGovernanceRole('Pengurus Komite Kredit', detailAktorKredit);
  assert(isGovKredit === true, 'Pengurus Komite Kredit tetap terdeteksi sebagai governance');

  const sessionKredit: MockupSessionState = {
    domain: 'koperasi simpan pinjam',
    step: 'ROLE',
    match: { templateId: 'tpl_koperasi', overlayIds: [], patternIds: [], tier: 'standard', businessCategory: 'Koperasi' },
    roles: {
      selected: ['Super Admin', 'Kasir Operasional', 'Pengurus Komite Kredit', 'Anggota Koperasi'],
      wajib: ['Super Admin', 'Kasir Operasional']
    },
    storyline: {
      narasi: 'Koperasi simpan pinjam melayani pembiayaan.',
      asumsiAktor: ['Anggota Koperasi', 'Kasir Operasional', 'Pengurus Komite Kredit', 'Super Admin'],
      asumsiAlurUtama: 'Anggota mengajukan pinjaman -> Kasir memproses.',
      detailAktor: detailAktorKredit
    },
    flow: {}
  };

  const resKredit = await generateSupportingFlowsAndFeaturesWithAI(sessionKredit);
  const kreditActors = resKredit.alurPendukung.flatMap(ap => ap.steps.map(s => s.pelaku));
  console.log('Aktor alur pendukung Pengurus Komite Kredit:', kreditActors);
  assert(kreditActors.includes('Pengurus Komite Kredit'), 'Pengurus Komite Kredit tetap TERLIBAT NYATA');

  // 4. TEST NEGATIVE CONTROL: Role dengan kata "Pengurus" tapi tugas operasional murni ("Pengurus Gudang")
  console.log('\n--- 4. Negative Control: "Pengurus Gudang" (Operasional Murni, Bukan Governance) ---');
  const detailAktorGudang = {
    'Pengurus Gudang': {
      narasi: 'Staf operasional yang menyusun kardus barang dan membersihkan rak penyimpanan.',
      tanggungJawab: [
        'Memotong rambut dan melayani antrean', // contoh tugas fisik
        'Menyusun kardus fisik barang di rak penyimpanan',
        'Mencatat nomor resi paket barang masuk'
      ]
    }
  };

  const isGovGudang = isGovernanceRole('Pengurus Gudang', detailAktorGudang);
  assert(isGovGudang === false, 'Pengurus Gudang TIDAK terdeteksi sebagai governance karena isi tanggung jawabnya adalah operasional fisik');

  console.log(`\n=== SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

testConceptualGovernance().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
