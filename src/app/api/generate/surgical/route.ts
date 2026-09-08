import { NextResponse } from 'next/server';
import { cleanConversationalLeaks } from '@/lib/cleanLeaks';
import { checkRateLimit } from '@/lib/rateLimiter';
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  OPENROUTER_DEFAULT_MODEL,
  OPENROUTER_SITE_URL,
  OPENROUTER_APP_TITLE,
  getGeminiModel,
  getOpenAIModel
} from '@/app/api/generate/route';
import { OPENROUTER_API_BASE, OPENAI_API_BASE } from '@/lib/modelConfig';

function buildOpenAICompatHeaders(apiKey: string | undefined, isOpenRouter: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
  if (isOpenRouter) {
    headers['X-OpenRouter-Title'] = OPENROUTER_APP_TITLE;
    headers['HTTP-Referer'] = OPENROUTER_SITE_URL;
  }
  return headers;
}

export const maxDuration = 60; // 60 detik batas maksimal

export async function POST(req: Request) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit tercapai. Silakan coba lagi beberapa saat lagi.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      elementHtml,
      instruction,
      appContext = '',
      tagName = 'element',
      provider = 'gemini',
      apiKey: userApiKey,
      model: userModel
    } = body;

    if (!elementHtml || typeof elementHtml !== 'string' || !instruction || typeof instruction !== 'string') {
      return NextResponse.json(
        { success: false, error: 'elementHtml dan instruction wajib diisi.' },
        { status: 400 }
      );
    }

    const hasUserKey = typeof userApiKey === 'string' && userApiKey.trim().length > 0;
    const useUserKey = hasUserKey;

    const requestedProvider = useUserKey
      ? (provider === 'gemini' ? 'gemini' : 'openai')
      : (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();

    const isUserGemini = useUserKey && provider === 'gemini';
    const isOpenRouter = useUserKey && (provider === 'openrouter' || (typeof userApiKey === 'string' && userApiKey.startsWith('sk-or-')));

    const geminiApiKey = isUserGemini ? userApiKey.trim() : process.env.GEMINI_API_KEY;
    const aiProvider = isUserGemini ? 'gemini' : requestedProvider;

    const openaiApiKey = isUserGemini ? undefined : (useUserKey ? userApiKey.trim() : process.env.OPENAI_API_KEY);
    const openaiBaseUrl = isUserGemini
      ? undefined
      : (useUserKey ? (isOpenRouter ? OPENROUTER_API_BASE : OPENAI_API_BASE) : 'https://api.openai.com/v1');

    const activeGeminiModel = isUserGemini ? (userModel || DEFAULT_GEMINI_MODEL) : getGeminiModel();
    const activeOpenAIModel = useUserKey ? (userModel || (isOpenRouter ? OPENROUTER_DEFAULT_MODEL : DEFAULT_OPENAI_MODEL)) : getOpenAIModel();

    const systemPrompt = `Anda adalah Surgical UI Component Engineer yang sangat ahli, presisi, dan berkecepatan tinggi.
Tugas Anda: Memodifikasi HANYA satu elemen HTML/komponen antarmuka pengguna berdasarkan instruksi revisi yang diminta pengguna.

ATURAN WAJIB & KETAT:
1. Kembalikan HANYA cuplikan kode HTML untuk elemen tersebut yang dibungkus dalam blok \`\`\`html ... \`\`\`.
2. DILARANG KERAS menyertakan <!DOCTYPE html>, <html>, <head>, atau <body>. HANYA satu elemen komponen itu sendiri (<${tagName}>...</${tagName}> atau self-closing) beserta elemen anaknya jika ada.
3. DILARANG menambahkan teks penjelasan, narasi, ringkasan markdown, atau percakapan apapun di luar blok kode.
4. Pertahankan atribut penting yang sudah ada (seperti id, onclick, data-access-roles, data-od-uid) jika masih relevan, kecuali jika instruksi secara eksplisit meminta untuk mengubahnya.
5. Terapkan desain visual yang modern, bersih, profesional, dengan pemilihan warna yang harmonis dan micro-interactions yang elegan.
6. Pastikan seluruh tag pembuka dan penutup berpasangan dengan sempurna tanpa syntax error.`;

    const userPrompt = `ELEMEN HTML YANG AKAN DIUBAH:
\`\`\`html
${elementHtml}
\`\`\`

INSTRUKSI PERUBAHAN:
"${instruction}"

${appContext ? `KONTEKS APLIKASI: ${appContext}` : ''}

KEMBALIKAN HANYA KODE HTML ELEMEN HASIL MODIFIKASI:`;

    let rawOutput = '';
    let lastErrorMsg = '';

    // Prioritas 1: Gemini (jika provider gemini, atau fallback server)
    if ((aiProvider === 'gemini' || !aiProvider) && geminiApiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${activeGeminiModel}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
            })
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          rawOutput = geminiData.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
        } else {
          const errText = await geminiRes.text();
          console.warn('Gemini surgical generation HTTP error:', geminiRes.status, errText);
          lastErrorMsg = `Gemini (${geminiRes.status}): ${errText.slice(0, 150)}`;
        }
      } catch (geminiErr: any) {
        console.warn('Gemini surgical generation failed, falling back if available...', geminiErr);
        lastErrorMsg = `Gemini: ${geminiErr?.message || String(geminiErr)}`;
      }
    }

    // Fallback atau Jalur 2: OpenAI / OpenRouter
    if (!rawOutput && openaiApiKey) {
      try {
        const openaiRes = await fetch(`${openaiBaseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
          method: 'POST',
          headers: buildOpenAICompatHeaders(openaiApiKey, isOpenRouter),
          body: JSON.stringify({
            model: activeOpenAIModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 2048,
            temperature: 0.2
          })
        });

        if (openaiRes.ok) {
          const openaiData = await openaiRes.json();
          rawOutput = openaiData.choices?.[0]?.message?.content || '';
        } else {
          const errText = await openaiRes.text();
          console.warn('OpenAI surgical generation HTTP error:', openaiRes.status, errText);
          lastErrorMsg = `OpenAI (${openaiRes.status}): ${errText.slice(0, 150)}`;
        }
      } catch (openaiErr: any) {
        console.warn('OpenAI surgical generation failed:', openaiErr);
        lastErrorMsg = `OpenAI: ${openaiErr?.message || String(openaiErr)}`;
      }
    }

    // Jika OpenAI adalah pilihan utama tapi gagal, coba fallback ke Gemini jika ada key server
    if (!rawOutput && !isUserGemini && process.env.GEMINI_API_KEY && geminiApiKey !== process.env.GEMINI_API_KEY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
            })
          }
        );
        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          rawOutput = geminiData.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
        }
      } catch (err) {}
    }

    if (!rawOutput) {
      return NextResponse.json(
        { success: false, error: lastErrorMsg || 'Gagal mendapatkan respon dari AI untuk pembaruan elemen bedah.' },
        { status: 502 }
      );
    }

    // Ekstrak cuplikan HTML
    let updatedElementHtml = '';
    const match = rawOutput.match(/```html([\s\S]*?)```/);
    if (match) {
      updatedElementHtml = match[1].trim();
    } else if (rawOutput.includes('```html')) {
      updatedElementHtml = rawOutput.split('```html')[1].replace(/```[\s\S]*$/, '').trim();
    } else {
      updatedElementHtml = rawOutput.trim();
    }

    // Sanitasi ekstra: potong markdown dan sisa teks percakapan
    updatedElementHtml = cleanConversationalLeaks(updatedElementHtml);

    return NextResponse.json({
      success: true,
      updatedElementHtml
    });
  } catch (err: any) {
    console.error('Error in /api/generate/surgical:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
