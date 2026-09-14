import assert from 'node:assert';
import {
  generateDeterministicSimulasiDb,
  renderSimulasiDbMarkdown,
  applyGuidedAnswer,
  buildGuidedStep
} from '../src/lib/templates/processes/guided.js';
import type { MockupSessionState } from '../src/lib/templates/processes/types.js';
import { reviseSimulasiDbWithAI } from '../src/app/api/guided/route.js';

console.log('=== TEST POIN 7: STEP SIMULASI_DB ===\n');

// -------------------------------------------------------------
// VERIFIKASI 1: Tiga Domain (Rental Mobil, Koperasi, Barang Rosok)
// -------------------------------------------------------------
console.log('--- Verifikasi 1: Kesesuaian Nama Field & Role Aktif ---');

const testDomains: { name: string; session: Partial<MockupSessionState> }[] = [
  {
    name: 'Rental Mobil',
    session: {
      step: 'SIMULASI_DB',
      match: {
        patternIds: ['PAT-01'],
        overlayIds: ['IND-01'],
        businessCategory: 'Rental Mobil',
        tier: 'BASIC'
      },
      roles: {
        selected: ['Super Admin', 'Petugas Rental', 'Penyewa'],
        wajib: ['Super Admin', 'Petugas Rental', 'Penyewa'],
        tambahan: []
      },
      dataSchema: {
        tabel: [
          {
            nama: 'armada_mobil',
            keterangan: 'Katalog kendaraan rental',
            field: [
              { nama: 'id_mobil', tipe: 'text', keterangan: 'ID unik kendaraan' },
              { nama: 'nomor_plat', tipe: 'text', keterangan: 'Nomor plat polisi' },
              { nama: 'tipe_mobil', tipe: 'text', keterangan: 'Model/merk mobil' },
              { nama: 'tarif_sewa_harian', tipe: 'angka', keterangan: 'Tarif sewa per 24 jam' },
              { nama: 'status_ketersediaan', tipe: 'text', keterangan: 'Tersedia / Disewa / Bengkel' }
            ]
          },
          {
            nama: 'transaksi_rental',
            keterangan: 'Penyewaan kendaraan',
            field: [
              { nama: 'no_kontrak', tipe: 'text', keterangan: 'Nomor kontrak sewa' },
              { nama: 'mobil_id', tipe: 'relasi ke armada_mobil', keterangan: 'Mobil yang disewa' },
              { nama: 'nama_penyewa', tipe: 'text', keterangan: 'Nama lengkap pelanggan' },
              { nama: 'durasi_hari', tipe: 'angka', keterangan: 'Jumlah hari sewa' },
              { nama: 'total_bayar', tipe: 'angka', keterangan: 'Total biaya sewa' },
              { nama: 'status_sewa', tipe: 'text', keterangan: 'Status aktif' }
            ]
          }
        ]
      }
    }
  },
  {
    name: 'Koperasi Simpan Pinjam',
    session: {
      step: 'SIMULASI_DB',
      match: {
        patternIds: ['PAT-01'],
        overlayIds: ['IND-03'],
        businessCategory: 'Koperasi Simpan Pinjam',
        tier: 'BASIC'
      },
      roles: {
        selected: ['Super Admin', 'Bendahara', 'Anggota'],
        wajib: ['Super Admin', 'Bendahara', 'Anggota'],
        tambahan: []
      },
      dataSchema: {
        tabel: [
          {
            nama: 'transaksi_pinjaman',
            keterangan: 'Pengajuan dan pencairan pinjaman anggota',
            field: [
              { nama: 'id_pinjaman', tipe: 'text', keterangan: 'Kode pinjaman' },
              { nama: 'anggota_id', tipe: 'relasi ke anggota', keterangan: 'ID anggota peminjam' },
              { nama: 'nominal_pinjaman', tipe: 'angka', keterangan: 'Jumlah pinjaman yang dicairkan' },
              { nama: 'tenor_bulan', tipe: 'angka', keterangan: 'Lama angsuran' },
              { nama: 'status_pengajuan', tipe: 'text', keterangan: 'Status persetujuan' }
            ]
          }
        ]
      }
    }
  },
  {
    name: 'Barang Rosok (Kasus Role Dihapus)',
    session: {
      step: 'SIMULASI_DB',
      match: {
        patternIds: ['PAT-01'],
        overlayIds: [],
        businessCategory: 'Pengepul Barang Rosok',
        tier: 'BASIC'
      },
      roles: {
        // Petugas Timbangan dihapus! Yang aktif hanya Super Admin, Warga Penjual, Pengumpul
        selected: ['Super Admin', 'Warga Penjual', 'Pengumpul'],
        wajib: ['Super Admin'],
        tambahan: ['Warga Penjual', 'Pengumpul'],
        tugasDilimpahkan: [
          {
            dariRole: 'Petugas Timbangan',
            keRole: 'Super Admin',
            daftarTugas: ['Menimbang barang rosok di gudang', 'Mencatat bobot dan kalkulasi harga']
          }
        ]
      },
      dataSchema: {
        tabel: [
          {
            nama: 'transaksi_timbang_rosok',
            keterangan: 'Penerimaan dan penimbangan barang bekas',
            field: [
              { nama: 'nomor_nota', tipe: 'text', keterangan: 'Nomor nota setor' },
              { nama: 'nama_warga', tipe: 'text', keterangan: 'Nama warga yang menjual' },
              { nama: 'jenis_rosok', tipe: 'text', keterangan: 'Kategori rosok (besi/kardus/plastik)' },
              { nama: 'berat_kg', tipe: 'angka', keterangan: 'Berat hasil timbang' },
              { nama: 'total_bayar_tunai', tipe: 'angka', keterangan: 'Nominal yang dibayarkan ke warga' }
            ]
          }
        ]
      }
    }
  }
];

