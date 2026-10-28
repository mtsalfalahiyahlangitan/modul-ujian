'use client';
import { useEffect, useState } from 'react';
import { CircleAlert, ClipboardPen, LoaderCircle, Save, Undo2 } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { showToast } from '@/components/Toaster';
import { namaItem, rupiah, type ItemAdministrasi } from '@/lib/administrasi';
import { simpanCeklisAdministrasi } from '../actions';

export type BarisAdministrasi = {
  id: number; no_induk: string; nama: string; kelas: string; asrama: string; kamar: string | null;
  items: ItemAdministrasi[];
};

// Pop up pengampu: semua catatan administrasi satu siswa (satu siswa bisa punya beberapa keterangan berbeda).
// Pengampu menceklis catatan yang sudah diselesaikan / membatalkan ceklis, lalu klik Simpan.
// Sebelum tersimpan muncul pop up konfirmasi. Semua catatan terceklis = status Lengkap.
export default function AdministrasiModal({ rows }: { rows: BarisAdministrasi[] }) {
  const [id, setId] = useState<number | null>(null);
  const [draf, setDraf] = useState<Map<number, boolean>>(new Map()); // perubahan yang belum disimpan
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  useModalOpener('administrasi', (v) => { setDraf(new Map()); setKonfirmasi(false); setId(v ?? null); });
  useEffect(() => { setDraf(new Map()); }, [rows]); // data baru dari server (setelah simpan / upload TU): buang draf lama

  const s = id != null ? rows.find((r) => r.id === id) : null;
  if (!s) return null;

  const items = s.items.slice().sort((a, b) => a.urutan - b.urutan);
  const nilai = (i: ItemAdministrasi) => draf.get(i.id) ?? i.ceklis;
  const diselesaikan = items.filter((i) => !i.ceklis && nilai(i));
  const dibatalkan = items.filter((i) => i.ceklis && !nilai(i));
  const adaPerubahan = diselesaikan.length + dibatalkan.length > 0;
  const belum = items.filter((i) => !nilai(i));
  const lengkap = items.length > 0 && belum.length === 0;
  const sisa = belum.reduce((n, i) => n + (i.nominal ?? 0), 0);

  function ubah(i: ItemAdministrasi) {
    setDraf((m) => {
      const n = new Map(m);
      const target = !(m.get(i.id) ?? i.ceklis);
      if (target === i.ceklis) n.delete(i.id); else n.set(i.id, target);
      return n;
    });
  }

  async function simpan() {
    setMenyimpan(true);
    try {
      const r = await simpanCeklisAdministrasi(s!.id, [...diselesaikan.map((i) => ({ itemId: i.id, ceklis: true })), ...dibatalkan.map((i) => ({ itemId: i.id, ceklis: false }))]);
      showToast(r.ok ? `${s!.nama}: ${r.msg}` : r.msg, !r.ok);
      if (r.ok) { setKonfirmasi(false); setId(null); setDraf(new Map()); }
      else setKonfirmasi(false);
    } catch {
      showToast('Gagal menghubungi server. Coba lagi.', true);
      setKonfirmasi(false);
    } finally {
      setMenyimpan(false);
    }
  }

  const label = (i: ItemAdministrasi) => `${namaItem(i)}${i.nominal != null ? ` · ${rupiah(i.nominal)}` : ''}`;

  return (
    <>
      <Modal title={s.nama} icon={<ClipboardPen size={17} />} onClose={() => { setId(null); setKonfirmasi(false); }}>
        <p className="muted" style={{ marginBottom: 12 }}>
          {s.no_induk} · Kelas {s.kelas} · {s.asrama}{s.kamar ? `, ${s.kamar}` : ''}
        </p>
        <div style={{ marginBottom: 14 }}>
          {lengkap
            ? <span className="badge badge-green">Semua {items.length} catatan selesai, status Lengkap</span>
            : <span className="badge badge-amber">{belum.length} dari {items.length} catatan belum selesai{sisa > 0 ? ` · sisa ${rupiah(sisa)}` : ''}</span>}
          {adaPerubahan && <span className="badge badge-blue" style={{ marginLeft: 6 }}>Ada perubahan belum disimpan</span>}
        </div>
        <ul className="tf-list">
          {items.map((i) => {
            const on = nilai(i);
            const berubah = draf.has(i.id);
            return (
              <li key={i.id} className={`tf-item${on ? ' on' : ''}${berubah ? ' draf' : ''}`}>
                <label>
                  <input type="checkbox" checked={on} onChange={() => ubah(i)} />
                  <span className="tf-nama" style={i.keterangan ? undefined : { fontStyle: 'italic', fontWeight: 500 }}>{namaItem(i)}</span>
                </label>
                {i.nominal != null && <span className="badge badge-gray">{rupiah(i.nominal)}</span>}
                {berubah && <span className="badge badge-amber">{on ? 'Akan diselesaikan' : 'Akan dibatalkan'}</span>}
              </li>
            );
          })}
        </ul>
        <div className="preview-actions">
          <button type="button" className="btn" onClick={() => setDraf(new Map())} disabled={!adaPerubahan}><Undo2 size={16} />Kembalikan</button>
          <button type="button" className="btn btn-primary" onClick={() => setKonfirmasi(true)} disabled={!adaPerubahan}><Save size={16} />Simpan</button>
        </div>
      </Modal>

      {konfirmasi && (
        <Modal title="Konfirmasi simpan" icon={<CircleAlert size={17} />} small onClose={() => setKonfirmasi(false)}>
          <div className="alert alert-warn" role="status" style={{ marginBottom: 12 }}>
            <CircleAlert size={18} />
            <span>Pastikan catatan di bawah ini benar-benar sudah diselesaikan. Bila ada yang salah, klik <b>Kembali periksa</b> dan perbaiki dulu.</span>
          </div>
          <p className="muted" style={{ marginBottom: 8 }}>{s.nama} · {s.no_induk}</p>
          {diselesaikan.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <b>Diselesaikan ({diselesaikan.length})</b>
              <div className="chips" style={{ marginTop: 6 }}>{diselesaikan.map((i) => <span key={i.id} className="badge badge-green">{label(i)}</span>)}</div>
            </div>
          )}
          {dibatalkan.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <b>Ceklis dibatalkan ({dibatalkan.length})</b>
              <div className="chips" style={{ marginTop: 6 }}>{dibatalkan.map((i) => <span key={i.id} className="badge badge-red">{label(i)}</span>)}</div>
            </div>
          )}
          <p style={{ marginBottom: 4 }}>
            {lengkap
              ? <>Setelah disimpan, <b>semua catatan selesai</b> dan status siswa menjadi <b>Lengkap</b>.</>
              : <>Setelah disimpan, masih ada <b>{belum.length} catatan belum selesai</b>, status siswa tetap <b>Belum lengkap</b>.</>}
          </p>
          <div className="preview-actions">
            <button type="button" className="btn" onClick={() => setKonfirmasi(false)} disabled={menyimpan}>Kembali periksa</button>
            <button type="button" className="btn btn-primary" onClick={simpan} disabled={menyimpan}>
              {menyimpan ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{menyimpan ? 'Menyimpan…' : 'Ya, simpan'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
