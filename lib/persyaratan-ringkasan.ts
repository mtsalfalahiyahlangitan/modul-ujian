import { batasiKelas } from './siswa-filter';
import { fetchAll } from './util';
import type { adminDb } from './supabase/admin';

export type RingkasJenis = { jenis_id: number; jumlah: number; lengkap: number };

// Jumlah siswa terjaring per jenis. Tanpa batas kelas dipakai view persyaratan_ringkasan (1 query);
// dengan batas kelas dihitung dari baris penjaringan siswa yang kelasnya diizinkan.
export async function ringkasanJenis(db: ReturnType<typeof adminDb>, kelas: string[] | null): Promise<RingkasJenis[]> {
  if (kelas === null) {
    const { data } = await db.from('persyaratan_ringkasan').select('jenis_id,jumlah,lengkap');
    return (data ?? []) as RingkasJenis[];
  }
  const rows = await fetchAll((from, to) =>
    batasiKelas(db.from('persyaratan_terjaring').select('jenis_id,lengkap,s:siswa!inner(kelas)'), kelas, 's.kelas').order('id').range(from, to));
  const peta = new Map<number, RingkasJenis>();
  for (const r of rows) {
    const x = peta.get(r.jenis_id) ?? { jenis_id: r.jenis_id as number, jumlah: 0, lengkap: 0 };
    x.jumlah++;
    if (r.lengkap) x.lengkap++;
    peta.set(r.jenis_id, x);
  }
  return [...peta.values()];
}
