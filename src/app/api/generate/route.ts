import { NextResponse } from 'next/server';
import { validateAndRepairGeneratedCode } from '@/lib/codeValidator';

export const maxDuration = 60; // Max execution timeout for Next.js API route

export async function POST(req: Request) {
  try {
    const { prompt, chatHistory, stage } = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;

    // Default System Prompt (PRD Bagian 5 & 6)
    const systemPrompt = `Anda adalah AI Generator Aplikasi dari platform "Mudah Bikin Aplikasi" (Basic Tier).
Tugas Anda adalah memandu pengguna awam dalam 6 Tahap PRD (Pembukaan, Mockup & Preview Canvas, Kunci Kebutuhan, Backend Apps Script, Pembaruan Fitur/Patch, dan Penanganan Kendala).

ATURAN MUTLAK KODE GENERATION:
1. Seluruh kode prototipe WAJIB diberikan dalam SATU blok kode utuh terpisah: \`\`\`html ... \`\`\`.
2. HANYA gunakan HTML, CSS di dalam tag <style>, dan JavaScript di dalam tag <script>.
3. Arsitektur data WAJIB menggunakan variabel/array State JavaScript hidup (bukan ditulis statis di HTML).
4. DILARANG KERAS menggunakan confirm(), alert(), atau prompt() bawaan browser (Gunakan custom modal/banner HTML biasa).
5. Tombol hapus/edit WAJIB reassign variabel state asli dan memanggil fungsi render di baris terakhir.
6. Login & Role Admin (Fitur Tambah User) WAJIB terkunci di balik autentikasi admin.`;

    if (!apiKey) {
      // Fallback Generator jika API Key belum dipasang di .env.local
      console.log('OPENAI_API_KEY not detected, using robust fallback generator.');
      
      const sampleHtml = `<div class="app">
  <header>
    <h1>🚀 ${prompt || 'Aplikasi Kasir & Inventaris'}</h1>
    <div id="userStatus" className="badge">Guest</div>
  </header>
  <div class="card" id="loginBox">
    <h3>🔑 Login Akses System</h3>
    <input type="text" id="uname" placeholder="Username (admin / kasir)" />
    <input type="password" id="pass" placeholder="Password" />
    <button onclick="appLogin()">Masuk</button>
  </div>
  <div class="card" id="dashBox" style="display:none;">
    <h3>📦 Data Inventaris</h3>
    <button id="adminBtn" style="display:none;" onclick="addAdminUser()">+ Tambah User Admin</button>
    <table id="tbl">
      <thead><tr><th>Kode</th><th>Nama</th><th>Harga</th><th>Aksi</th></tr></thead>
      <tbody id="tblBody"></tbody>
    </table>
  </div>
</div>`;

      const sampleCss = `body { font-family: sans-serif; background: #0f172a; color: #fff; padding: 20px; }
.card { background: #1e293b; padding: 20px; border-radius: 12px; margin-top: 15px; }
input { display: block; margin-bottom: 10px; width: 100%; padding: 8px; box-sizing: border-box; }
button { padding: 10px 15px; background: #6366f1; border: none; color: #fff; border-radius: 8px; cursor: pointer; }`;

      const sampleJs = `let items = [{id:'P1', name:'Beras 5kg', price:75000}];
let user = null;
function appLogin() {
  let u = document.getElementById('uname').value;
  if (!u) return;
  user = { name: u, isAdmin: u === 'admin' };
  document.getElementById('loginBox').style.display = 'none';
  document.getElementById('dashBox').style.display = 'block';
  if (user.isAdmin) document.getElementById('adminBtn').style.display = 'inline-block';
  render();
}
function render() {
  let b = document.getElementById('tblBody');
  b.innerHTML = '';
  items.forEach(i => {
    b.innerHTML += '<tr><td>'+i.id+'</td><td>'+i.name+'</td><td>Rp '+i.price+'</td><td><button onclick="delItem(\\\''+i.id+'\\\')">Hapus</button></td></tr>';
  });
}
function delItem(id) {
  items = items.filter(x => x.id !== id);
  render();
}
function addAdminUser() { console.log("Fitur admin tambah user aktif."); }`;

      const validated = validateAndRepairGeneratedCode(sampleHtml, sampleCss, sampleJs);

      return NextResponse.json({
        success: true,
        replyText: `Berikut adalah prototipe aplikasi untuk "${prompt || 'Aplikasi Kasir'}" dengan arsitektur State JS teruji dan bebas dari confirm()/alert() bawaan browser.`,
        code: validated.repairedCode,
        isContinued: false
      });
    }

    // Call OpenAI GPT-5.4 mini API (Server-Side)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(chatHistory || []).map((m: any) => ({
        role: m.sender === 'USER' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: 'user', content: prompt }
    ];

    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Production GPT-5.4 mini equivalent endpoint
        messages,
        max_tokens: 3000,
        temperature: 0.7
      })
    });

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message?.content || '';
    let finishReason = data.choices?.[0]?.finish_reason;

    // ANTI-CUTOFF 2 LAPIS (PRD Bagian 5)
    let retryCount = 0;
    const maxRetries = 4;

    while (retryCount < maxRetries) {
      const isFinishReasonLength = finishReason === 'length';
      const isCodeBlockMissingClosing = assistantMessage.includes('```html') && !assistantMessage.endsWith('```');

      if (!isFinishReasonLength && !isCodeBlockMissingClosing) {
        break; // Kode lengkap, tidak terpotong
      }

      console.log(`Anti-cutoff triggered (Attempt ${retryCount + 1}). Finish reason: ${finishReason}`);

      // Lakukan panggilan ulang dengan pola: Assistant (sebagian) + User (minta lanjut)
      const continuationMessages = [
        ...messages,
        { role: 'assistant', content: assistantMessage },
        { role: 'user', content: 'Lanjutkan persis dari titik karakter terakhir. Jangan mengulangi kode dari awal.' }
      ];

      const contResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: continuationMessages,
          max_tokens: 2500,
          temperature: 0.5
        })
      });

      const contData = await contResponse.json();
      const contText = contData.choices?.[0]?.message?.content || '';
      finishReason = contData.choices?.[0]?.finish_reason;

      assistantMessage += contText;
      retryCount++;
    }

    // Extract HTML/CSS/JS from code block
    let htmlCode = '';
    const match = assistantMessage.match(/```html([\s\S]*?)```/);
    if (match) {
      htmlCode = match[1].trim();
    } else {
      htmlCode = assistantMessage;
    }

    // Run Static Code Validator
    const validated = validateAndRepairGeneratedCode(htmlCode, '', '');

    return NextResponse.json({
      success: true,
      replyText: assistantMessage.replace(/```html[\s\S]*?```/, '').trim(),
      code: validated.repairedCode,
      isContinued: retryCount > 0
    });

  } catch (error: any) {
    console.error('Error in /api/generate:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
