import { filterSiswa } from './siswa-filter';
import { bandingKelas } from './persyaratan-cetak';
import { formatGelombang } from './gelombang-input';
import { fetchAll } from './util';
import { tingkatDariKelas } from './tingkat';
import { svgBarcode, svgQr } from './kartu-kode';
import { PENGATURAN_BAWAAN, TINGKAT_LAIN, singkatKartu, type DataKartu, type ItemKartu, type FilterKartu, type PengaturanKartu } from './kartu-ujian';
import type { adminDb } from './supabase/admin';

type Db = ReturnType<typeof adminDb>;

// Pengaturan kartu (satu baris). Tabel belum ada / baris kosong -> nilai bawaan; belumMigrasi = true bila tabelnya belum dibuat.
export async function ambilPengaturanKartu(db: Db): Promise<PengaturanKartu & { belumMigrasi: boolean }> {
  const [{ data, error }, kop] = await Promise.all([
    db.from('kartu_ujian_pengaturan').select('jenis_ujian,madrasah,tahun_ajaran,updated_at').eq('id', 1).maybeSingle(),
    db.from('kartu_ujian_pengaturan').select('id').eq('id', 1).not('kop_data', 'is', null).maybeSingle(), // hanya cek ada/tidak, isi gambar tidak ikut diambil
  ]);
  if (error) return { ...PENGATURAN_BAWAAN, belumMigrasi: true };
  if (!data) return { ...PENGATURAN_BAWAAN, belumMigrasi: false };
  return {
    jenis_ujian: data.jenis_ujian || PENGATURAN_BAWAAN.jenis_ujian,
    madrasah: data.madrasah || PENGATURAN_BAWAAN.madrasah,
    tahun_ajaran: data.tahun_ajaran || PENGATURAN_BAWAAN.tahun_ajaran,
    ada_kop: !!kop.data, versi: String(new Date(data.updated_at).getTime()), belumMigrasi: false,
  };
}

const urut = (a: string, b: string) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' });

// Siswa yang akan dicetak sesuai filter. Siswa tanpa no. ujian dipisah (tidak bisa dibuatkan barcode).
// Urutan: kelas (tingkat lalu rombel), lalu no. ujian.
export async function ambilDataKartu(db: Db, f: FilterKartu): Promise<{ kartu: DataKartu[]; tanpaNomor: { no_induk: string; nama: string; kelas: string }[] }> {
  const [jenisR, data] = await Promise.all([
    db.from('persyaratan_jenis').select('id,kode,nama,urutan').order('urutan').order('id'),
    fetchAll((a, b) => {
      const sel = 'id,no_induk,nama,kelas,no_ujian,no_bangku,ruang(kode_ruang),semua:siswa_gelombang(gelombang(id,urutan,nama_gelombang)),pt:persyaratan_terjaring(jenis_id,lengkap)'
        + (f.gel ? ',sg:siswa_gelombang!inner(gelombang_id)' : '');
      return filterSiswa(db.from('siswa').select(sel), { kelas: f.kelas, asrama: f.asrama, ruang: f.ruang, gel: f.gel }).order('id').range(a, b);
    }),
  ]);
  const jenis = new Map<number, { kode: string; nama: string; i: number }>(((jenisR.data ?? []) as any[]).map((j, i) => [j.id as number, { kode: j.kode as string, nama: j.nama as string, i }]));

  const kartu: DataKartu[] = [];
  const tanpaNomor: { no_induk: string; nama: string; kelas: string }[] = [];
  // Filter tingkat (7/8/9, dst.) dibaca dari teks kelas; 'lain' = kelas yang tingkatnya tidak terbaca
  const cocokTingkat = (kelas: unknown) => {
    if (!f.tingkat) return true;
    const t = tingkatDariKelas(String(kelas ?? ''));
    return f.tingkat === TINGKAT_LAIN ? t === null : t === Number(f.tingkat);
  };
  for (const s of data as any[]) {
    if (!cocokTingkat(s.kelas)) continue;
    const no_ujian = String(s.no_ujian ?? '').trim();
    if (!no_ujian) { tanpaNomor.push({ no_induk: s.no_induk, nama: s.nama, kelas: String(s.kelas ?? '') }); continue; }
    kartu.push({
      no_induk: String(s.no_induk), nama: String(s.nama), kelas: String(s.kelas ?? ''),
      ruang: s.ruang?.kode_ruang ?? '', gelombang: formatGelombang(((s.semua ?? []) as any[]).map((x) => x.gelombang).filter(Boolean)),
      no_ujian, no_bangku: String(s.no_bangku ?? '').trim(),
      ket: ((s.pt ?? []) as { jenis_id: number; lengkap: boolean }[])
        .map((t) => ({ t, j: jenis.get(t.jenis_id) })).filter((x) => x.j)
        .sort((a, b) => a.j!.i - b.j!.i)
        .map(({ t, j }) => ({ kode: j!.kode, nama: j!.nama, singkatan: singkatKartu(j!.kode, j!.nama), lengkap: !!t.lengkap })),
    });
  }
  kartu.sort((a, b) => bandingKelas(a.kelas, b.kelas) || urut(a.no_ujian, b.no_ujian) || urut(a.nama, b.nama));
  tanpaNomor.sort((a, b) => bandingKelas(a.kelas, b.kelas) || urut(a.nama, b.nama));
  return { kartu, tanpaNomor };
}

export const itemKartu = (d: DataKartu): ItemKartu => ({ d, qr: svgQr(d.no_induk), bar: svgBarcode(d.no_ujian) });
