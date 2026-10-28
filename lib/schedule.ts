// Jadwal berbasis DURASI:
//   mulai gelombang N = mulai gelombang N-1 + durasi ujian N-1 + jeda N-1
// Prioritas waktu mulai sebuah gelombang:
//   1) waktu_mulai_efektif  (tombol "Mulai sekarang")
//   2) waktu_mulai_rencana  (jam yang diisi di form gelombang; berlaku untuk gelombang MANA PUN)
//   3) dihitung dari gelombang sebelumnya
// Gelombang sesudahnya otomatis bergeser kecuali ia punya jam rencana sendiri.
export type Jadwal = Record<number, { mulai: Date | null; selesai: Date | null }>;

export function hitungJadwal(gels: any[]): Jadwal {
  const sorted = [...gels].sort((a, b) => a.urutan - b.urutan);
  const out: Jadwal = {};
  let cursor: Date | null = null;
  sorted.forEach((g) => {
    const efektif = g.waktu_mulai_efektif ? new Date(g.waktu_mulai_efektif) : null;
    const rencana = g.waktu_mulai_rencana ? new Date(g.waktu_mulai_rencana) : null;
    const mulai: Date | null = efektif ?? rencana ?? cursor;
    const selesai = mulai ? new Date(mulai.getTime() + g.durasi_ujian * 60000) : null;
    cursor = selesai ? new Date(selesai.getTime() + g.durasi_jeda * 60000) : null;
    out[g.id] = { mulai, selesai };
  });
  return out;
}

// Status yang berlaku SAAT INI. Status di database hanya diubah oleh tombol (Mulai/Selesai/Batalkan/Reset),
// sedangkan jam berjalan sendiri, jadi status dihitung ulang dari jadwal setiap kali dibaca:
//   - dibatalkan / selesai (manual)  -> tetap
//   - sudah lewat jam selesai        -> selesai
//   - sudah lewat jam mulai          -> berlangsung
//   - selain itu                     -> status di database
// Perubahan hanya maju (belum_mulai -> berlangsung -> selesai); "Reset" = kembali mengikuti jadwal otomatis.
export function statusEfektif(g: any, j: { mulai: Date | null; selesai: Date | null } | undefined, now: Date): string {
  if (g.status === 'dibatalkan' || g.status === 'selesai') return g.status;
  if (j?.selesai && now >= j.selesai) return 'selesai';
  if (j?.mulai && now >= j.mulai) return 'berlangsung';
  return g.status;
}

// Hitung jadwal sekali, lalu kembalikan gelombang dengan status yang sudah mengikuti jam.
export function terapkanJadwal(gels: any[], now: Date = new Date()) {
  const jadwal = hitungJadwal(gels);
  const hasil = gels.map((g) => ({ ...g, status: statusEfektif(g, jadwal[g.id], now) }));
  return { gels: hasil, jadwal };
}
