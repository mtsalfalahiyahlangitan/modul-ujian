'use client';
import { useState, useTransition } from 'react';
import { KeyRound, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { bukaModal } from '@/components/OpenModal';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { showToast } from '@/components/Toaster';
import { konfirmasi } from '@/components/ConfirmHost';
import { gantiPassword, hapusPetugas, hapusRuangMassal } from './actions';

export type BarisRuang = {
  id: number; kode_ruang: string; nama_ruang: string; siswa: number;
  petugas: { id: string; nama: string; username: string } | null;
};

// Tabel ruang dengan kotak centang: pilih satu-satu atau semua, lalu hapus sekaligus.
export default function RuangTable({ rows }: { rows: BarisRuang[] }) {
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  const [menghapus, mulai] = useTransition();
  const semua = rows.length > 0 && rows.every((r) => pilih.has(r.id));

  const toggle = (id: number) => setPilih((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function hapus(ids: number[], label: string) {
    const terpilih = rows.filter((r) => ids.includes(r.id));
    const nSiswa = terpilih.reduce((n, r) => n + r.siswa, 0);
    const nPetugas = terpilih.filter((r) => r.petugas).length;
    const info = [
      nPetugas ? `${nPetugas} akun petugas ikut dihapus` : '',
      nSiswa ? `${nSiswa} siswa di ruang ini menjadi "belum ditentukan ruangnya"` : '',
    ].filter(Boolean);
    if (!(await konfirmasi({ judul: 'Hapus ruang', pesan: `Hapus ${label}?${info.length ? `\n\n• ${info.join('\n• ')}` : ''}`, tombol: 'Hapus', bahaya: true }))) return;
    const fd = new FormData();
    fd.set('ids', JSON.stringify(ids));
    mulai(async () => {
      const r = await hapusRuangMassal(fd).catch(() => null);
      showToast(r?.msg ?? 'Gagal menghubungi server. Coba lagi.', !r?.ok);
      if (r?.ok) setPilih((p) => { const n = new Set(p); ids.forEach((i) => n.delete(i)); return n; });
    });
  }

  return (
    <>
      {pilih.size > 0 && (
        <div className="sel-bar" role="status">
          <strong>{pilih.size} ruang dipilih</strong>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
            <button type="button" className="btn btn-sm" onClick={() => setPilih(new Set())} disabled={menghapus}>Batal pilih</button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => hapus([...pilih], `${pilih.size} ruang terpilih`)} disabled={menghapus}>
              {menghapus ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}Hapus ruang ({pilih.size})
            </button>
          </span>
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="check-col">
                <input type="checkbox" aria-label="Pilih semua ruang" checked={semua} disabled={!rows.length || menghapus}
                  onChange={() => setPilih(semua ? new Set() : new Set(rows.map((r) => r.id)))} />
              </th>
              <th>Ruang</th><th className="num">Siswa</th><th>Petugas</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.petugas;
              return (
                <tr key={r.id} className={pilih.has(r.id) ? 'terpilih' : undefined}>
                  <td className="check-col">
                    <input type="checkbox" aria-label={`Pilih ${r.kode_ruang}`} checked={pilih.has(r.id)} onChange={() => toggle(r.id)} disabled={menghapus} />
                  </td>
                  <td>{r.kode_ruang} – {r.nama_ruang}</td>
                  <td className="num">{r.siswa}</td>
                  <td>{p ? <>{p.nama} <span className="muted">({p.username})</span></> : <span className="badge badge-amber">Belum ada petugas</span>}</td>
                  <td>
                    <div className="actions">
                      <button type="button" className="btn btn-sm" onClick={() => bukaModal('ruang', r.id)}><Pencil size={14} />Edit</button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => hapus([r.id], r.kode_ruang)} disabled={menghapus}><Trash2 size={14} />Hapus ruang</button>
                      {p && (
                        <>
                          <form action={gantiPassword} className="inline-form">
                            <input type="hidden" name="user_id" value={p.id} />
                            <input name="password" placeholder="Password baru" aria-label={`Password baru ${p.username}`} className="input-sm" autoComplete="off" />
                            <button type="submit" className="btn btn-sm"><KeyRound size={14} />Ganti</button>
                          </form>
                          <form action={hapusPetugas} className="inline-form">
                            <input type="hidden" name="user_id" value={p.id} />
                            <ConfirmSubmit judul="Hapus akun" tombol="Hapus" message={`Hapus akun ${p.username}?`}><Trash2 size={14} />Hapus akun</ConfirmSubmit>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="empty">Belum ada ruang. Klik Tambah ruang atau Buat ruang massal.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
