import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from './supabase/server';
import { adminDb } from './supabase/admin';
import { fetchAll } from './util';
import { tingkatDariKelas } from './tingkat';
import { batasiKelas } from './siswa-filter';
export { batasiKelas }; // dipakai halaman bersama requireAksesSub
import { bacaAksesPersyaratan, batasSub, bisa, bisaSub, halamanAwal, halamanPersyaratan, type AksesPersyaratan, type KunciAkses, type KunciSub, type Peran } from './akses';

export type Me = {
  id: string;
  username: string;
  nama: string;
  role: Peran;
  ruang_id: number | null;
  akses: string[]; // menu yang boleh dibuka (hanya berarti untuk staf)
  aksesPersyaratan: AksesPersyaratan | null; // sub menu Persyaratan ujian + batas tingkat kelas (null = tanpa pembatasan)
};

// Halaman awal setelah login: menu pertama yang boleh dibuka (admin -> dashboard, petugas -> absensi)
export function homeFor(me: Me) {
  return halamanAwal(me);
}

// cache(): layout dan halaman memanggil getMe() pada request yang sama, tapi hanya dijalankan sekali.
// getClaims(): memverifikasi JWT di server ini (tanpa perjalanan ke server Auth Supabase) bila
// project memakai signing key asimetris; bila tidak, otomatis kembali ke pengecekan lewat jaringan.
export const getMe = cache(async (): Promise<Me | null> => {
  const sb = await createSupabaseServer();
  const { data } = await sb.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return null;
  const { data: row } = await adminDb().from('users').select('*').eq('id', uid).maybeSingle();
  return row ? ({ ...row, akses: row.akses ?? [], aksesPersyaratan: bacaAksesPersyaratan(row.akses_persyaratan) } as Me) : null;
});

export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect('/login?error=' + encodeURIComponent('Akun belum terdaftar di tabel users'));
  return me;
}

// Wajib punya akses ke satu area menu; bila tidak, dialihkan ke halaman awal milik akun itu.
export async function requireAkses(kunci: KunciAkses): Promise<Me> {
  const me = await requireMe();
  if (!bisa(me, kunci)) redirect(homeFor(me));
  return me;
}

// Khusus Administrator (Pengaturan / kelola akun).
export async function requireAdmin(): Promise<Me> {
  const me = await requireMe();
  if (me.role !== 'super_admin') redirect(homeFor(me));
  return me;
}

export function bolehAksesRuang(me: Me, ruangId: number | null) {
  return me.role !== 'petugas' || (ruangId !== null && me.ruang_id === ruangId);
}

// ---------- Persyaratan ujian: akses per sub menu + batas tingkat kelas ----------
// Teks kelas yang ada di data siswa (apa adanya, tanpa duplikat). Satu kali per request.
export const daftarKelasSiswa = cache(async (): Promise<string[]> => {
  const data = await fetchAll((from, to) => adminDb().from('siswa').select('kelas').order('id').range(from, to));
  return [...new Set(data.map((r: any) => String(r.kelas ?? '')))];
});

// Daftar teks kelas yang boleh dilihat akun ini di sub menu tsb, untuk disaring dengan .in('kelas', ...).
// null = semua kelas (tanpa penyaringan). Daftar kosong = tidak ada kelas yang boleh (hasil query kosong).
export async function kelasBoleh(me: Me, sub: KunciSub): Promise<string[] | null> {
  const b = batasSub(me, sub);
  if (b === '*') return null;
  if (b === null) return [];
  return (await daftarKelasSiswa()).filter((k) => { const t = tingkatDariKelas(k); return t !== null && b.includes(t); });
}

// Wajib punya akses ke satu sub menu Persyaratan ujian. Bila tidak, dialihkan ke sub menu pertama yang boleh dibuka.
// kelas = batas kelas untuk query; semuaTingkat = akun ini tidak dibatasi tingkat di sub menu itu.
export async function requireAksesSub(sub: KunciSub): Promise<{ me: Me; kelas: string[] | null; semuaTingkat: boolean }> {
  const me = await requireMe();
  if (!bisaSub(me, sub)) redirect(halamanPersyaratan(me) ?? homeFor(me));
  return { me, kelas: await kelasBoleh(me, sub), semuaTingkat: batasSub(me, sub) === '*' };
}

// Upload, hapus data, dan target minimal bersifat menyeluruh (mengganti data semua siswa), jadi hanya untuk akun yang
// punya Dashboard dengan semua tingkat.
export const bolehKelolaData = (me: Me) => batasSub(me, 'dashboard') === '*';
