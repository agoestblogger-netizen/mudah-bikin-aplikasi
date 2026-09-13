import fs from 'fs';
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

// Import route handler directly
import { POST } from '../src/app/api/guided/route';
import { NextRequest } from 'next/server';

async function testApiFlow() {
  console.log('=== Step 1: START dengan prompt ambigu "buatkan aplikasi barang rosok" ===');
  const req1 = new NextRequest('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      action: 'START',
      prompt: 'buatkan aplikasi barang rosok'
    })
  });
  const res1 = await POST(req1);
  const data1 = await res1.json();

  console.log('Success:', data1.success);
  console.log('Action:', data1.action);
  console.log('Pending Clarification in Session:', Boolean(data1.session?.storyline?.pendingDirectionClarification));
  console.log('GuidedStep StepId:', data1.guidedStep?.stepId);
  console.log('GuidedStep Title:', data1.guidedStep?.title);
  console.log('GuidedStep allowOther:', data1.guidedStep?.allowOther);
  console.log('GuidedStep Options:', data1.guidedStep?.options?.map((o: any) => o.label));

  if (data1.guidedStep?.allowOther !== true) {
    throw new Error('FAIL: guidedStep.allowOther harus true di kartu klarifikasi!');
  }
  console.log('✅ Step 1 PASSED: Kartu klarifikasi arah muncul dengan allowOther: true\n');

  console.log('=== Step 2: NEXT dengan jawaban custom "Lainnya" (selected: [], other: "Fokus pembelian saja dari sumber barang") ===');
  const req2 = new NextRequest('http://localhost:3000/api/guided', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-token'
    },
    body: JSON.stringify({
      action: 'NEXT',
      session: data1.session,
      stepId: 'STORYTELLING',
      selected: [],
      other: 'Fokus pembelian saja dari sumber barang'
    })
  });
  const res2 = await POST(req2);
  const data2 = await res2.json();

  console.log('Success:', data2.success);
  console.log('Session Step:', data2.session?.step);
  console.log('Pending Clarification Cleared:', !data2.session?.storyline?.pendingDirectionClarification);
  console.log('Narasi:\n', data2.session?.storyline?.narasi);
  console.log('Asumsi Aktor:', data2.session?.storyline?.asumsiAktor);
  console.log('Asumsi Alur Utama:', data2.session?.storyline?.asumsiAlurUtama);

  const narasi = (data2.session?.storyline?.narasi || '').toLowerCase();
  const hasOpening = /warga|pengepul|penghimpun|datang|membawa|jemput|setor|penjual/i.test(narasi);
  const hasCore = /timbang|pilah|periksa|cek|kondisi|kardus|besi|logam/i.test(narasi);
  const hasClosing = /nota|kuitansi|bayar|tunai|uang|rekap|kas/i.test(narasi);

  console.log('\n--- Cek 3 Fase di Response API ---');
  console.log('Fase 1 (Interaksi Pembuka):', hasOpening ? '✅ ADA' : '❌ TIDAK TERDETEKSI');
  console.log('Fase 2 (Penanganan Fisik Inti):', hasCore ? '✅ ADA' : '❌ TIDAK TERDETEKSI');
  console.log('Fase 3 (Pencatatan & Pembayaran):', hasClosing ? '✅ ADA' : '❌ TIDAK TERDETEKSI');

  if (hasOpening && hasCore && hasClosing) {
    console.log('✅ Step 2 PASSED: Alur 3 fase lengkap terverifikasi di response API!');
  } else {
    throw new Error('FAIL: Narasi belum mencakup seluruh 3 fase!');
  }
}

testApiFlow().catch((e) => {
  console.error('API Test Failed:', e);
  process.exit(1);
});
