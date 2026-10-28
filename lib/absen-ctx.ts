import { adminDb } from './supabase/admin';
import { terapkanJadwal } from './schedule';
import type { Me } from './auth';

// Petugas: ruang SELALU dikunci ke ruang akunnya. Admin: memilih ruang lewat ?ruang=
export async function absenCtx(me: Me, sp: Record<string, string | undefined>) {
  const db = adminDb();
  const isAdmin = me.role !== 'petugas'; // administrator dan staf melihat semua ruang
  const [ruangR, gelR] = await Promise.all([
    db.from('ruang').select('*').order('kode_ruang'),
    db.from('gelombang').select('*').order('urutan'),
  ]);
  const ruangList = ruangR.data ?? [];
  const ruangId = isAdmin ? (sp.ruang ? Number(sp.ruang) : null) : me.ruang_id;
  const ruang = ruangList.find((r: any) => r.id === ruangId) ?? null;
  const { gels: gelList, jadwal } = terapkanJadwal(gelR.data ?? []);
  const gel = gelList.find((g: any) => g.id === Number(sp.gel)) ?? null; // filter tampilan (opsional)
  return { isAdmin, ruangList, ruang, gelList, gel, jadwal };
}
