'use client';
import { useState } from 'react';
import { CircleAlert, LoaderCircle, Pencil, Plus, Save, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { useServerForm } from '@/components/useServerForm';
import { showToast } from '@/components/Toaster';
import { simpanGelombang } from './actions';

export type GelRow = {
  id: number; urutan: number; nama_gelombang: string; durasi_ujian: number; durasi_jeda: number;
  batas_masuk_menit: number | null; buka_pulang_menit: number; waktu_mulai_input: string;
};

export default function GelombangModal({ rows }: { rows: GelRow[] }) {
  const [buka, setBuka] = useState<{ id: number | null } | null>(null);
  useModalOpener('gelombang', (id) => setBuka({ id: id ?? null }));
  if (!buka) return null;

  const edit = buka.id != null ? rows.find((r) => r.id === buka.id) ?? null : null;
  if (buka.id != null && !edit) return null;

  return (
    <Modal
      title={edit ? `Edit ${edit.nama_gelombang}` : 'Tambah gelombang'}
      icon={edit ? <Pencil size={17} /> : <Plus size={17} />}
      onClose={() => setBuka(null)}
    >
      <GelombangForm edit={edit} onCancel={() => setBuka(null)} onDone={(msg) => { setBuka(null); showToast(msg); }} />
    </Modal>
  );
}

function GelombangForm({ edit, onCancel, onDone }: { edit: GelRow | null; onCancel: () => void; onDone: (msg: string) => void }) {
  const { pending, error, onSubmit } = useServerForm(simpanGelombang, (r) => onDone(r.msg));
  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
      <input type="hidden" name="id" defaultValue={edit?.id ?? ''} />
      <div className="form-grid">
        <label className="field">Urutan
          <input name="urutan" type="number" defaultValue={edit?.urutan ?? ''} required autoFocus />
        </label>
        <label className="field">Nama gelombang
          <input name="nama_gelombang" placeholder="Gelombang 1" defaultValue={edit?.nama_gelombang ?? ''} required />
        </label>
        <label className="field">Durasi ujian
          <input name="durasi_ujian" type="number" defaultValue={edit?.durasi_ujian ?? ''} required />
          <small>menit</small>
        </label>
        <label className="field">Jeda sesudahnya
          <input name="durasi_jeda" type="number" defaultValue={edit?.durasi_jeda ?? 0} />
          <small>menit</small>
        </label>
        <label className="field">Batas tap masuk
          <input name="batas_masuk_menit" type="number" min="0" defaultValue={edit?.batas_masuk_menit ?? ''} />
          <small>menit setelah mulai; kosong = sampai selesai</small>
        </label>
        <label className="field">Tap pulang dibuka
          <input name="buka_pulang_menit" type="number" min="0" defaultValue={edit?.buka_pulang_menit ?? 0} />
          <small>menit sebelum selesai</small>
        </label>
        <label className="field span-2">Waktu mulai (WIB)
          <input name="waktu_mulai_rencana" type="datetime-local" defaultValue={edit?.waktu_mulai_input ?? ''} />
          <small>Isi jam mulai gelombang ini. Kosong = dihitung otomatis dari gelombang sebelumnya (mulai + durasi + jeda)</small>
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={pending}><X size={16} />Batal</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{pending ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  );
}
