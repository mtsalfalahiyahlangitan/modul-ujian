'use client';
import { useMemo, useState, useTransition } from 'react';
import { LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { bukaModal } from '@/components/OpenModal';
import { showToast } from '@/components/Toaster';
import { konfirmasi } from '@/components/ConfirmHost';
import { hapusSiswaMassal } from './actions';

export type BarisSiswa = {
  id: number; no_induk: string; nama: string; asrama: string; kamar: string | null; kelas: string;
  rfid: string | null; ruang: string | null; gelombang: string; no_ujian: string | null; no_bangku: string | null;
};
type Filter = { q?: string; kelas?: string; asrama?: string; ruang?: string; gel?: string };

// Tabel Data siswa dengan kotak centang: pilih satu-satu, pilih semua, lalu hapus sekaligus.
export default function SiswaTable({ rows, total, filter, adaFilter }: {
  rows: BarisSiswa[]; total: number; filter: Filter; adaFilter: boolean;
}) {
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [semuaFilter, setSemuaFilter] = useState(false); // true = semua hasil filter, termasuk yang tidak tampil
  const [menghapus, mulai] = useTransition();

  const idTampil = useMemo(() => rows.map((r) => r.id), [rows]);
  const semuaTampil = idTampil.length > 0 && idTampil.every((id) => pilih.has(id));
  const jumlah = semuaFilter ? total : pilih.size;

  function toggle(id: number) {
    setSemuaFilter(false);
    setPilih((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSemua() {
    setSemuaFilter(false);
    setPilih(semuaTampil ? new Set() : new Set(idTampil));
  }
  function batal() { setPilih(new Set()); setSemuaFilter(false); }

  async function hapus() {
    if (!jumlah) return;
    const cakupan = semuaFilter ? (adaFilter ? 'semua siswa hasil filter' : 'SEMUA siswa') : `${jumlah} siswa terpilih`;
    if (!(await konfirmasi({ judul: 'Hapus data siswa', pesan: `Hapus ${cakupan} (${jumlah})?\n\nData absensi siswa tersebut ikut terhapus dan tidak bisa dikembalikan.`, tombol: 'Hapus', bahaya: true }))) return;
    const fd = new FormData();
    if (semuaFilter) {
      fd.set('semua', '1');
      (Object.entries(filter) as [string, string | undefined][]).forEach(([k, v]) => v && fd.set(k, v));
    } else fd.set('ids', JSON.stringify([...pilih]));
    mulai(async () => {
      try {
        const r = await hapusSiswaMassal(fd);
        showToast(r.msg, !r.ok);
        if (r.ok) batal();
      } catch {
        showToast('Gagal menghubungi server. Coba lagi.', true);
      }
    });
  }

  const hapusSatu = async (r: BarisSiswa) => {
    if (!(await konfirmasi({ judul: 'Hapus siswa', pesan: `Hapus ${r.nama}?\n\nData absensinya ikut terhapus.`, tombol: 'Hapus', bahaya: true }))) return;
    const fd = new FormData();
    fd.set('ids', JSON.stringify([r.id]));
    mulai(async () => {
      const res = await hapusSiswaMassal(fd).catch(() => null);
      showToast(res?.msg ?? 'Gagal menghubungi server. Coba lagi.', !res?.ok);
      if (res?.ok) setPilih((p) => { const n = new Set(p); n.delete(r.id); return n; });
    });
  };

  return (
    <>
      {(pilih.size > 0 || semuaFilter) && (
        <div className="sel-bar" role="status">
          <strong>{jumlah} siswa dipilih</strong>
          {!semuaFilter && semuaTampil && total > rows.length && (
            <span>
              Hanya {rows.length} siswa di halaman ini.{' '}
              <button type="button" className="btn-link" onClick={() => setSemuaFilter(true)}>
                Pilih semua {total} siswa{adaFilter ? ' hasil filter' : ''}
              </button>
            </span>
          )}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={batal} disabled={menghapus}>Batal pilih</button>
            <button type="button" className="btn btn-sm btn-danger" onClick={hapus} disabled={menghapus}>
              {menghapus ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}Hapus data siswa ({jumlah})
            </button>
          </span>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="check-col">
                <input type="checkbox" aria-label="Pilih semua siswa di halaman ini" checked={semuaTampil || semuaFilter} onChange={toggleSemua} disabled={!rows.length || menghapus} />
              </th>
              <th>No. induk</th><th>Nama</th><th>Asrama</th><th>Kamar</th><th>Kelas</th><th>RFID</th><th>Ruang</th><th>Gelombang</th><th>No. ujian</th><th>No. bangku</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const on = semuaFilter || pilih.has(s.id);
              return (
                <tr key={s.id} className={on ? 'terpilih' : undefined}>
                  <td className="check-col">
                    <input type="checkbox" aria-label={`Pilih ${s.nama}`} checked={on} onChange={() => toggle(s.id)} disabled={menghapus} />
                  </td>
                  <td>{s.no_induk}</td><td>{s.nama}</td><td>{s.asrama}</td>
                  <td>{s.kamar ?? <span className="muted">-</span>}</td><td>{s.kelas}</td>
                  <td>{s.rfid ?? <span className="muted">-</span>}</td>
                  <td>{s.ruang ?? <span className="muted">-</span>}</td>
                  <td>{s.gelombang ? <span className="badge badge-green">{s.gelombang}</span> : <span className="muted">-</span>}</td>
                  <td>{s.no_ujian ?? <span className="muted">-</span>}</td>
                  <td>{s.no_bangku ?? <span className="muted">-</span>}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn btn-sm" onClick={() => bukaModal('siswa', s.id)}><Pencil size={14} />Edit</button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => hapusSatu(s)} disabled={menghapus}><Trash2 size={14} />Hapus</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={12} className="empty">{adaFilter ? 'Tidak ada siswa yang cocok dengan filter.' : 'Belum ada data siswa. Klik Tambah siswa untuk menambah manual atau upload Excel.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
