import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Anda harus login terlebih dahulu.' }, { status: 401 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return unauthorized();

  const { id } = await params;

  const { error } = await supabase
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