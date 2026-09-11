import { NextResponse } from 'next/server';
import { ensureSemanticIndex } from '@/lib/semanticSearch';

export const maxDuration = 120;

/**
 * Endpoint internal untuk seeding/refresh index semantic.
 * Dilindungi dengan header `x-seed-key` yang harus sama dengan SUPABASE_SERVICE_ROLE_KEY.
 * Hanya dipakai oleh script operasional, bukan oleh user aplikasi.
 */
export async function POST(req: Request) {
  const seedKey = req.headers.get('x-seed-key') || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceKey || seedKey !== serviceKey) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (!geminiKey) {
    return NextResponse.json(
      { success: false, error: 'GEMINI_API_KEY belum dikonfigurasi di server.' },
      { status: 400 }
    );
  }

  const result = await ensureSemanticIndex(geminiKey);
  return NextResponse.json({ success: result.ok, ...result });
}
