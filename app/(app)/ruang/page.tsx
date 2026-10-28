import { LayoutGrid, Plus, UserPlus, Users } from 'lucide-react';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { fetchAll } from '@/lib/util';
import Flash from '@/components/Flash';
import PageHeader from '@/components/PageHeader';
import OpenModal from '@/components/OpenModal';
import { RuangModal, PetugasModal } from './RuangModals';
import RuangTable, { type BarisRuang } from './RuangTable';
import RuangMassalModal from './RuangMassalModal';
import PetugasMassalModal from './PetugasMassalModal';

export default async function RuangPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = adminDb();
  // Cek login dan semua query berjalan bersamaan (bukan berurutan)
  const [, { data: ruang }, { data: petugas }, siswa] = await Promise.all([
    requireAkses('ruang'),
    db.from('ruang').select('*').order('kode_ruang'),
    db.from('users').select('*').eq('role', 'petugas'),
    fetchAll((a, b) => db.from('siswa').select('ruang_id').order('id').range(a, b)), // hanya kolom yang dibutuhkan
  ]);
  const pMap = new Map((petugas ?? []).map((p: any) => [p.ruang_id, p]));
  const ruangTanpaPetugas = (ruang ?? []).filter((r: any) => !pMap.has(r.id)).map((r: any) => ({ id: r.id, kode_ruang: r.kode_ruang }));
  const jumlahSiswa = new Map<number, number>();
  for (const x of siswa) if (x.ruang_id != null) jumlahSiswa.set(x.ruang_id, (jumlahSiswa.get(x.ruang_id) ?? 0) + 1);
  const barisRuang: BarisRuang[] = (ruang ?? []).map((r: any) => {
    const p: any = pMap.get(r.id);
    return { id: r.id, kode_ruang: r.kode_ruang, nama_ruang: r.nama_ruang, siswa: jumlahSiswa.get(r.id) ?? 0, petugas: p ? { id: p.id, nama: p.nama, username: p.username } : null };
  });
  const rowsRuang = (ruang ?? []).map((r: any) => ({ id: r.id, kode_ruang: r.kode_ruang, nama_ruang: r.nama_ruang }));

  return (
    <div>
      <PageHeader title="Ruang & petugas" desc="Setiap ruang punya satu akun petugas yang hanya bisa mengelola absensi ruangnya.">
        <div className="actions">
          <OpenModal name="ruang" className="btn"><Plus size={16} />Tambah ruang</OpenModal>
          <OpenModal name="ruang-massal" className="btn"><LayoutGrid size={16} />Buat ruang massal</OpenModal>
          <OpenModal name="petugas-massal" className="btn"><Users size={16} />Buat akun massal</OpenModal>
          <OpenModal name="petugas" className="btn btn-primary"><UserPlus size={16} />Buat akun petugas</OpenModal>
        </div>
      </PageHeader>
      <Flash sp={sp} />

      <section className="panel">
        <RuangTable rows={barisRuang} />
      </section>
      <RuangModal rows={rowsRuang} />
      <RuangMassalModal ada={rowsRuang.map((r) => r.kode_ruang)} />
      <PetugasModal ruang={ruangTanpaPetugas} />
      <PetugasMassalModal ruang={ruangTanpaPetugas} />
    </div>
  );
}
