import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/app';

  if (error || errorDescription) {
    const msg = errorDescription || 'Link konfirmasi tidak valid atau sudah kedaluwarsa.';
    return NextResponse.redirect(`${origin}/login?error_msg=${encodeURIComponent(msg)}`);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeError) {
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        return NextResponse.redirect(`${origin}/login?error_msg=${encodeURIComponent('Link konfirmasi tidak valid atau sudah kedaluwarsa.')}`);
      }
    } catch (err) {
      console.error('Error exchanging code for session in auth callback:', err);
    }
  }

  // Return to destination or default to app workspace
  return NextResponse.redirect(`${origin}${next}`);
}
