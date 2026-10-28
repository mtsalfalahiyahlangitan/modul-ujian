import { batasiKelas, filterSiswa } from './siswa-filter';
import { fetchAll } from './util';
import { singkatJenis } from './persyaratan';
import { uraiKelas } from './tingkat';
import type { adminDb } from './supabase/admin';

// Data untuk cetak / unduh daftar penjaringan persyaratan ujian (halaman /cetak/persyaratan dan /api/persyaratan/unduh).
export type StatusCetak = 'semua' | 'terjaring' | 'lengkap';
export const LABEL_STATUS_CETAK: Record<StatusCetak, string> = { semua: 'SEMUA', terjaring: 'TERJARING', lengkap: 'LENGKAP' };
export const JUDUL_CETAK_DEFAULT = 'DATA PENJARINGAN PERSYARATAN UJIAN TENGAH SEMESTER 2 1447-1448 H/2026-2027 M';
export const SUB_JUDUL_CETAK = 'MADRASAH TSANAWIYAH AL FALAHIYAH PONDOK PESANTREN LANGITAN';

export type ParamCetak = { status?: string; kelas?: string; asrama?: string; judul?: string; maks?: string };
export type BarisCetak = {
  no_induk: string; nama: string; asrama: string; kelas: string;
  terjaring: { kode: string; nama: string; lengkap: boolean }[];
};

export const bacaParamCetak = (sp: ParamCetak) => ({
  status: (sp.status === 'terjaring' || sp.status === 'lengkap' ? sp.status : 'semua') as StatusCetak,
  kelas: (sp.kelas ?? '').trim().slice(0, 30),
  asrama: (sp.asrama ?? '').trim().slice(0, 30),
  judul: (sp.judul ?? '').trim().slice(0, 150) || JUDUL_CETAK_DEFAULT,
  // batas jumlah halaman cetak (mis. muat di mading 16 lembar); kosong = tanpa batas
  maks: (() => { const n = Math.floor(Number(sp.maks)); return Number.isFinite(n) && n >= 1 && n <= 999 ? n : null; })(),
});

// ---------- Urutan cetak: kelas dulu (tingkat, lalu rombel), kemudian nama sesuai abjad ----------
const urut = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });
export function bandingKelas(a: string, b: string): number {
  const x = uraiKelas(a), y = uraiKelas(b);
  if (x.tingkat !== null && y.tingkat !== null) return x.tingkat - y.tingkat || urut(x.sisa, y.sisa);
  if (x.tingkat !== null) return -1; // kelas yang terbaca tingkatnya didahulukan
  if (y.tingkat !== null) return 1;
  return urut(a.trim(), b.trim());
}
export const bandingNama = (a: string, b: string) => urut(a.trim(), b.trim());

// Arti filter:
//   semua     = semua siswa, terjaring maupun tidak
//   terjaring = siswa yang terjaring di minimal satu persyaratan (lengkap atau belum)
//   lengkap   = siswa terjaring yang SEMUA persyaratannya sudah lengkap
// batasKelas: daftar teks kelas yang boleh dilihat akun (null = semua kelas). Dipakai untuk akun yang dibatasi tingkat kelas.
export async function ambilDataCetak(db: ReturnType<typeof adminDb>, p: ReturnType<typeof bacaParamCetak>, batasKelas: string[] | null = null) {
  const jenisR = await db.from('persyaratan_jenis').select('id,kode,nama,data_terakhir').order('urutan').order('id');
  if (jenisR.error) throw new Error(jenisR.error.message);
  const jenis = (jenisR.data ?? []) as { id: number; kode: string; nama: string; data_terakhir: string | null }[];
  const urutan = new Map(jenis.map((j, i) => [j.id, i] as const));
  const infoJenis = new Map(jenis.map((j) => [j.id, j] as const));

  const data = await fetchAll((from, to) =>
    batasiKelas(filterSiswa(db.from('siswa').select('id,no_induk,nama,asrama,kamar,kelas,pt:persyaratan_terjaring(jenis_id,lengkap)'), { kelas: p.kelas, asrama: p.asrama }), batasKelas)
      .order('id').range(from, to));

  const baris: BarisCetak[] = data
    .map((s: any) => ({
      no_induk: String(s.no_induk), nama: String(s.nama), kelas: String(s.kelas ?? ''),
      asrama: `${s.asrama ?? ''}${s.kamar ? `, ${s.kamar}` : ''}`,
      terjaring: ((s.pt ?? []) as { jenis_id: number; lengkap: boolean }[])
        .slice().sort((a, b) => (urutan.get(a.jenis_id) ?? 99) - (urutan.get(b.jenis_id) ?? 99))
        .map((t) => ({ kode: infoJenis.get(t.jenis_id)?.kode ?? '', nama: infoJenis.get(t.jenis_id)?.nama ?? '?', lengkap: !!t.lengkap })),
    }))
    .filter((s) => p.status === 'semua' || (p.status === 'terjaring' ? s.terjaring.length > 0 : s.terjaring.length > 0 && s.terjaring.every((t) => t.lengkap)))
    .sort((a, b) => bandingKelas(a.kelas, b.kelas) || bandingNama(a.nama, b.nama));

  return { baris, adaData: jenis.some((j) => j.data_terakhir), jenis: jenis.map((j) => ({ kode: j.kode, nama: j.nama })) };
}

// Persyaratan yang MASIH BELUM lengkap (yang sudah lengkap tidak ditampilkan agar tidak membingungkan), dalam bentuk singkatan.
export const belumLengkap = (s: BarisCetak) => s.terjaring.filter((t) => !t.lengkap).map((t) => ({ kode: t.kode, singkatan: singkatJenis(t.kode, t.nama) }));

// Teks kolom persyaratan (dipakai Excel). Bila semua persyaratan siswa sudah lengkap -> "Lengkap"; tidak terjaring sama sekali -> "Tidak terjaring".
export function teksPersyaratan(s: BarisCetak, adaData: boolean) {
  const belum = belumLengkap(s);
  if (belum.length) return belum.map((t) => t.singkatan).join(', ');
  if (s.terjaring.length) return 'Lengkap';
  return adaData ? 'Tidak terjaring' : '-';
}