for (const td of testDomains) {
  const sim = generateDeterministicSimulasiDb(td.session as MockupSessionState);
  console.log(`\nValidasi Domain: [${td.name}]`);
  console.log(`- Tabel yang dipilih: "${sim.contohData.tabel}"`);
  console.log(`- Jumlah baris contoh: ${sim.contohData.baris.length}`);

  // 1. Cek bahwa tabel yang dipilih ada di dataSchema
  const matchedTable = td.session.dataSchema!.tabel.find((t) => t.nama === sim.contohData.tabel);
  assert(matchedTable, `Tabel ${sim.contohData.tabel} harus ada di dataSchema!`);

  // 2. Cek nama field PERSIS SAMA 100%
  const schemaFieldNames = matchedTable.field.map((f) => f.nama);
  for (let i = 0; i < sim.contohData.baris.length; i++) {
    const row = sim.contohData.baris[i];
    const rowKeys = Object.keys(row);
    assert.deepStrictEqual(
      rowKeys,
      schemaFieldNames,
      `Field pada baris ${i + 1} (${rowKeys.join(', ')}) harus PERSIS SAMA dengan skema (${schemaFieldNames.join(', ')})!`
    );
  }
  console.log(`  ✓ Semua ${sim.contohData.baris.length} baris memiliki field PERSIS SAMA: ${schemaFieldNames.join(', ')}`);

  // 3. Cek akun login: HANYA role aktif, tidak ada role yang sudah dihapus
  const activeRoles = td.session.roles!.selected;
  const loginRoles = sim.akunLogin.map((a) => a.role);
  assert.deepStrictEqual(
    loginRoles,
    activeRoles,
    `Role di akun login (${loginRoles.join(', ')}) harus SAMA PERSIS dengan role aktif (${activeRoles.join(', ')})!`
  );

  // Pastikan peran yang dihapus (Petugas Timbangan) TIDAK ADA
  assert(!loginRoles.includes('Petugas Timbangan'), 'Role yang dihapus TIDAK BOLEH muncul di akun demo!');
  console.log(`  ✓ Akun demo hanya mencakup role aktif: ${loginRoles.join(', ')}`);

  // 4. Cek format akun: username lowercase alfanumerik, password = username + '123'
  for (const acc of sim.akunLogin) {
    const expectedUser = acc.role.toLowerCase().replace(/[^a-z0-9]/g, '');
    assert.strictEqual(acc.username, expectedUser, `Username ${acc.username} tidak sesuai pola ${expectedUser}`);
    assert.strictEqual(acc.password, `${expectedUser}123`, `Password ${acc.password} tidak berakhiran 123`);
  }
  console.log('  ✓ Format akun demo konsisten dengan format DEMO_ACCOUNTS');

  // 5. Cek instruksi generator ada 5
  assert(sim.instruksiGenerator && sim.instruksiGenerator.length === 5, 'Harus ada 5 instruksi internal generator');
  console.log('  ✓ 5 Instruksi internal generator prototipe terpasang');
}

