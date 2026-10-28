'use client';
import { useState } from 'react';
import { CircleAlert, LoaderCircle, Pencil, Plus, Save, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { useServerForm } from '@/components/useServerForm';
import { showToast } from '@/components/Toaster';
import { simpanWali } from './actions';

export type WaliRow = { id: number; nama: string; kelas: string[] };
export type OpsiKelas = { kelas: string; jumlah: number };

export default function WaliModal({ rows, opsi }: { rows: WaliRow[]; opsi: OpsiKelas[] }) {
  const [buka, setBuka] = useState<{ id: number | null } | null>(null);
  useModalOpener('wali', (id) => setBuka({ id: id ?? null }));
  if (!buka) return null;
  const edit = buka.id != null ? rows.find((r) => r.id === buka.id) ?? null : null;
  if (buka.id != null && !edit) return null;

  return (
    <Modal title={edit ? `Edit ${edit.nama}` : 'Tambah wali kelas'} icon={edit ? <Pencil size={17} /> : <Plus size={17} />} onClose={() => setBuka(null)}>
      <WaliForm edit={edit} opsi={opsi} onCancel={() => setBuka(null)} onDone={(msg) => { setBuka(null); showToast(msg); }} />
    </Modal>
  );
}

function WaliForm({ edit, opsi, onCancel, onDone }: { edit: WaliRow | null; opsi: OpsiKelas[]; onCancel: () => void; onDone: (msg: string) => void }) {
  const { pending, error, onSubmit } = useServerForm(simpanWali, (r) => onDone(r.msg));
  // Kelas yang sudah tersimpan tapi tidak ada lagi di data siswa tetap ditampilkan agar bisa dilepas
  const ekstra = (edit?.kelas ?? []).filter((k) => !opsi.some((o) => o.kelas === k));
  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
      <input type="hidden" name="id" defaultValue={edit?.id ?? ''} />
      <label className="field">Nama wali kelas
        <input name="nama" defaultValue={edit?.nama ?? ''} required autoFocus maxLength={100} />
      </label>
      <fieldset className="cek-kelas">
        <legend>Kelas yang diampu</legend>
        {opsi.map((o) => (
          <label key={o.kelas}>
            <input type="checkbox" name="kelas" value={o.kelas} defaultChecked={edit?.kelas.includes(o.kelas)} />
            {o.kelas} <small>({o.jumlah})</small>
          </label>
        ))}
        {ekstra.map((k) => (
          <label key={k}><input type="checkbox" name="kelas" value={k} defaultChecked />{k} <small>(tidak ada siswa)</small></label>
        ))}
        {!opsi.length && !ekstra.length && <p className="muted">Belum ada data siswa, jadi belum ada kelas yang bisa dipilih.</p>}
      </fieldset>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={pending}><X size={16} />Batal</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{pending ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
