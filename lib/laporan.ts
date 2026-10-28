import { adminDb } from './supabase/admin';
import { fetchAll, statusSiswa } from './util';
import { terapkanJadwal } from './schedule';

export type BarisLaporan = {
  siswa_id: number; gelombang_id: number | null;
  no_induk: string; nama: string; asrama: string; kelas: string;
  ruang: string; gelombang: string; status: string;
  datang: string | null; pulang: string | null; keterangan: string | null;
};

export async function buildLaporan(opt: { ruangId: number | null; gelId: number | null; tanggal: string }) {
  const db = adminDb();
  // keempat pengambilan data saling bebas, jadi dijalankan bersamaan
  const [ruangR, gelR, siswa, absensi] = await Promise.all([db.from('ruang').select('*'), db.from('gelombang').select('*'), fetchAll((a, b) => {
    let q = db.from('siswa').select('*, siswa_gelombang(gelombang_id)');
    if (opt.ruangId != null) q = q.eq('ruang_id', opt.ruangId);
    return q.order('ruang_id').order('nama').order('id').range(a, b);
  }), fetchAll((a, b) => {
    let q = db.from('absensi').select('*, siswa!inner(ruang_id)').eq('tanggal_ujian', opt.tanggal);
    if (opt.ruangId != null) q = q.eq('siswa.ruang_id', opt.ruangId);
    if (opt.gelId != null) q = q.eq('gelombang_id', opt.gelId);
    return q.order('id').range(a, b);
  })]);
  const ruangMap = new Map<number, any>((ruangR.data ?? []).map((r: any) => [r.id, r]));
  const gelMap = new Map<number, any>(terapkanJadwal(gelR.data ?? []).gels.map((g: any) => [g.id, g]));
  const absMap = new Map<string, any>(absensi.map((x) => [`${x.siswa_id}-${x.gelombang_id}`, x]));

  // Satu baris = satu siswa x satu gelombang (siswa gelombang 1&3 -> 2 baris)
  const rows: BarisLaporan[] = siswa.flatMap((s) => {
    let ids: (number | null)[] = (s.siswa_gelombang ?? [])
      .map((x: any) => x.gelombang_id as number)
      .sort((x: number, y: number) => (gelMap.get(x)?.urutan ?? 999) - (gelMap.get(y)?.urutan ?? 999));
    if (opt.gelId != null) ids = ids.filter((id) => id === opt.gelId);
    else if (!ids.length) ids = [null]; // siswa tanpa gelombang tetap tampil
    return ids.map((gid) => {
      const gel = gid != null ? gelMap.get(gid) : null;
      const a = gid != null ? absMap.get(`${s.id}-${gid}`) ?? null : null;
      return {
        siswa_id: s.id, gelombang_id: gid,
        no_induk: s.no_induk, nama: s.nama, asrama: s.asrama, kelas: s.kelas,
        ruang: ruangMap.get(s.ruang_id)?.kode_ruang ?? '-',
        gelombang: gel?.nama_gelombang ?? '-',
        status: statusSiswa(a, gel?.status),
        datang: a?.waktu_datang ?? null, pulang: a?.waktu_pulang ?? null,
        keterangan: a?.keterangan ?? null,
      };
    });
  });
  return { rows, ruang: opt.ruangId ? ruangMap.get(opt.ruangId) : null };
}
