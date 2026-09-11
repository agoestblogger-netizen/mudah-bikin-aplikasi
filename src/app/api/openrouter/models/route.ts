import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimiter';
import { OPENROUTER_API_BASE } from '@/lib/modelConfig';
import type { AIModelOption } from '@/lib/modelConfig';

// In-memory cache sederhana agar tidak berulang kali memanggil OpenRouter jika banyak request dalam waktu dekat
let cachedModels: AIModelOption[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam

export async function GET(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  const rateLimit = await checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    // Jika kena rate limit tapi cache tersedia, berikan cache
    if (cachedModels && cachedModels.length > 0) {
      return NextResponse.json({ success: true, models: cachedModels, fromCache: true, total: cachedModels.length });
    }
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

  // Jika cache masih valid dan tidak ada custom API key yang spesifik diminta
  const now = Date.now();
  if (!apiKey && cachedModels && (now - lastCacheTime < CACHE_TTL_MS)) {
    return NextResponse.json({ success: true, models: cachedModels, fromCache: true, total: cachedModels.length });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${OPENROUTER_API_BASE}/models`, {
      method: 'GET',
      headers,
      next: { revalidate: 3600 }
    });

    if (!res.ok) {
      if (cachedModels && cachedModels.length > 0) {
        return NextResponse.json({ success: true, models: cachedModels, fromCache: true, total: cachedModels.length });
      }
      return NextResponse.json(
        { success: false, error: `Gagal memuat model dari OpenRouter (${res.status}).` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        name?: string;
        context_length?: number;
        pricing?: { prompt?: string | number; completion?: string | number };
        description?: string;
      }>;
    };

    const list: AIModelOption[] = (data.data || []).map((m) => {
      const promptCost = Number(m.pricing?.prompt || 0);
      const isFree = promptCost === 0 || m.id.endsWith(':free') || m.id === 'openrouter/free';
      const costPerM = promptCost * 1_000_000;

      let category: 'GRATIS' | 'EKONOMIS' | 'SEIMBANG' | 'UNGGUL' = 'SEIMBANG';
      if (isFree) {
        category = 'GRATIS';
      } else if (costPerM <= 0.35) {
        category = 'EKONOMIS';
      } else if (costPerM > 2.0) {
        category = 'UNGGUL';
      }

      let priceLabel = 'Gratis';
      if (!isFree) {
        priceLabel = costPerM < 0.01 ? '<$0.01' : `$${costPerM < 1 ? costPerM.toFixed(3) : costPerM.toFixed(2)}`;
      }

      let contextK = 'Auto';
      if (m.context_length) {
        if (m.context_length >= 1_000_000) {
          contextK = `${(m.context_length / 1_000_000).toFixed(1).replace('.0', '')}M`;
        } else {
          contextK = `${Math.round(m.context_length / 1000)}K`;
        }
      }

      return {
        id: m.id,
        label: m.name || m.id,
        category,
        pricePerMInput: priceLabel,
        context: contextK
      };
    });

    if (list.length > 0 && !apiKey) {
      cachedModels = list;
      lastCacheTime = now;
    }

    return NextResponse.json({ success: true, models: list, total: list.length });
  } catch (err) {
    console.error('OpenRouter models fetch error:', err);
    if (cachedModels && cachedModels.length > 0) {
      return NextResponse.json({ success: true, models: cachedModels, fromCache: true, total: cachedModels.length });
    }
    return NextResponse.json(
      { success: false, error: 'Gagal terhubung ke OpenRouter. Coba lagi nanti.' },
      { status: 500 }
    );
  }
}