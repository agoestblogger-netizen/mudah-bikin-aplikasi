async function testDialogueGate() {
  console.log('=== TEST GERBANG DIALOG REVISI SIGNIFIKAN (POIN 38) ===\n');

  const dummyCode = `<!DOCTYPE html>
<html>
<head><title>Test App</title></head>
<body>
  <h1>App Kasir Laundry</h1>
  <button id="btn-save" style="background: blue; color: white;">Simpan</button>
  <script>
    let items = [{ id: '1', nama: 'Cuci Kiloan', harga: 10000 }];
  </script>
</body>
</html>`;

  // Test 1: Skenario Revisi Besar + Pertanyaan Eksplisit ("apakah kamu paham?")
  console.log('--- TEST 1: Revisi Besar + Pertanyaan Eksplisit ---');
  const prompt1 = 'Tolong ganti mekanisme role switcher ini jadi sistem login sungguhan untuk 3 role: Sales, Supervisor, dan Sales Manager. Apakah kamu paham?';
  
  const res1 = await fetch('https://www.mudahbikinapps.store/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt1,
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi laundry' },
        { sender: 'AI', text: 'Berikut aplikasi laundry...' },
        { sender: 'USER', text: prompt1 }
      ],
      stage: 'TAHAP_5_PATCH',
      currentCode: dummyCode
    })
  });

  const contentType1 = res1.headers.get('Content-Type') || '';
  console.log('Response 1 Content-Type:', contentType1);

  if (contentType1.includes('text/event-stream')) {
    console.log('✅ PASS: Masuk ke Mode Dialog SSE Streaming!');
    const text = await res1.text();
    console.log('Sample Stream Chunks (first 300 chars):', text.substring(0, 300));
    const hasCodeBlock = text.includes('```html') || text.includes('<!DOCTYPE');
    console.log('Contains premature HTML code block?:', hasCodeBlock);
    if (!hasCodeBlock) {
      console.log('✅ PASS: Tidak menghasilkan kode prematur, menjawab pertanyaan dialog!');
    } else {
      console.error('❌ FAIL: Menghasilkan kode prematur!');
    }
  } else {
    const json1 = await res1.json();
    console.error('❌ FAIL: Seharusnya SSE Stream Dialog, tapi mengembalikan JSON:', json1);
  }

  // Test 2: Skenario Revisi Kecil (Tweak warna tombol)
  console.log('\n--- TEST 2: Revisi Kecil / Tweak Visual ---');
  const prompt2 = 'ganti warna tombol simpan jadi hijau';
  
  const res2 = await fetch('https://www.mudahbikinapps.store/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: prompt2,
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi laundry' },
        { sender: 'AI', text: 'Berikut aplikasi laundry...' },
        { sender: 'USER', text: prompt2 }
      ],
      stage: 'TAHAP_5_PATCH',
      currentCode: dummyCode
    })
  });

  const contentType2 = res2.headers.get('Content-Type') || '';
  console.log('Response 2 Content-Type:', contentType2);

  if (contentType2.includes('application/json')) {
    const json2 = await res2.json();
    console.log('✅ PASS: Revisi kecil langsung dieksekusi menghasilkan kode JSON (success:', json2.success, ', html length:', json2.code?.html?.length, ')');
  } else {
    console.error('❌ FAIL: Revisi kecil seharusnya langsung dieksekusi jadi kode!');
  }
}

testDialogueGate().catch(console.error);
