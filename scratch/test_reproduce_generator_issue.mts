import fs from 'fs';
import { POST } from '../src/app/api/generate/route';

async function runRepro() {
  console.log('--- REPRODUKSI MASALAH GENERATE KURSUS MENYETIR MOBIL ---');
  const sessionRaw = fs.readFileSync('scratch/session_kursus_mobil.json', 'utf8');
  const sessionData = JSON.parse(sessionRaw);

  console.log('Roles di session:', sessionData.roles?.selected);
  console.log('Tabel di session:', sessionData.dataSchema?.tabel?.map((t: any) => t.nama));

  const payload = {
    prompt: 'buatkan prototipe sekarang',
    chatHistory: [
      { sender: 'USER', text: 'buatkan prototipe sekarang' }
    ],
    stage: 'TAHAP_2_MOCKUP',
    mode: 'BUILD',
    sessionState: sessionData,
    userProvider: 'gemini',
    userApiKey: process.env.GEMINI_API_KEY,
    userModel: 'gemini-3.6-flash'
  };

  const req = new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify(payload)
  });

  console.log('Mengirim request ke POST /api/generate (Percobaan 1: Normal)...');
  const res1 = await POST(req);
  const json1 = await res1.json();

  console.log('\n[Percobaan 1] Response:');
  console.log('  Success:', json1.success);
  console.log('  Code produced:', Boolean(json1.code));
  console.log('  Reply text preview:', json1.replyText?.slice(0, 300));
  fs.writeFileSync('scratch/repro_attempt1.json', JSON.stringify(json1, null, 2));

  // Percobaan 2: Coba Retry ("buatkan prototipe sekarang")
  console.log('\n--- UJI RETRY: Percobaan 2 (Coba Generate Ulang) ---');
  const payloadRetry = { ...payload, chatHistory: [...payload.chatHistory, { sender: 'AI', text: json1.replyText }, { sender: 'USER', text: 'buatkan prototipe sekarang' }] };
  const req2 = new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    body: JSON.stringify(payloadRetry)
  });
  const res2 = await POST(req2);
  const json2 = await res2.json();
  console.log('\n[Percobaan 2: Retry] Response:');
  console.log('  Success:', json2.success);
  console.log('  Code produced:', Boolean(json2.code));
  console.log('  Reply text preview:', json2.replyText?.slice(0, 300));
  fs.writeFileSync('scratch/repro_attempt2_retry.json', JSON.stringify(json2, null, 2));

  // Percobaan 3: Versi Sederhana ("buatkan prototipe versi sederhana dulu, fokus hanya 2 role utama: Super Admin dan Admin Pendaftaran")
  console.log('\n--- UJI SIMPLIFY: Percobaan 3 (Versi Sederhana 2 Role) ---');
  const payloadSimplify = {
    ...payload,
    prompt: json1.suggestedSimplifyPrompt || 'buatkan prototipe versi sederhana dulu, fokus hanya 2 role utama: Super Admin dan Admin Pendaftaran',
    chatHistory: [
      ...payload.chatHistory,
      { sender: 'AI', text: json1.replyText },
      { sender: 'USER', text: json1.suggestedSimplifyPrompt || 'buatkan prototipe versi sederhana dulu, fokus hanya 2 role utama: Super Admin dan Admin Pendaftaran' }
    ]
  };
  const req3 = new Request('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    body: JSON.stringify(payloadSimplify)
  });
  const res3 = await POST(req3);
  const json3 = await res3.json();
  console.log('\n[Percobaan 3: Sederhana] Response:');
  console.log('  Success:', json3.success);
  console.log('  Code produced:', Boolean(json3.code));
  console.log('  Reply text preview:', json3.replyText?.slice(0, 300));
  fs.writeFileSync('scratch/repro_attempt3_simplify.json', JSON.stringify(json3, null, 2));
}

runRepro().catch((err) => {
  console.error('Fatal error running repro:', err);
});