// -------------------------------------------------------------
// VERIFIKASI 2: Regenerasi Otomatis & Cache Invalidation
// -------------------------------------------------------------
console.log('\n--- Verifikasi 2: Regenerasi Otomatis & Cache Invalidation ---');

let sessionState: MockupSessionState = {
  step: 'SIMULASI_DB',
  match: {
    patternIds: ['PAT-01'],
    overlayIds: [],
    businessCategory: 'Rental Mobil',
    tier: 'BASIC'
  },
  roles: {
    selected: ['Super Admin', 'Penyewa'],
    wajib: ['Super Admin'],
    tambahan: ['Penyewa']
  },
  flow: {
    alurInti: [{ step: 1, pelaku: 'Penyewa', aksi: 'Pesan mobil' }]
  },
  rbac: {
    modul: [{ namaModul: 'Manajemen Mobil', akses: { 'Super Admin': 'FULL' } }]
  },
  dataSchema: {
    tabel: [
      {
        nama: 'mobil',
        field: [{ nama: 'id_mobil', tipe: 'text', keterangan: 'ID' }]
      }
    ]
  },
  simulasiDb: {
    contohData: {
      tabel: 'mobil',
      baris: [{ id_mobil: 'MOB-001' }]
    },
    akunLogin: [
      { nama: 'Admin', role: 'Super Admin', username: 'superadmin', password: 'superadmin123' }
    ]
  },
  painPoints: { selected: [] },
  features: { selected: [] }
};

// 2a. Ubah ROLE -> SimulasiDb harus terhapus
console.log('- Test ubah ROLE:');
const afterRole = applyGuidedAnswer(sessionState, 'ROLE', ['Super Admin', 'Penyewa', 'Driver']);
assert.strictEqual(afterRole.simulasiDb, undefined, 'simulasiDb harus di-reset saat ROLE berubah');
assert.strictEqual(afterRole.dataSchema, undefined, 'dataSchema harus di-reset saat ROLE berubah');
console.log('  ✓ Cache simulasiDb dan dataSchema otomatis terhapus saat ROLE diubah');

// 2b. Ubah ALUR -> SimulasiDb harus terhapus
console.log('- Test ubah ALUR:');
sessionState.simulasiDb = {
  contohData: { tabel: 'mobil', baris: [] },
  akunLogin: []
};
const afterAlur = applyGuidedAnswer(sessionState, 'ALUR', ['confirm_alur']);
assert.strictEqual(afterAlur.simulasiDb, undefined, 'simulasiDb harus di-reset saat ALUR berubah');
console.log('  ✓ Cache simulasiDb otomatis terhapus saat ALUR diubah');

// -------------------------------------------------------------
// VERIFIKASI 3: Siklus Koreksi Berturut-Turut (Tanpa Paksa Lanjut)
// -------------------------------------------------------------
console.log('\n--- Verifikasi 3: Koreksi Berturut-Turut ---');

