import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUserFromRequest } from '@/lib/supabase/user';
import { cleanConversationalLeaks } from '@/lib/cleanLeaks';

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Anda harus login terlebih dahulu.' }, { status: 401 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('app_projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json({ success: false, error: 'Gagal menghapus file.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return unauthorized();

  const { id } = await params;

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

  const annotations = body.annotations && typeof body.annotations === 'object' ? body.annotations : {};

  const { data, error } = await supabaseAdmin
    .from('app_projects')
    .update({
      title,
      description,
      canvas_html: canvasHtml,
      canvas_css: canvasCss,
      canvas_js: canvasJs,
      gas_script: body.gas_script ? String(body.gas_script) : null,
      gas_web_app_url: body.gas_web_app_url ? String(body.gas_web_app_url) : null,
      spreadsheet_id: body.spreadsheet_id ? String(body.spreadsheet_id) : null,
      annotations
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, title, description, app_type, status, canvas_html, canvas_css, canvas_js, gas_script, gas_web_app_url, spreadsheet_id, annotations, created_at, updated_at')
    .single();

  if (error) {
    console.error('Failed to update project:', error);
    return NextResponse.json({ success: false, error: 'Gagal memperbarui prototype.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, project: data }, { status: 200 });
}
