/**
 * PERSISTENT SLIDING WINDOW RATE LIMITER (Supabase-backed)
 * Menggantikan implementasi in-memory yang tidak efektif di multi-instance / redeploy.
 * Data tersimpan di tabel `public.rate_limits` — tidak hilang saat container restart.
 *
 * Identifier: user_id (jika terautentikasi) atau IP sebagai fallback.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';

// Konfigurasi Batas: Maksimal 15 request per 5 menit per user
const MAX_REQUESTS_PER_WINDOW = 15;
const WINDOW_DURATION_MS = 5 * 60 * 1000; // 5 menit

export async function checkRateLimit(identifier: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - WINDOW_DURATION_MS);

  try {
    // Ambil record rate limit untuk identifier ini
    const { data: record, error } = await supabaseAdmin
      .from('rate_limits')
      .select('request_count, window_start')
      .eq('identifier', identifier)
      .single();

    // Jika tabel belum ada / error koneksi — default allow agar user tidak terblokir
    if (error && error.code !== 'PGRST116') {
      console.warn('[RateLimit] DB error (fallback allow):', error.message);
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetInSeconds: 300 };
    }

    const windowStart = record ? new Date(record.window_start) : null;
    const isWindowExpired = !windowStart || windowStart < windowCutoff;

    if (isWindowExpired) {
      // Window expired atau record baru — reset counter
      await supabaseAdmin
        .from('rate_limits')
        .upsert(
          { identifier, request_count: 1, window_start: now.toISOString(), updated_at: now.toISOString() },
          { onConflict: 'identifier' }
        );
      return {
        allowed: true,
        remaining: MAX_REQUESTS_PER_WINDOW - 1,
        resetInSeconds: Math.ceil(WINDOW_DURATION_MS / 1000),
      };
    }

    const currentCount = record!.request_count;

    if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
      // Melebihi batas — hitung sisa waktu reset
      const resetInSeconds = Math.ceil(
        (windowStart!.getTime() + WINDOW_DURATION_MS - now.getTime()) / 1000
      );
      return { allowed: false, remaining: 0, resetInSeconds: Math.max(resetInSeconds, 1) };
    }

    // Increment counter
    await supabaseAdmin
      .from('rate_limits')
      .update({ request_count: currentCount + 1, updated_at: now.toISOString() })
      .eq('identifier', identifier);

    const resetInSeconds = Math.ceil(
      (windowStart!.getTime() + WINDOW_DURATION_MS - now.getTime()) / 1000
    );
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - currentCount - 1,
      resetInSeconds: Math.max(resetInSeconds, 1),
    };
  } catch (err) {
    // Fallback allow jika terjadi exception tak terduga
    console.warn('[RateLimit] Unexpected error (fallback allow):', err);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1, resetInSeconds: 300 };
  }
}
