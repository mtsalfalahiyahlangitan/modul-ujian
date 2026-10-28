import { Ban, CircleCheck, Pencil, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { terapkanJadwal } from '@/lib/schedule';
import { fmtJam, toInputDateTime } from '@/lib/util';
import { batasMasuk, bukaPulang } from '@/lib/aturan';
import Flash from '@/components/Flash';
import PageHeader from '@/components/PageHeader';
import OpenModal from '@/components/OpenModal';
import { GelBadge } from '@/components/Badge';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import AksiStatus from '@/components/AksiStatus';
import AutoRefresh from '@/components/AutoRefresh';
import { hapusGelombang, ubahStatus } from './actions';
import GelombangModal, { type GelRow } from './GelombangModal';

export default async function GelombangPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [, { data }] = await Promise.all([requireAkses('gelombang'), adminDb().from('gelombang').select('*').order('urutan')]);
  const { gels, jadwal } = terapkanJadwal(data ?? []); // status sudah mengikuti jam
  const rowsEdit: GelRow[] = gels.map((g: any) => ({
    id: g.id, urutan: g.urutan, nama_gelombang: g.nama_gelombang, durasi_ujian: g.durasi_ujian,
    durasi_jeda: g.durasi_jeda, batas_masuk_menit: g.batas_masuk_menit ?? null,
    buka_pulang_menit: g.buka_pulang_menit ?? 0, waktu_mulai_input: toInputDateTime(g.waktu_mulai_rencana),
  }));

  return (
    <div>
      <PageHeader
        title="Gelombang ujian"
        desc="Status gelombang otomatis mengikuti jam: Berlangsung saat jam mulai tiba, Selesai saat jam selesai lewat. Gelombang tanpa jam mulai sendiri dihitung dari gelombang sebelumnya (mulai + durasi + jeda). Tombol di kolom Aksi dipakai untuk mengubah manual."
      >
        <OpenModal name="gelombang" className="btn btn-primary"><Plus size={16} />Tambah gelombang</OpenModal>
      </PageHeader>
      <Flash sp={sp} />
      <AutoRefresh />

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Urutan</th><th>Nama</th><th>Durasi</th><th>Jeda</th><th>Jadwal (WIB)</th><th>Tap masuk sampai</th><th>Pulang dibuka</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {gels.map((g: any) => {
                const j = jadwal[g.id];
                return (
                  <tr key={g.id}>
                    <td>{g.urutan}</td>
                    <td className="nowrap">{g.nama_gelombang}</td>
                    <td className="nowrap">{g.durasi_ujian} mnt</td>
                    <td className="nowrap">{g.durasi_jeda} mnt</td>
                    <td className="nowrap">{fmtJam(j?.mulai)} – {fmtJam(j?.selesai)}{g.waktu_mulai_efektif ? <span className="muted"> (aktual)</span> : null}</td>
                    <td className="nowrap">{fmtJam(batasMasuk(g, j))}{g.batas_masuk_menit != null ? <span className="muted"> (+{g.batas_masuk_menit} mnt)</span> : null}</td>
                    <td className="nowrap">{fmtJam(bukaPulang(g, j))} <span className="muted">(-{g.buka_pulang_menit} mnt)</span></td>
                    <td><GelBadge status={g.status} /></td>
                    <td>
                      <div className="actions">
                        <AksiStatus action={ubahStatus} id={g.id} aksi="mulai" className="btn btn-sm btn-primary"
                          disabled={g.status === 'berlangsung'} title="Mulai gelombang pada jam ini juga; jadwal sesudahnya bergeser"
                          message={`Mulai ${g.nama_gelombang} sekarang?`}><Play size={14} />Mulai sekarang</AksiStatus>
                        <AksiStatus action={ubahStatus} id={g.id} aksi="selesai"
                          disabled={g.status === 'selesai' || g.status === 'dibatalkan'} title="Tutup gelombang ini sekarang"
                          message={`Akhiri ${g.nama_gelombang} sekarang?`}><CircleCheck size={14} />Selesai</AksiStatus>
                        <AksiStatus action={ubahStatus} id={g.id} aksi="batal"
                          disabled={g.status === 'dibatalkan'} title="Batalkan gelombang ini"
                          message={`Batalkan ${g.nama_gelombang}?`}><Ban size={14} />Batalkan</AksiStatus>
                        <AksiStatus action={ubahStatus} id={g.id} aksi="reset" title="Kembalikan ke status otomatis sesuai jadwal"
                          message={`Reset ${g.nama_gelombang} dan kembali mengikuti jadwal?`}><RotateCcw size={14} />Reset</AksiStatus>
                        <OpenModal name="gelombang" id={g.id} className="btn btn-sm"><Pencil size={14} />Edit</OpenModal>
                        <form action={hapusGelombang} className="inline-form">
                          <input type="hidden" name="id" value={g.id} />
                          <ConfirmSubmit judul="Hapus gelombang" tombol="Hapus" message={`Hapus ${g.nama_gelombang}?`}><Trash2 size={14} />Hapus</ConfirmSubmit>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!gels.length && <tr><td colSpan={9} className="empty">Belum ada gelombang. Klik Tambah gelombang untuk membuat yang pertama.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <GelombangModal rows={rowsEdit} />
    </div>
  );
}
