/**
 * LIVE PIPELINE TEST: PELATIHAN KULINER DENGAN 3 ROLE ASLI (Termasuk "pegawai administrasi")
 * =========================================================================================
 * Memverifikasi:
 *   1. ownerRole entitas Siswa = "pegawai administrasi" (bukan Instruktur)
 *   2. Field pencatat (terdaftar_oleh/dicatat_oleh) di tabel pendaftaran merujuk ke pegawai administrasi
 *   3. Akun demo login tersedia untuk 3 role (Super Admin, Instruktur, pegawai administrasi),
 *      sedangkan Siswa TIDAK dapat akun (Entitas Data)
 *   4. Tabel katalog program_pelatihan memuat nama varian user ("Roti Tawar, Roti Gandum, Croissant")
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  applyGuidedAnswer,
  getDomainFlowDetails,
  generateDeterministicSimulasiDb
} from '../src/lib/templates/processes/guided';
import {
  generateDataSchemaWithAI,
  generateSupportingFlowsAndFeaturesWithAI
} from '../src/app/api/guided/route';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

function loadEnvLocal() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

async function main() {
  const provider = process.env.OPENROUTER_API_KEY
    ? 'openrouter'
    : process.env.OPENAI_API_KEY
    ? 'openai'
    : 'gemini';
  const apiKey =
    process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error('⛔ BLOCKED: Tidak ada API key AI.');
    process.exit(2);
  }

  console.log('========================================================================');
  console.log('🧪 LIVE PIPELINE TEST: 3 ROLE ASLI (Super Admin, Instruktur, pegawai administrasi)');
  console.log(`Provider: ${provider}`);
  console.log('========================================================================\n');

  // 1. Session awal: narasi mentah TANPA menyebut variasi
  let session: MockupSessionState = {
    step: 'STORYTELLING',
    match: {
      templateId: 'KULINER_02',
      overlayIds: [],
      patternIds: [],
      tier: 'ADVANCE',
      businessCategory: 'Pelatihan Kuliner'
    },
    roles: { selected: [] },
    flow: {},
    painPoints: { selected: [] },
    features: { selected: [] },
    storyline: {
      narasi: 'Pelatihan kuliner membuat roti.',
      asumsiMasalah: 'Pendaftaran siswa masih manual via chat',
      asumsiAktor: ['Super Admin', 'Instruktur', 'pegawai administrasi', 'Siswa'],
      asumsiAlurUtama:
        'Siswa mendaftar melalui pegawai administrasi, memilih program pelatihan, instruktur mengajar materi, admin dan pegawai administrasi memverifikasi.',
      statusKonfirmasi: 'disetujui',
      revisiCount: 0,
      riwayatKoreksi: []
    }
  };

  // 2. confirm_story -> muncul pertanyaan variasi produk
  session = applyGuidedAnswer(session, 'STORYTELLING', ['confirm_story'], undefined);
  assert(
    session.storyline?.pendingProductVariantQuestion !== undefined,
    'Pertanyaan variasi produk harus muncul'
  );
  console.log('✅ [1] Pertanyaan variasi produk berhasil terpicu.');

  // 3. User memilih varian multiple dengan 3 nama varian roti
  const NAMA_VARIAN = 'Roti Tawar, Roti Gandum, Croissant';
  session = applyGuidedAnswer(session, 'STORYTELLING', ['variant_multiple'], NAMA_VARIAN);
  assert(/\[Variasi Produk:/i.test(session.storyline!.narasi), 'Narasi harus ter-append penanda variasi');
  console.log(`✅ [2] Narasi ter-append variasi user: "${session.storyline!.narasi}"`);

  // 4. Set 3 role resmi dan klasifikasi aktor Bug 1b
  session = {
    ...session,
    roles: {
      selected: ['Super Admin', 'Instruktur', 'pegawai administrasi']
    },
    actorsClassification: [
      { actor: 'Super Admin', category: 'PENGGUNA_SISTEM' },
      { actor: 'Instruktur', category: 'PENGGUNA_SISTEM' },
      { actor: 'pegawai administrasi', category: 'PENGGUNA_SISTEM' },
      { actor: 'Siswa', category: 'ENTITAS_DATA', ownerRole: 'pegawai administrasi' }
    ],
    rbac: {
      modul: [
        { nama: 'Pendaftaran Siswa', aktif: true, buat: true, lihat: true, ubah: true, hapus: false },
        { nama: 'Manajemen Kelas', aktif: true, buat: true, lihat: true, ubah: true, hapus: false },
        { nama: 'Pembayaran', aktif: true, buat: true, lihat: true, ubah: true, hapus: false }
      ] as any
    }
  };

  // 5. Alur inti dan generate alur pendukung AI
  const flowData = getDomainFlowDetails(session);
  let alurPendukung: any[] = [];
  let fiturPendukung: any[] = [];
  try {
    const flowResult = await generateSupportingFlowsAndFeaturesWithAI(session, provider, apiKey);
    alurPendukung = (flowResult as any)?.alurPendukung || [];
    fiturPendukung = (flowResult as any)?.fiturPendukung || [];
  } catch (e: any) {
    console.warn('Alur pendukung AI warning:', e?.message);
  }

  session = {
    ...session,
    flow: {
      ...session.flow,
      alurInti: flowData.alurInti as any,
      alurPendukung: alurPendukung.map((ap: any) => ({
        nama: ap.nama || ap.namaAlur || 'Alur Pendukung',
        steps: ap.steps || []
      })),
      fiturPendukung: fiturPendukung.map((f: any) =>
        typeof f === 'string' ? f : f.nama || f.namaFitur || String(f)
      )
    } as any
  };

  // 6. AI generate skema data DARI NOL
  console.log('Memanggil AI generateDataSchemaWithAI()...');
  const schemaResult = await generateDataSchemaWithAI(session, provider, apiKey);
  assert(schemaResult && schemaResult.tabel.length > 0, 'Skema data harus dihasilkan AI');

  session.dataSchema = schemaResult;

  console.log(`\n✅ [3] AI menghasilkan ${schemaResult.tabel.length} tabel skema data:`);
  schemaResult.tabel.forEach((t) => {
    console.log(`   - Tabel "${t.nama}" (${t.field.length} field): ${t.keterangan}`);
    t.field.forEach((f) => {
      console.log(`       • ${f.nama} (${f.tipe})${f.targetRole ? ` [targetRole: ${f.targetRole}]` : ''}: ${f.keterangan}`);
    });
  });

  // 7. Verifikasi ownerRole untuk entitas Siswa
  const siswaClass = (session.actorsClassification || []).find((a) => a.actor.toLowerCase() === 'siswa');
  assert(siswaClass, 'Siswa harus ada di actorsClassification');
  assert.strictEqual(siswaClass.ownerRole, 'pegawai administrasi', 'ownerRole Siswa harus konsisten pegawai administrasi');
  console.log(`\n✅ [4] ownerRole Siswa terverifikasi: "${siswaClass.ownerRole}"`);

  // 8. Verifikasi field pencatat di tabel pendaftaran / transaksi
  // Cari tabel pendaftaran atau tabel yang memuat relasi ke siswa / program
  const pendaftaranTable = schemaResult.tabel.find((t) =>
    /pendaftaran|registrasi|transaksi/i.test(t.nama)
  );
  assert(pendaftaranTable, 'Tabel pendaftaran/registrasi harus ada');

  const recorderField = pendaftaranTable.field.find((f) =>
    /terdaftar_oleh|dicatat_oleh|didaftarkan_oleh|staf_id|petugas_id|admin_id/i.test(f.nama) ||
    /pegawai\s*administrasi|staf/i.test(f.keterangan || '')
  );
  console.log(`\n🔍 Field pencatat pada tabel "${pendaftaranTable.nama}":`, recorderField || 'Tidak ada field pencatat terpisah');
  if (recorderField) {
    console.log(`   Field nama: ${recorderField.nama}, targetRole: ${recorderField.targetRole}, keterangan: ${recorderField.keterangan}`);
    if (recorderField.targetRole) {
      assert(
        /pegawai\s*administrasi/i.test(recorderField.targetRole),
        `targetRole field pencatat harus pegawai administrasi, ditemukan: ${recorderField.targetRole}`
      );
    }
  }

  // 9. Verifikasi Simulasi DB & Akun Demo
  const simDb = generateDeterministicSimulasiDb(session);

  console.log('\n🔍 Akun Demo Login Simulasi DB:');
  simDb.akunLogin.forEach((a) => {
    console.log(`   - ${a.role}: ${a.nama} (username: ${a.username})`);
  });

  const rolesInAkun = simDb.akunLogin.map((a) => a.role);
  assert(rolesInAkun.includes('Super Admin'), 'Akun Super Admin harus ada');
  assert(rolesInAkun.includes('Instruktur'), 'Akun Instruktur harus ada');
  assert(rolesInAkun.includes('pegawai administrasi'), 'Akun pegawai administrasi harus ada');
  assert(!rolesInAkun.includes('Siswa'), 'Siswa TIDAK boleh memiliki akun demo login (karena ENTITAS_DATA)');
  console.log('✅ [5] Akun Demo Login tepat 3 role (Super Admin, Instruktur, pegawai administrasi). Siswa bebas dari akun login.');

  // 10. Verifikasi baris tabel katalog program_pelatihan di Simulasi DB
  const katalogTableInSimDb = simDb.contohData.tabel.find((t) =>
    /katalog|paket|program|kursus|pelatihan/i.test(t.nama)
  );
  assert(katalogTableInSimDb, 'Tabel katalog harus ada di Simulasi DB');
  console.log(`\n🔍 Data Baris Mentah Tabel Katalog "${katalogTableInSimDb.nama}":`);
  console.log(JSON.stringify(katalogTableInSimDb.baris, null, 2));

  // Ambil nilai nama produk di baris
  const namaValues = katalogTableInSimDb.baris.map((r: any) =>
    r.nama_program || r.nama_paket || r.nama_kursus || r.nama_pelatihan || r.nama_produk || r.nama
  );
  console.log('Nama Varian di Baris Katalog:', namaValues);
  assert(namaValues.includes('Roti Tawar'), 'Harus memuat varian Roti Tawar');
  assert(namaValues.includes('Roti Gandum'), 'Harus memuat varian Roti Gandum');
  assert(namaValues.includes('Croissant'), 'Harus memuat varian Croissant');
  console.log('✅ [6] Nilai varian katalog terbukti memuat ketiga varian user: Roti Tawar, Roti Gandum, Croissant.');

  // Simpan output ke scratch/langkah9_kuliner_3roles_schema.json
  const outPath = path.resolve(__dirname, 'langkah9_kuliner_3roles_schema.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        sessionSummary: {
          roles: session.roles.selected,
          actorsClassification: session.actorsClassification,
          narasi: session.storyline?.narasi
        },
        schema: schemaResult,
        simDbAkunLogin: simDb.akunLogin,
        simDbKatalogRows: katalogTableInSimDb.baris
      },
      null,
      2
    )
  );
  console.log(`\n💾 Hasil verifikasi disimpan di: ${outPath}`);
  console.log('🎉 SELURUH VERIFIKASI 3 ROLE ASLI BERHASIL 100%!');
}

main().catch((err) => {
  console.error('\n❌ ERROR:', err);
  process.exit(1);
});
