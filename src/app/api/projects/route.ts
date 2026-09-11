import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUserFromRequest } from '@/lib/supabase/user';
import { cleanConversationalLeaks } from '@/lib/cleanLeaks';

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Anda harus login terlebih dahulu.' }, { status: 401 });
}

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('app_projects')
    .select('id, title, description, app_type, status, canvas_html, canvas_css, canvas_js, gas_script, gas_web_app_url, spreadsheet_id, annotations, session_state, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to list projects:', error);
    return NextResponse.json({ success: false, error: 'Gagal memuat daftar file tersimpan.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, projects: data || [] });
}

export async function POST(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Body permintaan tidak valid.' }, { status: 400 });
  }

  const title = String(body.title || '').trim().slice(0, 255) || 'Aplikasi Tanpa Nama';
  const description = body.description ? String(body.description).slice(0, 2000) : null;
  const canvasHtml = body.canvas_html ? cleanConversationalLeaks(String(body.canvas_html)) : null;
  const canvasCss = body.canvas_css ? String(body.canvas_css) : null;
  const canvasJs = body.canvas_js ? String(body.canvas_js) : null;

  const { data, error } = await supabaseAdmin
    .from('app_projects')
    .insert({
      user_id: user.id,
      title,
      description,
      app_type: 'web_app',
      status: 'canvas_active',
      canvas_html: canvasHtml,
      canvas_css: canvasCss,
      canvas_js: canvasJs,
      gas_script: body.gas_script ? String(body.gas_script) : null,
      gas_web_app_url: body.gas_web_app_url ? String(body.gas_web_app_url) : null,
      spreadsheet_id: body.spreadsheet_id ? String(body.spreadsheet_id) : null,
      annotations: body.annotations ? body.annotations : {},
      session_state: body.session_state && typeof body.session_state === 'object' ? body.session_state : {}
    })
    .select('id, title, description, app_type, status, canvas_html, canvas_css, canvas_js, gas_script, gas_web_app_url, spreadsheet_id, annotations, session_state, created_at, updated_at')
    .single();

  if (error) {
    console.error('Failed to save project:', error);
    return NextResponse.json({ success: false, error: 'Gagal menyimpan prototype.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, project: data }, { status: 201 });
}
