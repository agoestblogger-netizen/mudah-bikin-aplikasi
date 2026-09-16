import { POST } from '../src/app/api/guided/route';
import type { MockupSessionState } from '../src/lib/templates/processes/types';

console.log('--- TEST 2: UJI JALUR ENDPOINT ASLI (POST /api/guided) UNTUK SKEMA_DATA ---');

async function runEndpointTest() {
  // 1. Siapkan sesi dengan role resmi non-standar: 'Mentor Vokasi' dan 'Pembina Lapangan'
  const session: MockupSessionState = {
    step: 'RBAC',
    roles: {
      selected: ['Super Admin', 'Mentor Vokasi', 'Pembina Lapangan']
    },
    match: {
      businessCategory: 'Bimbingan Vokasi & Lapangan',
      tier: 'TIER_1',
      patternIds: [],
      overlayIds: []
    },
    flow: {
      alurInti: [
        { step: 1, pelaku: 'Mentor Vokasi', aksi: 'Membimbing peserta praktek lapangan' },
        { step: 2, pelaku: 'Pembina Lapangan', aksi: 'Mengawasi keselamatan dan evaluasi' }
      ]
    },
    rbac: {
      modul: [
        {
          nama: 'Bimbingan Praktek Vokasi',
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

  // Mock globalThis.fetch untuk panggilan AI (Gemini/OpenAI) sehingga mengembalikan skema JSON realistis
  const originalFetch = globalThis.fetch;
  const mockAiSchemaJson = JSON.stringify({
    tabel: [
      {
        nama: 'pengguna',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID pengguna' },
          { nama: 'nama', tipe: 'text', keterangan: 'Nama pengguna' },
          { nama: 'peran', tipe: 'text', keterangan: 'Peran akun' }
        ]
      },
      {
        nama: 'bimbingan_praktek',
        field: [
          { nama: 'id', tipe: 'text', keterangan: 'ID sesi bimbingan' },
          { nama: 'mentor_vokasi_id', tipe: 'relasi ke pengguna', keterangan: 'ID mentor pendamping praktek' },
          { nama: 'pembina_id', tipe: 'relasi ke pengguna', keterangan: 'ID pembina pengawas lapangan' }
        ]
      }
    ],
    korelasiRingkas: 'bimbingan_praktek berelasi ke pengguna melalui mentor_vokasi_id dan pembina_id'
  });

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('generativelanguage.googleapis.com') || url.includes('api.openai.com')) {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: `\`\`\`json\n${mockAiSchemaJson}\n\`\`\`` }]
              }
            }
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  };

  // Buat request simulasi ke POST handler: Konfirmasi RBAC -> Pindah ke SKEMA_DATA
  const req = new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      action: 'NEXT',
      stepId: 'RBAC',
      selected: ['confirm_rbac'],
      provider: 'gemini',
      apiKey: 'AIzaSyMockKeyForEndpointTesting',
      session
    })
  });

  console.log('Mengirim request ke POST /api/guided (Transisi RBAC -> SKEMA_DATA)...');
  const res = await POST(req);
  const json = await res.json();

  if (!json.success) {
    throw new Error(`Endpoint error: ${json.error || JSON.stringify(json)}`);
  }

  const updatedSession = json.session as MockupSessionState;
  console.log(`Step sesi saat ini: ${updatedSession.step}`);
  if (updatedSession.step !== 'SKEMA_DATA') {
    throw new Error(`Expected step SKEMA_DATA, got ${updatedSession.step}`);
  }

  const tables = updatedSession.dataSchema?.tabel || [];
  console.log(`Jumlah tabel di dataSchema: ${tables.length}`);
  tables.forEach((t) => {
    console.log(`\nTabel: ${t.nama}`);
    t.field.forEach((f) => {
      console.log(`  - ${f.nama} (${f.tipe}) -> targetRole: ${f.targetRole || '(none)'}`);
    });
  });

  // Sekarang simulasikan koreksi skema data yang menambahkan field mentor_vokasi_id dan pembina_id
  console.log('\n--- Uji Koreksi Skema via Endpoint: reviseDataSchemaWithAI ---');
  const reqKoreksi = new Request('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      action: 'NEXT',
      stepId: 'SKEMA_DATA',
      selected: ['koreksi_schema'],
      other: 'Tambahkan tabel bimbingan_praktek dengan field mentor_vokasi_id bertipe relasi ke pengguna dan pembina_id bertipe relasi ke pengguna',
      provider: 'gemini',
      apiKey: 'AIzaSyMockKeyForEndpointTesting',
      session: updatedSession
    })
  });

  const resKoreksi = await POST(reqKoreksi);
  const jsonKoreksi = await resKoreksi.json();

  if (!jsonKoreksi.success) {
    throw new Error(`Endpoint koreksi error: ${jsonKoreksi.error || JSON.stringify(jsonKoreksi)}`);
  }

  const finalSession = jsonKoreksi.session as MockupSessionState;
  const finalTables = finalSession.dataSchema?.tabel || [];
  console.log(`\nJumlah tabel setelah koreksi: ${finalTables.length}`);

  let foundMentorField: { nama: string; targetRole?: string } | null = null;
  let foundPembinaField: { nama: string; targetRole?: string } | null = null;

  finalTables.forEach((t) => {
    t.field.forEach((f) => {
      if (f.nama.includes('mentor') || f.nama === 'mentor_vokasi_id') {
        foundMentorField = f;
      }
      if (f.nama.includes('pembina') || f.nama === 'pembina_id') {
        foundPembinaField = f;
      }
      console.log(`[Tabel: ${t.nama}] Field: ${f.nama} -> targetRole: ${f.targetRole || '(none)'}`);
    });
  });

  console.log('\nVerifikasi Field Hasil Endpoint:');
  console.log('Mentor Field:', foundMentorField);
  console.log('Pembina Field:', foundPembinaField);

  if (foundMentorField && (foundMentorField as any).targetRole !== 'Mentor Vokasi') {
    throw new Error(`Expected mentor field targetRole 'Mentor Vokasi', got: ${(foundMentorField as any).targetRole}`);
  }
  if (foundPembinaField && (foundPembinaField as any).targetRole !== 'Pembina Lapangan') {
    throw new Error(`Expected pembina field targetRole 'Pembina Lapangan', got: ${(foundPembinaField as any).targetRole}`);
  }

  console.log('✅ PASS: Sesi endpoint nyata menyimpan targetRole sesuai officialRoles sesi aktif!');
}

runEndpointTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
