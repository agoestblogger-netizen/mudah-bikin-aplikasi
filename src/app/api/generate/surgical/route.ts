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

    const serverGeminiKey = process.env.GEMINI_API_KEY;
    const serverOpenAiKey = process.env.OPENAI_API_KEY;

    let aiProvider = provider;
    if (aiProvider === 'gemini' && !userApiKey && !serverGeminiKey && serverOpenAiKey) {
      aiProvider = 'openai';
    } else if (aiProvider === 'openai' && !userApiKey && !serverOpenAiKey && serverGeminiKey) {
      aiProvider = 'gemini';
    }

    const isUserGemini = aiProvider === 'gemini' && !!userApiKey;
    const geminiApiKey = isUserGemini ? userApiKey : serverGeminiKey;

    const useUserKey = (aiProvider === 'openai' || aiProvider === 'openrouter') && !!userApiKey;
    const openaiApiKey = useUserKey ? userApiKey : serverOpenAiKey;
    const isOpenRouter = aiProvider === 'openrouter' || (useUserKey && typeof userApiKey === 'string' && userApiKey.startsWith('sk-or-'));
    const openaiBaseUrl = isOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';

    const activeGeminiModel = isUserGemini ? (userModel || DEFAULT_GEMINI_MODEL) : getGeminiModel();
    const activeOpenAIModel = useUserKey ? (userModel || OPENROUTER_DEFAULT_MODEL) : getOpenAIModel();

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

    // Prioritas 1: Gemini
    if (aiProvider === 'gemini' && geminiApiKey) {
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
        }
      } catch (geminiErr) {
        console.warn('Gemini surgical generation failed, falling back if available...', geminiErr);
      }
    }

    // Fallback atau Jalur 2: OpenAI / OpenRouter
    if (!rawOutput && openaiApiKey) {
      try {
        const openaiRes = await fetch(`${openaiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: buildOpenAICompatHeaders(openaiApiKey, isOpenRouter),
          body: JSON.stringify({
            model: activeOpenAIModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_completion_tokens: 2048,
            temperature: 0.2
          })
        });

        if (openaiRes.ok) {
          const openaiData = await openaiRes.json();
          rawOutput = openaiData.choices?.[0]?.message?.content || '';
        }
      } catch (openaiErr) {
        console.warn('OpenAI surgical generation failed:', openaiErr);
      }
    }

    if (!rawOutput) {
      return NextResponse.json(
        { success: false, error: 'Gagal mendapatkan respon dari AI untuk pembaruan elemen bedah.' },
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