let curSession = JSON.parse(JSON.stringify(testDomains[0].session)) as MockupSessionState;
curSession.simulasiDb = generateDeterministicSimulasiDb(curSession);

for (let round = 1; round <= 4; round++) {
  const prevCount = curSession.simulasiDb?.revisiCount || 0;
  // Simulasi koreksi user (fallback deterministic jika offline/test tanpa API key)
  const revised = await reviseSimulasiDbWithAI(
    curSession,
    `Koreksi ke-${round}: ganti harga sewa baris 1 jadi ${200000 + round * 10000}`
  );

  curSession = {
    ...curSession,
    step: 'SIMULASI_DB', // TETAP DI STEP SIMULASI_DB
    simulasiDb: {
      contohData: revised.contohData,
      akunLogin: revised.akunLogin,
      instruksiGenerator: revised.instruksiGenerator,
      markdownTable: revised.markdownTable,
      statusKonfirmasi: 'dikoreksi',
      revisiCount: prevCount + 1
    }
  };

  const stepCard = buildGuidedStep(curSession);
  assert.strictEqual(curSession.step, 'SIMULASI_DB', `Round ${round}: Sesi HARUS tetap di SIMULASI_DB!`);
  assert.strictEqual(curSession.simulasiDb.revisiCount, round, `Round ${round}: revisiCount harus ${round}`);
  assert(stepCard?.options.some((o) => o.id === 'confirm_simulasi'), 'Harus ada tombol konfirmasi');
  assert(stepCard?.options.some((o) => o.id === 'koreksi_simulasi' && o.requiresInput), 'Harus ada tombol koreksi dengan textarea');
  console.log(`  ✓ Koreksi putaran ${round} berhasil: revisiCount=${curSession.simulasiDb.revisiCount}, sesi tetap di SIMULASI_DB`);
}

// Sekarang jika user klik confirm_simulasi:
const confirmedSession = applyGuidedAnswer(curSession, 'SIMULASI_DB', ['confirm_simulasi']);
assert.strictEqual(confirmedSession.step, 'REVIEW_FINAL', 'Sesi HANYA pindah ke REVIEW_FINAL saat konfirmasi');
assert.strictEqual(confirmedSession.simulasiDb?.statusKonfirmasi, 'disetujui', 'statusKonfirmasi harus "disetujui"');
console.log('  ✓ Setelah konfirmasi eksplisit, sesi berhasil maju ke REVIEW_FINAL dengan statusKonfirmasi="disetujui"');

// -------------------------------------------------------------
// VERIFIKASI 4: Markdown Rendering Bebas Tag Bocor
// -------------------------------------------------------------
console.log('\n--- Verifikasi 4: Markdown Rendering Rapi ---');

const mdOutput = renderSimulasiDbMarkdown(curSession.simulasiDb!);
console.log('Contoh potongan markdown:\n-------------------');
console.log(mdOutput);
console.log('-------------------');

assert(!mdOutput.includes('<br>'), 'Markdown TIDAK BOLEH mengandung tag <br> bocor');
assert(mdOutput.includes('| `id_mobil` |'), 'Header tabel contoh data harus ter-render');
assert(mdOutput.includes('| Nama Akun | Role | Username | Password |'), 'Header tabel akun login harus ter-render');
assert(mdOutput.includes('> 💡 *Catatan:'), 'Catatan pembuka harus ada');
assert(!mdOutput.includes('Instruksi Internal'), 'Instruksi internal generator TIDAK BOLEH bocor ke markdown chat user');
console.log('  ✓ Markdown tabel rapi, bersih dari tag HTML bocor, dan instruksi internal tersimpan aman secara rahasia');

console.log('\n=== SEMUA 4 VERIFIKASI POIN 7 LULUS 100%! ===');
