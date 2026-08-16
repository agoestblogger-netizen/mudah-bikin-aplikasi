/**
 * IN-MEMORY SLIDING WINDOW RATE LIMITER (PRD Bagian 10)
 * Membatasi panggilan AI per IP untuk mencegah eksploitasi biaya API OpenAI.
 */

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
}

const ipRequestMap = new Map<string, RateLimitRecord>();

// Konfigurasi Batas: Maksimal 15 request per 5 menit per IP
const MAX_REQUESTS_PER_WINDOW = 15;
const WINDOW_DURATION_MS = 5 * 60 * 1000; // 5 menit

export function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const now = Date.now();
  const record = ipRequestMap.get(clientIp);

  // Jika belum ada record atau window sudah kadaluarsa
  if (!record || now - record.firstRequestTime > WINDOW_DURATION_MS) {
    ipRequestMap.set(clientIp, {
      count: 1,
      firstRequestTime: now
    });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetInSeconds: Math.ceil(WINDOW_DURATION_MS / 1000)
    };
  }

  // Jika dalam window dan melebihi batas
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const resetInSeconds = Math.ceil((record.firstRequestTime + WINDOW_DURATION_MS - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds
    };
  }

  // Tambah hitungan
  record.count += 1;
  const resetInSeconds = Math.ceil((record.firstRequestTime + WINDOW_DURATION_MS - now) / 1000);
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - record.count,
    resetInSeconds
  };
}
