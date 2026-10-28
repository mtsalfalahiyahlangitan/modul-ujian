// Taftisy: ringkasan status siswa dari ceklis pelajarannya. Dipakai saat upload TU dan saat pengampu mengubah ceklis,
// agar alasan / rincian di tabel persyaratan_terjaring (tampil di Dashboard persyaratan) selalu sama dengan ceklis.
export type ItemTaftisy = { id: number; pelajaran: string; urutan: number; dari_file: boolean; ceklis: boolean; diubah: boolean };

export function ringkasTaftisy(tingkat: string, items: { pelajaran: string; urutan: number; ceklis: boolean }[]) {
  const belum = items.filter((i) => !i.ceklis).sort((a, b) => a.urutan - b.urutan).map((i) => i.pelajaran);
  const lengkap = items.length > 0 && belum.length === 0;
  return {
    lengkap, belum,
    alasan: lengkap ? `Semua ${items.length} pelajaran sudah lengkap` : `Belum lengkap ${belum.length} dari ${items.length} pelajaran`,
    detail: { tingkat, jumlah_pelajaran: items.length, sudah_lengkap: items.length - belum.length, belum_lengkap: belum },
  };
}
