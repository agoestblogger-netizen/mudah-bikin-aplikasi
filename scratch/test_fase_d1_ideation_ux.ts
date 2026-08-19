async function testFaseD1() {
  console.log('=== TEST FASE D-1: INTEGRASI UX PATTERN REGISTRY KE TAHAP DISKUSI ===\n');

  // Test 1: Skenario Klinik (Healthcare) - Menguji pembentukan Brief Kebutuhan
  console.log('--- TEST 1: Skenario Klinik (Healthcare MT-06 + UX-CUST-04 Patient Queue) ---');
  const resKlinik = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ya sudah sesuai dan pas, buatkan brief kebutuhannya',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi klinik umum pratama' },
        { sender: 'AI', text: 'Untuk klinik, ada peran Pasien, Dokter, dan Resepsionis...' },
        { sender: 'USER', text: 'ya sudah sesuai dan pas, buatkan brief kebutuhannya' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const contentType1 = resKlinik.headers.get('Content-Type') || '';
  console.log('Klinik Response Content-Type:', contentType1);

  if (contentType1.includes('text/event-stream')) {
    const text1 = await resKlinik.text();
    console.log('Klinik Brief Response Length:', text1.length);
    console.log('Sample Brief:\n', text1.substring(0, 700));

    const hasPasienRole = text1.toLowerCase().includes('pasien');
    const hasDokterRole = text1.toLowerCase().includes('dokter');
    const hasAntrean = text1.toLowerCase().includes('antrean') || text1.toLowerCase().includes('antrian') || text1.toLowerCase().includes('nomor');
    console.log('Includes Pasien Role:', hasPasienRole);
    console.log('Includes Dokter Role:', hasDokterRole);
    console.log('Includes Antrean / Nomor / Prioritas:', hasAntrean);
  }

  // Test 2: Skenario Laundry (Service)
  console.log('\n--- TEST 2: Skenario Laundry (MT-03 + UX-CUST-05 Order Tracking & UX-OPS-01) ---');
  const resLaundry = await fetch('http://localhost:3000/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'ya sudah cocok, rangkum ke brief',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi laundry kiloan' },
        { sender: 'AI', text: 'Untuk usaha laundry, ada peran Admin, Kasir, dan Washer...' },
        { sender: 'USER', text: 'ya sudah cocok, rangkum ke brief' }
      ],
      stage: 'TAHAP_1_PEMBUKAAN',
      currentCode: null
    })
  });

  const contentType2 = resLaundry.headers.get('Content-Type') || '';
  console.log('Laundry Response Content-Type:', contentType2);
  if (contentType2.includes('text/event-stream')) {
    const text2 = await resLaundry.text();
    console.log('Laundry Brief Response Length:', text2.length);
    console.log('Sample Brief:\n', text2.substring(0, 700));
  }
}

testFaseD1().catch(console.error);
