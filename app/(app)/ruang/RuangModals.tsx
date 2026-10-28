'use client';
import { useState } from 'react';
import { CircleAlert, LoaderCircle, Pencil, Plus, Save, UserPlus, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { useServerForm } from '@/components/useServerForm';
import { showToast } from '@/components/Toaster';
import { simpanRuang, buatPetugas } from './actions';

export type RuangRow = { id: number; kode_ruang: string; nama_ruang: string };

export function RuangModal({ rows }: { rows: RuangRow[] }) {
  const [buka, setBuka] = useState<{ id: number | null } | null>(null);
  useModalOpener('ruang', (id) => setBuka({ id: id ?? null }));
  if (!buka) return null;

  const edit = buka.id != null ? rows.find((r) => r.id === buka.id) ?? null : null;
  if (buka.id != null && !edit) return null;

  return (
    <Modal
      small
      title={edit ? `Edit ruang ${edit.kode_ruang}` : 'Tambah ruang'}
      icon={edit ? <Pencil size={17} /> : <Plus size={17} />}
      onClose={() => setBuka(null)}
    >
      <RuangForm edit={edit} onCancel={() => setBuka(null)} onDone={(msg) => { setBuka(null); showToast(msg); }} />
    </Modal>
  );
}

function RuangForm({ edit, onCancel, onDone }: { edit: RuangRow | null; onCancel: () => void; onDone: (msg: string) => void }) {
  const { pending, error, onSubmit } = useServerForm(simpanRuang, (r) => onDone(r.msg));
  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
      <input type="hidden" name="id" defaultValue={edit?.id ?? ''} />
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        <label className="field">Kode ruang
          <input name="kode_ruang" placeholder="R-01" defaultValue={edit?.kode_ruang ?? ''} required autoFocus />
        </label>
        <label className="field">Nama ruang
          <input name="nama_ruang" defaultValue={edit?.nama_ruang ?? ''} required />
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

export function PetugasModal({ ruang }: { ruang: { id: number; kode_ruang: string }[] }) {
  const [buka, setBuka] = useState(false);
  useModalOpener('petugas', () => setBuka(true));
  if (!buka) return null;
  return (
    <Modal small title="Buat akun petugas" icon={<UserPlus size={17} />} onClose={() => setBuka(false)}>
      <PetugasForm ruang={ruang} onCancel={() => setBuka(false)} onDone={(msg) => { setBuka(false); showToast(msg); }} />
    </Modal>
  );
}

function PetugasForm({ ruang, onCancel, onDone }: {
  ruang: { id: number; kode_ruang: string }[]; onCancel: () => void; onDone: (msg: string) => void;
}) {
  const { pending, error, onSubmit } = useServerForm(buatPetugas, (r) => onDone(r.msg));
  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
      <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
        <label className="field">Ruang
          <select name="ruang_id" required defaultValue="">
            <option value="" disabled>Pilih ruang</option>
            {ruang.map((r) => <option key={r.id} value={r.id}>{r.kode_ruang}</option>)}
          </select>
          {!ruang.length && <small>Semua ruang sudah punya petugas.</small>}
        </label>
        <label className="field">Username
          <input name="username" required autoComplete="off" />
        </label>
        <label className="field">Nama petugas
          <input name="nama" required />
        </label>
        <label className="field">Password
          <input name="password" type="text" minLength={6} required autoComplete="off" />
          <small>Minimal 6 karakter</small>
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={pending}><X size={16} />Batal</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <UserPlus size={16} />}{pending ? 'Membuat…' : 'Buat akun'}
        </button>
      </div>
    </form>
  );
}
