import { adminDb } from './supabase/admin';
import { fetchAll, tanggalHariIni } from './util';
import { terapkanJadwal } from './schedule';

// Ringkasan untuk dashboard & halaman laporan. ruangId = null -> semua ruang.
export async function loadSummary(ruangId: number | null) {
  const db = adminDb();
  const today = tanggalHariIni();
  const [gelR, ruangR, siswaRaw, absAll] = await Promise.all([
    db.from('gelombang').select('*').order('urutan'),
    db.from('ruang').select('*').order('kode_ruang'),
    fetchAll((a, b) => {
      let q = db.from('siswa').select('id,ruang_id,siswa_gelombang(gelombang_id)');
      if (ruangId != null) q = q.eq('ruang_id', ruangId);
      return q.order('id').range(a, b);
    }),
    fetchAll((a, b) => {
      let q = db.from('absensi').select('siswa_id,gelombang_id,status_kehadiran,waktu_pulang,siswa!inner(ruang_id)').eq('tanggal_ujian', today);
      if (ruangId != null) q = q.eq('siswa.ruang_id', ruangId);
      return q.order('id').range(a, b);
    }),
  ]);
  const { gels, jadwal } = terapkanJadwal(gelR.data ?? []);
  const ruang = (ruangR.data ?? []).filter((r: any) => ruangId == null || r.id === ruangId);
  // gelombang_ids: semua gelombang yang diikuti siswa (mis. [1,3])
  const siswa = siswaRaw.map((s: any) => ({
    id: s.id as number, ruang_id: s.ruang_id as number | null,
    gelombang_ids: (s.siswa_gelombang ?? []).map((x: any) => x.gelombang_id as number),
  }));
  const absensi = absAll;
  return { today, gels, ruang, siswa, absensi, jadwal };
}
