import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Klien browser menyimpan sesi di localStorage, bukan cookie. Ambil identitas user
// dari token akses yang dikirim via header Authorization (diverifikasi ke gotrue),
// lalu fallback ke cookie untuk alur login magic-link / OAuth.
export async function getUserFromRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const supabase = await createClient();

  if (bearerToken) {
    const { data, error } = await supabase.auth.getUser(bearerToken);
    if (!error && data.user) return data.user;
    return null;
  }

  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return data.user;
  return null;
}