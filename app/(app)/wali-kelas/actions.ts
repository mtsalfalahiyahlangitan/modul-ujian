'use server';
import { revalidatePath } from 'next/cache';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { fail, ok, gagal, sukses, num, str, type FormState } from '@/lib/util';

export async function simpanWali(fd: FormData): Promise<FormState> {
  const me = await requireAkses('wali');
  const id = num(fd.get('id'));
  const nama = str(fd.get('nama')).slice(0, 100);
  const kelas = [...new Set(fd.getAll('kelas').map((k) => String(k).trim()).filter(Boolean))];
  if (!nama) return gagal('Nama wali kelas wajib diisi');
  if (!kelas.length) return gagal('Pilih minimal satu kelas');
  const db = adminDb();
  const { error } = id ? await db.from('wali_kelas').update({ nama, kelas }).eq('id', id) : await db.from('wali_kelas').insert({ nama, kelas });
  if (error) {
    if (error.code === '23505') return gagal('Nama wali kelas sudah ada');
    if (/wali_kelas|schema cache|does not exist/i.test(error.message)) return gagal('Tabel wali_kelas belum ada. Jalankan supabase/migration_wali_kelas.sql di Supabase SQL Editor.');
    return gagal(error.message);
  }
  await audit(me.id, id ? 'wali_ubah' : 'wali_tambah', { nama, kelas });
  revalidatePath('/', 'layout');
  return sukses('Wali kelas tersimpan');
}

export async function hapusWali(fd: FormData) {
  const me = await requireAkses('wali');
  const id = num(fd.get('id'));
  const { error } = await adminDb().from('wali_kelas').delete().eq('id', id);
  if (error) fail('/wali-kelas', error.message);
  await audit(me.id, 'wali_hapus', { id });
  ok('/wali-kelas', 'Wali kelas dihapus');
}
