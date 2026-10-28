// Hak akses menu. File ini murni (tanpa server), dipakai server dan komponen client.
//   Administrator (super_admin): semua menu + Pengaturan.
//   Staf: hanya menu yang dicentang di Pengaturan. Tidak terikat ruang.
//   Petugas ruang: Absensi dan Laporan, khusus ruangnya sendiri.
// Pengaturan (kelola akun) sengaja hanya untuk Administrator: siapa pun yang bisa mengelola akun bisa memberi dirinya akses penuh.
// Menu Persyaratan ujian punya lapisan tambahan untuk staf: tiap sub menu (Dashboard, Absen 10%, dst.) dicentang sendiri,
// dan tiap sub menu dibatasi ke tingkat kelas tertentu (7/8/9, sesuai tingkat kelas siswa di data siswa) atau semua tingkat.
import { JENIS_PERSYARATAN } from './jenis-persyaratan';
import { tingkatDariKelas } from './tingkat';

export const AREA = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', desc: 'Ringkasan kehadiran ujian' },
  { key: 'siswa', label: 'Data siswa', href: '/siswa', desc: 'Tambah, ubah, impor, dan hapus data siswa' },
  { key: 'persyaratan', label: 'Persyaratan ujian', href: '/persyaratan', desc: 'Unggah data penjaringan, tandai lengkap, cetak, dan unduh' },
  { key: 'wali', label: 'Wali kelas', href: '/wali-kelas', desc: 'Mengatur daftar wali kelas dan link untuk wali' },
  { key: 'ruang', label: 'Ruang & petugas', href: '/ruang', desc: 'Mengelola ruang dan akun petugas ruang' },
  { key: 'gelombang', label: 'Gelombang', href: '/gelombang', desc: 'Mengatur jadwal dan status gelombang ujian' },
  { key: 'absen', label: 'Absensi', href: '/absen', desc: 'Mencatat kehadiran siswa di semua ruang' },
  { key: 'laporan', label: 'Laporan', href: '/laporan', desc: 'Melihat dan mengunduh rekap kehadiran semua ruang' },
  { key: 'kartu', label: 'Kartu ujian', href: '/kartu-ujian', desc: 'Mengatur tampilan dan mencetak kartu ujian siswa' },
] as const;

export type KunciAkses = (typeof AREA)[number]['key'];
export type Peran = 'super_admin' | 'staf' | 'petugas';
export const KUNCI_AKSES: string[] = AREA.map((a) => a.key);
export const LABEL_PERAN: Record<Peran, string> = { super_admin: 'Administrator', staf: 'Staf', petugas: 'Petugas ruang' };

const AKSES_PETUGAS: string[] = ['absen', 'laporan'];

// ---------- Sub menu Persyaratan ujian ----------
export const SUB_PERSYARATAN = [
  { key: 'dashboard', label: 'Dashboard', href: '/persyaratan', desc: 'Ringkasan, cetak/unduh, dan upload data penjaringan' },
  ...JENIS_PERSYARATAN.map((j) => ({ key: j.slug as string, label: j.nama as string, href: `/persyaratan/${j.slug}`, desc: `Daftar siswa terjaring ${j.nama}` })),
];
export type KunciSub = string;
export const KUNCI_SUB: string[] = SUB_PERSYARATAN.map((x) => x.key);

// Batas tingkat kelas satu sub menu: '*' = semua tingkat, atau daftar tingkat (mis. [7, 8]).
// Sub menu yang tidak ada di peta = tidak boleh dibuka.
export type AksesPersyaratan = Record<string, '*' | number[]>;

// null = tanpa pembatasan (akun lama sebelum fitur ini ada: semua sub menu, semua tingkat).
export function bacaAksesPersyaratan(raw: unknown): AksesPersyaratan | null {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: AksesPersyaratan = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KUNCI_SUB.includes(k)) continue;
    if (v === '*') out[k] = '*';
    else if (Array.isArray(v)) {
      const t = [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 12))].sort((a, b) => a - b);
      if (t.length) out[k] = t;
    }
  }
  return out;
}

type Pelaku = { role: Peran; akses?: string[] | null; aksesPersyaratan?: AksesPersyaratan | null };

// Batas tingkat sub menu untuk akun ini: '*' semua tingkat, daftar tingkat, atau null (tidak boleh membuka sub menu itu).
export function batasSub(me: Pelaku, sub: KunciSub): '*' | number[] | null {
  if (me.role === 'super_admin') return '*';
  if (me.role !== 'staf' || !(me.akses ?? []).includes('persyaratan')) return null;
  if (!me.aksesPersyaratan) return '*';
  const v = me.aksesPersyaratan[sub];
  return v === undefined ? null : v;
}
export const bisaSub = (me: Pelaku, sub: KunciSub) => batasSub(me, sub) !== null;
export const subYangBoleh = (me: Pelaku) => SUB_PERSYARATAN.filter((x) => bisaSub(me, x.key));

// Boleh melihat / mengubah siswa dengan teks kelas ini di sub menu tsb? Tingkat tidak terbaca = hanya akun "semua tingkat".
export function bolehSiswa(me: Pelaku, sub: KunciSub, kelas: string | null | undefined): boolean {
  const b = batasSub(me, sub);
  if (b === null) return false;
  if (b === '*') return true;
  const t = tingkatDariKelas(kelas);
  return t !== null && b.includes(t);
}

// Halaman pertama Persyaratan ujian yang boleh dibuka akun ini
export const halamanPersyaratan = (me: Pelaku): string | null => subYangBoleh(me)[0]?.href ?? null;

export function bisa(me: Pelaku, kunci: KunciAkses | 'pengaturan'): boolean {
  if (me.role === 'super_admin') return true;
  if (kunci === 'pengaturan') return false;
  if (me.role === 'petugas') return AKSES_PETUGAS.includes(kunci);
  if (kunci === 'persyaratan') return (me.akses ?? []).includes(kunci) && subYangBoleh(me).length > 0; // dicentang tapi tanpa satu pun sub menu = tidak punya akses
  return (me.akses ?? []).includes(kunci);
}

// Administrator dan staf melihat semua ruang; petugas hanya ruangnya sendiri.
export const lihatSemuaRuang = (me: Pelaku) => me.role !== 'petugas';

// Halaman awal setelah login: menu pertama yang boleh dibuka
export function halamanAwal(me: Pelaku): string {
  const a = AREA.find((x) => bisa(me, x.key));
  if (!a) return '/tanpa-akses';
  return a.key === 'persyaratan' ? halamanPersyaratan(me) ?? '/tanpa-akses' : a.href;
}
