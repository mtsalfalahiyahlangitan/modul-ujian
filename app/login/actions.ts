'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServer } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { homeFor } from '@/lib/auth';

export async function login(fd: FormData) {
  // Terima "admin" maupun "admin@absensi.local"
  const username = String(fd.get('username') ?? '').trim().toLowerCase().replace(/@absensi\.local$/, '');
  const password = String(fd.get('password') ?? '');
  const sb = await createSupabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: `${username}@absensi.local`, password });
  if (error) {
    const pesan = error.message === 'Invalid login credentials'
      ? 'Username atau password salah'
      : `${error.message} [status ${error.status ?? '-'}]`;
    redirect('/login?error=' + encodeURIComponent(pesan));
  }

  // Cek profil & arahkan sesuai peran
  const { data: { user } } = await sb.auth.getUser();
  const { data: profil } = await adminDb().from('users').select('id,role,ruang_id').eq('id', user!.id).maybeSingle();
  if (!profil) {
    await sb.auth.signOut();
    redirect('/login?error=' + encodeURIComponent('Akun belum terdaftar di tabel users'));
  }
  redirect(homeFor(profil as any));
}

export async function logout() {
  const sb = await createSupabaseServer();
  await sb.auth.signOut();
  revalidatePath('/', 'layout'); // buang cache halaman milik pengguna sebelumnya
  redirect('/login');
}
