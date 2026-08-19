async function testStreamingEndpoints() {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
  const openaiApiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || "";

  const systemPrompt = "Anda adalah Konsultan Aplikasi AI. Jawab ramah dalam 2 kalimat singkat.";
  const userPrompt = "buatkan aplikasi laundry";

  // TEST 1: Gemini Streaming with gemini-3.6-flash
  console.log('--- TEST 1: GEMINI STREAMING (gemini-3.6-flash) ---');
  const t0 = performance.now();
  try {
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.7 }
      })
    });
    console.log('Gemini HTTP Status:', geminiRes.status, geminiRes.statusText);
    if (geminiRes.ok && geminiRes.body) {
      const reader = geminiRes.body.getReader();
      let firstChunk = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstChunk) {
          console.log(`Gemini TTFT: ${((performance.now() - t0) / 1000).toFixed(3)}s`);
          firstChunk = false;
        }
      }
      console.log(`Gemini Total Time: ${((performance.now() - t0) / 1000).toFixed(3)}s`);
    } else {
      const errText = await geminiRes.text();
      console.log('Gemini Error Body:', errText.slice(0, 300));
    }
  } catch (err: any) {
    console.error('Gemini Fetch Error:', err.message);
  }

  // TEST 2: OpenAI Streaming with gpt-4o-mini
  console.log('\n--- TEST 2: OPENAI STREAMING (gpt-4o-mini) ---');
  const t1 = performance.now();
  try {
    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 256,
        temperature: 0.7,
        stream: true
      })
    });
    console.log('OpenAI HTTP Status:', oaiRes.status, oaiRes.statusText);
    if (oaiRes.ok && oaiRes.body) {
      const reader = oaiRes.body.getReader();
      let firstChunk = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (firstChunk) {
          console.log(`OpenAI TTFT: ${((performance.now() - t1) / 1000).toFixed(3)}s`);
          firstChunk = false;
        }
      }
      console.log(`OpenAI Total Time: ${((performance.now() - t1) / 1000).toFixed(3)}s`);
    }
  } catch (err: any) {
    console.error('OpenAI Fetch Error:', err.message);
  }
}

testStreamingEndpoints().catch(console.error);
