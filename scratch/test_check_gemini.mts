async function checkGemini() {
  const key = process.env.GEMINI_API_KEY;
  console.log('Using key:', key ? `${key.substring(0, 8)}...` : 'NONE');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
    })
  });
  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Response body:', text);
}

checkGemini().catch(console.error);
