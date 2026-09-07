import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimiter';
import { OPENROUTER_API_BASE } from '@/lib/modelConfig';
import type { AIModelOption } from '@/lib/modelConfig';

export async function GET(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  const rateLimit = checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Batas kuota request tercapai. Mohon tunggu ${rateLimit.resetInSeconds} detik sebelum mencoba kembali.`
      },
      { status: 429 }
    );
  }

  const auth = req.headers.get('authorization') || '';
  const apiKey = auth.replace(/^Bearer\s+/i, '').trim();
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key OpenRouter tidak ditemukan.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${OPENROUTER_API_BASE}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Gagal memuat model dari OpenRouter (${res.status}).` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as { data?: Array<{ id: string; name?: string; context_length?: number }> };
    const list: AIModelOption[] = (data.data || []).map((m) => ({
      id: m.id,
      label: m.name || m.id,
      category: 'GRATIS',
      pricePerMInput: 'Lihat di OpenRouter',
      context: m.context_length ? String(Math.round(m.context_length / 1000)) + 'K' : 'Auto'
    }));

    return NextResponse.json({ success: true, models: list });
  } catch (err) {
    console.error('OpenRouter models fetch error:', err);
    return NextResponse.json(
      { success: false, error: 'Gagal terhubung ke OpenRouter. Coba lagi nanti.' },
      { status: 500 }
    );
  }
}