'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminDb } from '@/lib/supabase/admin';
import { num, str } from '@/lib/util';
import { COOKIE_AKSES, COOKIE_WALI, aksesSah, kodeAkses, tandaAkses } from '@/lib/wali';

const OPSI = (maxAge: number) => ({ httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge, path: '/wali' });

// Wali memilih namanya; pilihan diingat di perangkat ini selama 1 tahun.
export async function pilihWali(fd: FormData) {
  if (!(await aksesSah())) redirect('/wali');
  const id = num(fd.get('id'));
  if (id) {
    const { data } = await adminDb().from('wali_kelas').select('id').eq('id', id).maybeSingle();
    if (data) (await cookies()).set(COOKIE_WALI, String(id), OPSI(60 * 60 * 24 * 365));
  }
  redirect('/wali');
}

export async function gantiWali() {
  (await cookies()).set(COOKIE_WALI, '', OPSI(0));
  redirect('/wali');
}

export async function masukKode(fd: FormData) {
  const k = kodeAkses();
  if (k && str(fd.get('kode')) === k) {
    (await cookies()).set(COOKIE_AKSES, tandaAkses(k), OPSI(60 * 60 * 24 * 90));
    redirect('/wali');
  }
  redirect('/wali?error=' + encodeURIComponent('Kode akses salah'));
}
