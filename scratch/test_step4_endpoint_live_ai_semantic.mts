import { POST } from '../src/app/api/guided/route';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

console.log('========================================================================');
console.log('TEST LIVE END-TO-END: AI SEMANTIK PADA ENDPOINTguided/route.ts (OPSI 3)');
console.log('========================================================================\n');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('❌ FATAL: GEMINI_API_KEY tidak ditemukan di environment!');
  process.exit(1);
}
console.log('✅ GEMINI_API_KEY terdeteksi (panjang:', apiKey.length, 'karakter)');

const officialRoles = ['Super Admin', 'Mentor Vokasi', 'Pembina Lapangan'];
console.log('Daftar Peran Resmi:', officialRoles);
console.log('Field yang diuji:');
console.log('  1. "pembimbing_id" -> BUKAN substring Mentor Vokasi, BUKAN di ROLE_SYNONYMS -> Wajib dideteksi oleh AI Semantik');
console.log('  2. "pengawas_id"   -> BUKAN substring Pembina Lapangan, BUKAN di ROLE_SYNONYMS -> Wajib dideteksi oleh AI Semantik\n');

async function testEndpointLiveSemantic() {
  const originalFetch = globalThis.fetch;
  let semanticAiCallCount = 0;

  // Intercept fetch HANYA untuk generator skema, sedangkan panggilan Analis Semantik 100% LIVE ke Google Gemini API
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const bodyStr = init?.body ? String(init.body) : '';

    // 1. Panggilan LIVE AI Semantik (detectTargetRoleSemanticAI): DITERUSKAN 100% KE GOOGLE GEMINI API
    if (bodyStr.includes('Analis Semantik Peran Sistem Aplikasi Bisnis')) {
      semanticAiCallCount++;
      console.log(`[LIVE GEMINI AI CALL #${semanticAiCallCount}] Memanggil live Google Gemini API untuk analisis semantik...`);
      return originalFetch(input, init);
    }

    // 2. Generator skema: return schema JSON berisi field uji yang sengaja tidak match Lapis 1/2/Kamus
    if (bodyStr.includes('Analis Basis Data & Perancang Skema Data')) {
      console.log('[MOCK SCHEMA GENERATOR] Mengembalikan skema uji dengan field: pembimbing_id & pengawas_id...');
      const schemaJson = JSON.stringify({
        tabel: [
          {
            nama: 'pengguna',
            field: [
              { nama: 'id', tipe: 'text', keterangan: 'ID Pengguna' },
              { nama: 'nama', tipe: 'text', keterangan: 'Nama Lengkap' },
              { nama: 'peran', tipe: 'text', keterangan: 'Peran Akun' }
            ]
          },
          {
            nama: 'bimbingan_lapangan',
            keterangan: 'Tabel sesi bimbingan lapangan',
            field: [
              { nama: 'id', tipe: 'text', keterangan: 'ID Sesi Bimbingan' },
              { nama: 'pembimbing_id', tipe: 'relasi ke pengguna', keterangan: 'ID pembimbing teknis praktek kerja' },
              { nama: 'pengawas_id', tipe: 'relasi ke pengguna', keterangan: 'ID pengawas keselamatan operasional lapangan' },
              { nama: 'catatan_evaluasi', tipe: 'text', keterangan: 'Catatan hasil supervisi' }
            ]
          }
        ],
        korelasiRingkas: 'bimbingan_lapangan berelasi ke pengguna melalui pembimbing_id dan pengawas_id'
      });

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: `\`\`\`json\n${schemaJson}\n\`\`\`` }]
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Default passthrough
    return originalFetch(input, init);
  };

  // ---------------------------------------------------------------------------
  // 1. UJI JALUR 1: generateDataSchemaWithAI melalui Transisi RBAC -> SKEMA_DATA
  // ---------------------------------------------------------------------------
  console.log('--- TEST BAGIAN 1: Transisi RBAC -> SKEMA_DATA (generateDataSchemaWithAI) ---');
  const sessionInitial: MockupSessionState = {
    step: 'RBAC',
    roles: { selected: officialRoles },
    match: { businessCategory: 'Pelatihan Vokasi', tier: 'TIER_1', patternIds: [], overlayIds: [] },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Mentor Vokasi', aksi: 'Memberikan bimbingan praktek' },
        { step: 2, pelaku: 'Pembina Lapangan', aksi: 'Mengawasi keselamatan' }
      ]
    },
    rbac: {
      modul: [
        {
          nama: 'Bimbingan Vokasi',
          izinPerRole: [
            { role: 'Super Admin', level: 'Kontrol Penuh' },
            { role: 'Mentor Vokasi', level: 'Kelola Bimbingan' },
            { role: 'Pembina Lapangan', level: 'Supervisi Lapangan' }
          ]
        }
      ]
    },
    painPoints: { selected: [] },
    features: { selected: [] }
  };

  const req1 = new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    body: JSON.stringify({
      action: 'NEXT',
      stepId: 'RBAC',
      selected: ['confirm_rbac'],
      provider: 'gemini',
      apiKey: apiKey,
      session: sessionInitial
    })
  });

  const res1 = await POST(req1);
  const json1 = await res1.json();
  if (!json1.success) {
    throw new Error(`Endpoint error pada transisi RBAC: ${json1.error || JSON.stringify(json1)}`);
  }

  const sessionStep1 = json1.session as MockupSessionState;
  console.log(`Step sesi setelah generate: ${sessionStep1.step}`);

  const bimbinganTable1 = sessionStep1.dataSchema?.tabel?.find((t) => t.nama === 'bimbingan_lapangan');
  if (!bimbinganTable1) {
    throw new Error('Tabel bimbingan_lapangan tidak ditemukan di session.dataSchema.tabel');
  }

  const fldPembimbing1 = bimbinganTable1.field.find((f) => f.nama === 'pembimbing_id');
  const fldPengawas1 = bimbinganTable1.field.find((f) => f.nama === 'pengawas_id');

  console.log('\nHasil Deteksi targetRole di generateDataSchemaWithAI:');
  console.log('  pembimbing_id targetRole:', fldPembimbing1?.targetRole);
  console.log('  pengawas_id   targetRole:', fldPengawas1?.targetRole);

  if (fldPembimbing1?.targetRole !== 'Mentor Vokasi') {
    throw new Error(`Expected pembimbing_id targetRole === 'Mentor Vokasi', got: '${fldPembimbing1?.targetRole}'`);
  }
  if (fldPengawas1?.targetRole !== 'Pembina Lapangan') {
    throw new Error(`Expected pengawas_id targetRole === 'Pembina Lapangan', got: '${fldPengawas1?.targetRole}'`);
  }
  console.log('✅ PASS BAGIAN 1: AI Semantik live berhasil menetapkan targetRole di generateDataSchemaWithAI!');

  // ---------------------------------------------------------------------------
  // 2. UJI JALUR 2: reviseDataSchemaWithAI melalui Koreksi Skema di SKEMA_DATA
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST BAGIAN 2: Koreksi Skema (reviseDataSchemaWithAI) ---');
  const req2 = new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    body: JSON.stringify({
      action: 'NEXT',
      stepId: 'SKEMA_DATA',
      selected: ['koreksi_schema'],
      other: 'Tambahkan tabel evaluasi bimbingan',
      provider: 'gemini',
      apiKey: apiKey,
      session: sessionStep1
    })
  });

  const res2 = await POST(req2);
  const json2 = await res2.json();
  if (!json2.success) {
    throw new Error(`Endpoint error pada koreksi skema: ${json2.error || JSON.stringify(json2)}`);
  }

  const sessionStep2 = json2.session as MockupSessionState;
  const bimbinganTable2 = sessionStep2.dataSchema?.tabel?.find((t) => t.nama === 'bimbingan_lapangan');
  const fldPembimbing2 = bimbinganTable2?.field.find((f) => f.nama === 'pembimbing_id');
  const fldPengawas2 = bimbinganTable2?.field.find((f) => f.nama === 'pengawas_id');

  console.log('\nHasil Deteksi targetRole di reviseDataSchemaWithAI:');
  console.log('  pembimbing_id targetRole:', fldPembimbing2?.targetRole);
  console.log('  pengawas_id   targetRole:', fldPengawas2?.targetRole);

  if (fldPembimbing2?.targetRole !== 'Mentor Vokasi') {
    throw new Error(`Expected pembimbing_id targetRole === 'Mentor Vokasi', got: '${fldPembimbing2?.targetRole}'`);
  }
  if (fldPengawas2?.targetRole !== 'Pembina Lapangan') {
    throw new Error(`Expected pengawas_id targetRole === 'Pembina Lapangan', got: '${fldPengawas2?.targetRole}'`);
  }
  console.log('✅ PASS BAGIAN 2: AI Semantik live berhasil menetapkan targetRole di reviseDataSchemaWithAI!');

  console.log(`\nTotal panggilan live Gemini API untuk Analis Semantik: ${semanticAiCallCount}`);
  if (semanticAiCallCount < 2) {
    throw new Error(`Expected minimal 2 panggilan live semantik ke Gemini, actual: ${semanticAiCallCount}`);
  }

  // Restore globalThis.fetch
  globalThis.fetch = originalFetch;

  console.log('\n========================================================================');
  console.log('🎉 SEMUA PENGUJIAN ENDPOINT DENGAN LIVE GEMINI AI BERHASIL 100% (PASS)!');
  console.log('========================================================================');
}

testEndpointLiveSemantic().catch((err) => {
  console.error('\n❌ FATAL TEST FAILED:', err);
  process.exit(1);
});
