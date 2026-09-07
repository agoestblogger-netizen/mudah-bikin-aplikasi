import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getUserFromRequest } from '@/lib/supabase/user';

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