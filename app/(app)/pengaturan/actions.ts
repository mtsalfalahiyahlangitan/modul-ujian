'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { KUNCI_AKSES, KUNCI_SUB, SUB_PERSYARATAN, type AksesPersyaratan } from '@/lib/akses';
import { adminDb } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { fail, ok, gagal, sukses, num, str, type FormState } from '@/lib/util';

const BELUM_MIGRASI = 'Database belum disiapkan. Jalankan supabase/migration_pengaturan_akses.sql di Supabase SQL Editor.';
const salahMigrasi = (m: string) => /user_role|akses|enum/i.test(m);
const BELUM_MIGRASI_SUB = 'Database belum disiapkan untuk pengaturan sub menu. Jalankan supabase/migration_akses_persyaratan.sql di Supabase SQL Editor.';
const pesanMigrasi = (m: string) => (/akses_persyaratan/i.test(m) ? BELUM_MIGRASI_SUB : BELUM_MIGRASI);

// Pilihan sub menu Persyaratan ujian dari form: persyaratan_sub (kunci sub menu) dan persyaratan_tingkat:<kunci> ("*" atau angka tingkat).
function bacaPersyaratan(fd: FormData): { peta: AksesPersyaratan } | { error: string } {
  const peta: AksesPersyaratan = {};
  const dipilih = [...new Set(fd.getAll('persyaratan_sub').map(String).filter((k) => KUNCI_SUB.includes(k)))];
  if (!dipilih.length) return { error: 'Pilih minimal satu sub menu Persyaratan ujian' };
  for (const key of dipilih) {
    const nilai = fd.getAll(`persyaratan_tingkat:${key}`).map(String);
    const label = SUB_PERSYARATAN.find((x) => x.key === key)?.label ?? key;
    if (nilai.includes('*')) { peta[key] = '*'; continue; }
    const t = [...new Set(nilai.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b);
    if (!t.length) return { error: `Pilih tingkat kelas untuk ${label} (atau pilih Semua)` };
    peta[key] = t;
  }
  return { peta };
}

// Tambah akun (id kosong) atau ubah akun (id terisi). Peran tidak bisa diubah setelah akun dibuat.
export async function simpanAkun(fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const db = adminDb();
  const id = str(fd.get('id'));
  const nama = str(fd.get('nama')).slice(0, 100);
  const password = str(fd.get('password'));
  const akses = [...new Set(fd.getAll('akses').map(String).filter((k) => KUNCI_AKSES.includes(k)))];
  if (!nama) return gagal('Nama wajib diisi');
  if (password && password.length < 6) return gagal('Password minimal 6 karakter');

  if (id) {
    const { data: u, error: e0 } = await db.from('users').select('id,role,username').eq('id', id).maybeSingle();
    if (e0 || !u) return gagal(e0?.message ?? 'Akun tidak ditemukan');
    if (u.role === 'staf' && !akses.length) return gagal('Pilih minimal satu menu untuk staf');
    let persyaratan: AksesPersyaratan = {};
    if (u.role === 'staf' && akses.includes('persyaratan')) {
      const r = bacaPersyaratan(fd);
      if ('error' in r) return gagal(r.error);
      persyaratan = r.peta;
    }
    const patch: Record<string, unknown> = { nama };
    if (u.role === 'staf') { patch.akses = akses; patch.akses_persyaratan = persyaratan; }
    const { error } = await db.from('users').update(patch).eq('id', id);
    if (error) return gagal(salahMigrasi(error.message) ? pesanMigrasi(error.message) : error.message);
    if (password) {
      const { error: e2 } = await db.auth.admin.updateUserById(id, { password });
      if (e2) return gagal(`Data tersimpan, tetapi password gagal diganti: ${e2.message}`);
    }
    await audit(me.id, 'akun_ubah', { username: u.username, akses: u.role === 'staf' ? akses : undefined, akses_persyaratan: u.role === 'staf' && akses.includes('persyaratan') ? persyaratan : undefined, ganti_password: !!password });
    revalidatePath('/', 'layout');
    return sukses('Akun tersimpan');
  }

  const peran = str(fd.get('peran'));
  const username = str(fd.get('username')).toLowerCase();
  const ruangId = num(fd.get('ruang_id'));
  if (!['super_admin', 'staf', 'petugas'].includes(peran)) return gagal('Pilih peran akun');
  if (!username) return gagal('Username wajib diisi');
  if (!/^[a-z0-9._-]+$/.test(username)) return gagal('Username hanya boleh huruf kecil, angka, titik, strip, underscore');
  if (password.length < 6) return gagal('Password minimal 6 karakter');
  if (peran === 'staf' && !akses.length) return gagal('Pilih minimal satu menu untuk staf');
  let persyaratan: AksesPersyaratan = {};
  if (peran === 'staf' && akses.includes('persyaratan')) {
    const r = bacaPersyaratan(fd);
    if ('error' in r) return gagal(r.error);
    persyaratan = r.peta;
  }
  if (peran === 'petugas') {
    if (!ruangId) return gagal('Pilih ruang untuk petugas');
    const { data: ada } = await db.from('users').select('id').eq('ruang_id', ruangId).eq('role', 'petugas').maybeSingle();
    if (ada) return gagal('Ruang ini sudah punya akun petugas');
  }

  const { data: created, error } = await db.auth.admin.createUser({ email: `${username}@absensi.local`, password, email_confirm: true });
  if (error || !created.user) return gagal(error?.message ?? 'Gagal membuat akun');
  const { error: e2 } = await db.from('users').insert({
    id: created.user.id, username, nama, role: peran,
    ruang_id: peran === 'petugas' ? ruangId : null,
    akses: peran === 'staf' ? akses : [],
    ...(peran === 'staf' ? { akses_persyaratan: persyaratan } : {}),
  });
  if (e2) {
    await db.auth.admin.deleteUser(created.user.id);
    if (salahMigrasi(e2.message)) return gagal(pesanMigrasi(e2.message));
    return gagal(e2.code === '23505' ? 'Username sudah dipakai' : e2.message);
  }
  await audit(me.id, 'akun_tambah', { username, peran, akses: peran === 'staf' ? akses : undefined, akses_persyaratan: peran === 'staf' && akses.includes('persyaratan') ? persyaratan : undefined });
  revalidatePath('/', 'layout');
  return sukses(`Akun ${username} dibuat`);
}

export async function hapusAkun(fd: FormData) {
  const me = await requireAdmin();
  const db = adminDb();
  const id = str(fd.get('id'));
  if (id === me.id) fail('/pengaturan', 'Akun yang sedang Anda pakai tidak bisa dihapus');
  const { data: u } = await db.from('users').select('id,role,username').eq('id', id).maybeSingle();
  if (!u) fail('/pengaturan', 'Akun tidak ditemukan');
  if (u.role === 'super_admin') {
    const { count } = await db.from('users').select('id', { count: 'exact', head: true }).eq('role', 'super_admin');
    if ((count ?? 0) <= 1) fail('/pengaturan', 'Administrator terakhir tidak bisa dihapus');
  }
  const { error } = await db.auth.admin.deleteUser(id);
  if (error) fail('/pengaturan', error.message);
  await audit(me.id, 'akun_hapus', { username: u.username, peran: u.role });
  ok('/pengaturan', `Akun ${u.username} dihapus`);
}
