import assert from 'assert';
import {
  assessPrdReadinessAndClarificationWithAI,
  generateProductRequirementsDocumentWithAI,
  revisePrdWithAI
} from '../src/app/api/guided/route';
import {
  renderPrdMarkdown,
  buildPrdStep
} from '../src/lib/templates/processes/guided';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

async function runPrdTests() {
  console.log('--- TEST 1: PRD Generator menghasilkan dokumen lengkap dengan Dua Lapis Analisis & Standard Tech Stack ---');
  {
    const sessionRental: MockupSessionState = {
      step: 'PRD',
      match: {
        templateId: 'MT-21',
        overlayIds: [],
        patternIds: [],
        tier: 'BASIC',
        businessCategory: 'Rental Sepeda'
      },
      storyline: {
        narasi: 'Pelanggan menyewa sepeda di counter, staf memeriksa ketersediaan dan mencatat data penyewa beserta uang jaminan deposit. Saat kembali sepeda diperiksa kondisinya.',
        asumsiMasalah: 'Pencatatan manual membuat ketersediaan sepeda tidak jelas dan sering bolak-balik bertanya.',
        asumsiAktor: ['Super Admin', 'Staf Kasir', 'Penyewa Sepeda'],
        asumsiAlurUtama: 'Penyewa datang -> Staf catat sewa -> Bayar deposit -> Pakai sepeda -> Pengembalian & cek fisik unit',
        statusKonfirmasi: 'disetujui'
      },
      roles: {
        selected: ['Super Admin', 'Staf Kasir', 'Penyewa Sepeda'],
        wajib: ['Super Admin', 'Staf Kasir'],
        tambahan: ['Penyewa Sepeda']
      },
      flow: {},
      painPoints: { selected: [] },
      features: { selected: [] }
    };

    // 1. Uji Evaluasi Kesiapan (Readiness Check)
    const readiness = await assessPrdReadinessAndClarificationWithAI(sessionRental);
    assert.strictEqual(typeof readiness.isReady, 'boolean');

    // 2. Uji Generator Dokumen PRD
    const prd = await generateProductRequirementsDocumentWithAI(sessionRental);
    assert.ok(prd, 'PRD harus terdefinisi');
    assert.ok(prd.overview.namaAplikasi, 'Nama aplikasi harus terisi');
    assert.strictEqual(prd.overview.domainBisnis, 'Rental Sepeda');
    assert.ok(prd.overview.ruangLingkup.termasuk.length > 0, 'Ruang lingkup harus ada item');

    // Verifikasi First Win & Nilai Unggul
    assert.ok(prd.overview.kemenanganPertamaPengguna, 'First win harus terisi');

    // Verifikasi Tech Stack Baku (Standard Module Stack)
    assert.ok(prd.techStack.frontend.includes('Vue.js'), 'Frontend harus Vue.js');
    assert.ok(prd.techStack.backend.includes('Google Apps Script'), 'Backend harus Apps Script');
    assert.ok(prd.techStack.database.includes('Google Sheets'), 'Database harus Google Sheets');
    assert.ok(prd.techStack.hosting.includes('Google Apps Script Web App'), 'Hosting harus Apps Script Web App');

    // Verifikasi Domain Profile Terintegrasi ke PRD
    assert.ok(prd.domainProfile, 'domainProfile harus tersemat di PRD');
    assert.strictEqual(prd.domainProfile.adaJaminanDeposit, true, 'Deposit harus bernilai true untuk rental sepeda');

    // Verifikasi Markdown Representation
    const md = renderPrdMarkdown(prd);
    assert.ok(md.includes('# PRODUCT REQUIREMENTS DOCUMENT (PRD)'));
    assert.ok(md.includes('### 1. Ringkasan Eksekutif'));
    assert.ok(md.includes('### 2. Karakteristik & Batasan Domain'));
    assert.ok(md.includes('### 3. Arsitektur Sistem & Tech Stack'));
    assert.ok(md.includes('Google Apps Script'));
    assert.ok(md.includes('Google Sheets'));

    // 3. Uji Step Card Builder untuk PRD
    sessionRental.prd = prd;
    const stepCard = buildPrdStep(sessionRental);
    assert.strictEqual(stepCard.stepId, 'PRD');
    assert.strictEqual(stepCard.options.length, 2);
    assert.strictEqual(stepCard.options[0].id, 'confirm_prd');
    assert.strictEqual(stepCard.options[1].id, 'koreksi_prd');

    console.log('✅ PASS: PRD Rental Sepeda berhasil dibentuk dan memenuhi seluruh standar');
  }

  console.log('\n--- TEST 2: PRD Generator untuk domain Non-Komersial (Peminjaman Ruangan) mengunci non-finansial ---');
  {
    const sessionRuangan: MockupSessionState = {
      step: 'PRD',
      match: {
        templateId: 'MT-21',
        overlayIds: [],
        patternIds: [],
        tier: 'BASIC',
        businessCategory: 'Peminjaman Ruangan Kantor'
      },
      storyline: {
        narasi: 'Karyawan mengajukan peminjaman ruangan meeting internal kantor. Staf GA memverifikasi ketersediaan jadwal ruangan dan menyetujui peminjaman tanpa ada pungutan biaya apapun.',
        asumsiMasalah: 'Jadwal pemakaian ruangan sering bentrok karena masih dicatat di papan tulis manual.',
        asumsiAktor: ['Super Admin', 'Staf GA', 'Pemohon Ruangan'],
        asumsiAlurUtama: 'Pemohon ajukan form -> Staf GA verifikasi ketersediaan -> GA setujui peminjaman -> Ruangan digunakan',
        statusKonfirmasi: 'disetujui'
      },
      roles: {
        selected: ['Super Admin', 'Staf GA', 'Pemohon Ruangan'],
        wajib: ['Super Admin', 'Staf GA'],
        tambahan: ['Pemohon Ruangan']
      },
      flow: {},
      painPoints: { selected: [] },
      features: { selected: [] }
    };

    const prd = await generateProductRequirementsDocumentWithAI(sessionRuangan);
    assert.ok(prd);
    assert.strictEqual(prd.domainProfile.adaJaminanDeposit, false);
    assert.strictEqual(prd.domainProfile.komponenBiayaYangLazim.length, 0);

    const md = renderPrdMarkdown(prd);
    assert.ok(md.includes('Peminjaman Ruangan Kantor'));
    assert.ok(md.includes('Murni Non-Finansial'));

    console.log('✅ PASS: PRD Peminjaman Ruangan Kantor berhasil mengunci non-finansial');
  }

  console.log('\n🎉 ALL PRD PHASE 1 TESTS PASSED SUCCESSFULLY!');
}

runPrdTests().catch((err) => {
  console.error('❌ PRD Test Error:', err);
  process.exit(1);
});
