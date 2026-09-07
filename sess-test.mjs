import { createServerClient } from '@supabase/ssr';
const url = 'https://supabase.mudahbikinapps.store';
const anon = process.env.ANON;
const jwt = process.env.JWT;
const theuid = process.env.THEUID;
const session = JSON.stringify({
  access_token: jwt,
  refresh_token: 'dummy',
  expires_in: 3600,
  expires_at: Math.floor(Date.now()/1000) + 3600,
  token_type: 'bearer'
});
console.log('cookie value:', session.slice(0, 80), '...');
const sb = createServerClient(url, anon, {
  auth: { debug: true },
  cookies: {
    getAll: () => [{ name: 'sb-supabase-auth-token', value: session }],
    setAll: () => {}
  }
});
const { data, error } = await sb.auth.getSession();
console.log('hasSession:', !!data.session);
console.log('session keys:', data.session ? Object.keys(data.session) : null);
console.log('user:', data.session?.user ? JSON.stringify({id: data.session.user.id, role: data.session.user.role}) : 'NULL');
console.log('error:', error?.message ?? 'none');
