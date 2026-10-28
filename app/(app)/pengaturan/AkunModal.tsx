'use client';
import { useState } from 'react';
import { CircleAlert, LoaderCircle, Pencil, Save, UserPlus, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { useServerForm } from '@/components/useServerForm';
import { showToast } from '@/components/Toaster';
import { AREA, LABEL_PERAN, SUB_PERSYARATAN, type AksesPersyaratan, type Peran } from '@/lib/akses';
import { simpanAkun } from './actions';

export type AkunRow = { id: string; nama: string; username: string; role: Peran; akses: string[]; aksesPersyaratan: AksesPersyaratan | null };
export type InfoTingkat = { tingkat: number[]; takTerbaca: number }; // tingkat yang ada di data siswa + jumlah kelas yang tingkatnya tak terbaca

// Pilihan satu sub menu: dicentang atau tidak, semua tingkat atau tingkat tertentu
type Konf = Record<string, { on: boolean; semua: boolean; tingkat: number[] }>;
function konfAwal(edit: AkunRow | null): Konf {
  const out: Konf = {};
  for (const sb of SUB_PERSYARATAN) {
    // akun lama tanpa pembatasan (null) = semua sub menu, semua tingkat; akun baru = belum ada yang dipilih
    const v = edit ? (edit.aksesPersyaratan ? edit.aksesPersyaratan[sb.key] : '*') : undefined;
    out[sb.key] = { on: v !== undefined, semua: v === '*', tingkat: Array.isArray(v) ? v : [] };
  }
  return out;
}

export default function AkunModal({ rows, ruangBebas, infoTingkat }: { rows: AkunRow[]; ruangBebas: { id: number; kode_ruang: string }[]; infoTingkat: InfoTingkat }) {
  const [buka, setBuka] = useState<{ id: string | null } | null>(null);
  // useModalOpener memakai id angka; akun memakai uuid, jadi dibuka lewat nomor urut baris (0 = tambah)
  useModalOpener('akun', (n) => setBuka({ id: n ? rows[n - 1]?.id ?? null : null }));
  if (!buka) return null;
  const edit = buka.id ? rows.find((r) => r.id === buka.id) ?? null : null;
  if (buka.id && !edit) return null;

  return (
    <Modal title={edit ? `Edit ${edit.nama}` : 'Tambah akun'} icon={edit ? <Pencil size={17} /> : <UserPlus size={17} />} onClose={() => setBuka(null)}>
      <AkunForm edit={edit} ruangBebas={ruangBebas} infoTingkat={infoTingkat} onCancel={() => setBuka(null)} onDone={(msg) => { setBuka(null); showToast(msg); }} />
    </Modal>
  );
}

function AkunForm({ edit, ruangBebas, infoTingkat, onCancel, onDone }: {
  edit: AkunRow | null; ruangBebas: { id: number; kode_ruang: string }[]; infoTingkat: InfoTingkat; onCancel: () => void; onDone: (msg: string) => void;
}) {
  const { pending, error, onSubmit } = useServerForm(simpanAkun, (r) => onDone(r.msg));
  const [peranBaru, setPeranBaru] = useState<Peran>('staf');
  const peran: Peran = edit ? edit.role : peranBaru;
  const [menu, setMenu] = useState<string[]>(edit?.akses ?? []);
  const [konf, setKonf] = useState<Konf>(() => konfAwal(edit));
  const ubahKonf = (key: string, f: (k: Konf[string]) => Konf[string]) => setKonf((c) => ({ ...c, [key]: f(c[key]) }));
  // pilihan tingkat = yang ada di data siswa + yang sudah tersimpan di akun ini (agar tidak hilang diam-diam); cadangan 7/8/9 bila data siswa kosong
  const opsiTingkat = (() => {
    const t = new Set<number>(infoTingkat.tingkat);
    (Object.values(konf) as Konf[string][]).forEach((k) => k.tingkat.forEach((x) => t.add(x)));
    if (!t.size) [7, 8, 9].forEach((x) => t.add(x));
    return [...t].sort((a, b) => a - b);
  })();

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
      <input type="hidden" name="id" defaultValue={edit?.id ?? ''} />
      <div className="form-grid">
        {edit ? (
          <div className="field">Username<div className="muted" style={{ paddingTop: 7 }}>{edit.username} <span className="badge badge-gray">{LABEL_PERAN[edit.role]}</span></div></div>
        ) : (
          <>
            <label className="field">Peran
              <select name="peran" value={peranBaru} onChange={(e) => setPeranBaru(e.target.value as Peran)}>
                <option value="staf">Staf (menu dipilih sendiri)</option>
                <option value="petugas">Petugas ruang (absensi satu ruang)</option>
                <option value="super_admin">Administrator (semua menu)</option>
              </select>
            </label>
            <label className="field">Username
              <input name="username" required autoComplete="off" autoCapitalize="none" placeholder="huruf kecil, angka, titik" />
            </label>
          </>
        )}
        <label className="field">Nama
          <input name="nama" defaultValue={edit?.nama ?? ''} required maxLength={100} autoFocus={!!edit} />
        </label>
        <label className="field">{edit ? 'Password baru' : 'Password'}
          <input name="password" type="password" minLength={6} required={!edit} autoComplete="new-password" />
          <small>{edit ? 'Kosongkan bila tidak diganti. ' : ''}Minimal 6 karakter</small>
        </label>
        {!edit && peran === 'petugas' && (
          <label className="field span-2">Ruang
            <select name="ruang_id" required defaultValue="">
              <option value="" disabled>Pilih ruang</option>
              {ruangBebas.map((r) => <option key={r.id} value={r.id}>{r.kode_ruang}</option>)}
            </select>
            {!ruangBebas.length && <small>Semua ruang sudah punya petugas.</small>}
          </label>
        )}
      </div>

      {peran === 'staf' && (
        <fieldset className="cek-akses">
          <legend>Menu yang boleh dibuka</legend>
          {AREA.map((a) => (
            <label key={a.key}>
              <input type="checkbox" name="akses" value={a.key} checked={menu.includes(a.key)}
                onChange={(e) => setMenu((m) => e.target.checked ? [...m, a.key] : m.filter((x) => x !== a.key))} />
              <span><b>{a.label}</b><small>{a.desc}</small></span>
            </label>
          ))}
        </fieldset>
      )}
      {peran === 'staf' && menu.includes('persyaratan') && (
        <fieldset className="cek-sub">
          <legend>Sub menu Persyaratan ujian</legend>
          <p className="cek-sub-info">
            Centang sub menu yang boleh dibuka, lalu pilih tingkat kelas siswa yang boleh dilihat. Tingkat dibaca dari kolom Kelas di Data siswa.
            {infoTingkat.takTerbaca > 0 && <> Ada {infoTingkat.takTerbaca} kelas yang tingkatnya tidak terbaca; siswanya hanya terlihat oleh akun dengan pilihan Semua tingkat.</>}
          </p>
          {SUB_PERSYARATAN.map((sb) => {
            const k = konf[sb.key];
            return (
              <div key={sb.key} className="sub-baris" data-on={k.on}>
                <label className="sub-utama">
                  <input type="checkbox" checked={k.on} onChange={(e) => ubahKonf(sb.key, (x) => ({ ...x, on: e.target.checked }))} />
                  <span><b>{sb.label}</b><small>{sb.desc}</small></span>
                </label>
                {k.on && (
                  <div className="tingkat">
                    <span className="judul">Tingkat kelas:</span>
                    <label><input type="checkbox" checked={k.semua} onChange={(e) => ubahKonf(sb.key, (x) => ({ ...x, semua: e.target.checked }))} />Semua</label>
                    {!k.semua && opsiTingkat.map((t) => (
                      <label key={t}>
                        <input type="checkbox" checked={k.tingkat.includes(t)}
                          onChange={(e) => ubahKonf(sb.key, (x) => ({ ...x, tingkat: e.target.checked ? [...x.tingkat, t].sort((a, b) => a - b) : x.tingkat.filter((y) => y !== t) }))} />
                        Kelas {t}
                      </label>
                    ))}
                    {sb.key === 'dashboard' && !k.semua && <small style={{ flexBasis: '100%' }}>Dibatasi tingkat: hanya bisa melihat. Upload, hapus data, dan target minimal hanya untuk Dashboard semua tingkat.</small>}
                  </div>
                )}
                {k.on && <input type="hidden" name="persyaratan_sub" value={sb.key} />}
                {k.on && (k.semua ? <input type="hidden" name={`persyaratan_tingkat:${sb.key}`} value="*" /> : k.tingkat.map((t) => <input key={t} type="hidden" name={`persyaratan_tingkat:${sb.key}`} value={t} />))}
              </div>
            );
          })}
        </fieldset>
      )}
      {peran === 'petugas' && edit && <p className="muted" style={{ marginTop: 14 }}>Petugas ruang hanya bisa membuka Absensi dan Laporan ruangnya sendiri. Penugasan ruang diatur di menu Ruang &amp; petugas.</p>}
      {peran === 'super_admin' && <p className="muted" style={{ marginTop: 14 }}>Administrator bisa membuka semua menu, termasuk Pengaturan ini.</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={pending}><X size={16} />Batal</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{pending ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
