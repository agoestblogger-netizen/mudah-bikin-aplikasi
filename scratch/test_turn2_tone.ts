async function testTurn2Tone() {
  console.log('=== TEST TURN 2 TONE ===');
  const res = await fetch('https://www.mudahbikinapps.store/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'iya pembagian peran itu sudah cocok',
      stage: 'TAHAP_1_PEMBUKAAN',
      chatHistory: [
        { sender: 'USER', text: 'buatkan aplikasi laundry' },
        { sender: 'AI', text: 'Halo! Senang sekali mendengar Anda ingin membuat aplikasi laundry! Untuk aplikasi laundry, saya sarankan pembagian peran menjadi 3 bagian utama: Admin, Kasir, dan Washer. Pembagian peran ini sudah cukup pas?' }
      ],
      currentCode: ''
    })
  });

  let text = '';
  if (res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.type === 'chunk') text += parsed.text;
          else if (parsed.type === 'done') text = parsed.replyText || text;
        } catch (_) {}
      }
    }
  }

  console.log('OUTPUT TURN 2:');
  console.log(text);
}

testTurn2Tone().catch(console.error);
