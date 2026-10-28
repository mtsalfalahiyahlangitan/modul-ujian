'use client';
import { useState } from 'react';
import { CircleAlert, LoaderCircle, Pencil, Plus, Save, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { useServerForm } from '@/components/useServerForm';
import { showToast } from '@/components/Toaster';
import { simpanSiswa } from './actions';

export type SiswaRow = {
  id: number; no_induk: string; nama: string; asrama: string; kamar: string | null; kelas: string;
  rfid: string | null; ruang_id: number | null; gelombang: string; no_ujian: string | null; no_bangku: string | null;
};
type RuangOpt = { id: number; kode_ruang: string };

export default function SiswaModal({ rows, ruang }: { rows: SiswaRow[]; ruang: RuangOpt[] }) {
  const [buka, setBuka] = useState<{ id: number | null } | null>(null);
  useModalOpener('siswa', (id) => setBuka({ id: id ?? null }));
  if (!buka) return null;

  const edit = buka.id != null ? rows.find((r) => r.id === buka.id) ?? null : null;
  if (buka.id != null && !edit) return null;

  return (
    <Modal
      title={edit ? `Edit siswa: ${edit.nama}` : 'Tambah siswa'}
      icon={edit ? <Pencil size={17} /> : <Plus size={17} />}
      onClose={() => setBuka(null)}
    >
      <SiswaForm
        edit={edit} ruang={ruang}
        onCancel={() => setBuka(null)}
        onDone={(msg, warn) => { setBuka(null); showToast(msg, warn); }}
      />
    </Modal>
  );
}

function SiswaForm({ edit, ruang, onCancel, onDone }: {
  edit: SiswaRow | null; ruang: RuangOpt[]; onCancel: () => void; onDone: (msg: string, warn: boolean) => void;
}) {
  const { pending, error, onSubmit } = useServerForm(simpanSiswa, (r) => onDone(r.msg, !!r.warn));
  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
      <input type="hidden" name="id" defaultValue={edit?.id ?? ''} />
      <div className="form-grid">
        <label className="field">No. induk
          <input name="no_induk" defaultValue={edit?.no_induk ?? ''} required autoFocus />
        </label>
        <label className="field span-2">Nama
          <input name="nama" defaultValue={edit?.nama ?? ''} required />
        </label>
        <label className="field">Asrama
          <input name="asrama" defaultValue={edit?.asrama ?? ''} required />
        </label>
        <label className="field">Kamar
          <input name="kamar" defaultValue={edit?.kamar ?? ''} />
        </label>
        <label className="field">Kelas
          <input name="kelas" defaultValue={edit?.kelas ?? ''} required />
        </label>
        <label className="field">RFID
          <input name="rfid" defaultValue={edit?.rfid ?? ''} autoComplete="off" />
          <small>Klik kolom ini lalu tap kartu</small>
        </label>
        <label className="field">Ruang
          <select name="ruang_id" defaultValue={edit?.ruang_id ?? ''}>
            <option value="">Belum ditentukan</option>
            {ruang.map((r) => <option key={r.id} value={r.id}>{r.kode_ruang}</option>)}
          </select>
        </label>
        <label className="field">Gelombang
          <input name="gelombang" defaultValue={edit?.gelombang ?? ''} autoComplete="off" />
          <small>Pisahkan dengan &amp;, contoh 1&amp;3</small>
        </label>
        <label className="field">No. ujian
          <input name="no_ujian" defaultValue={edit?.no_ujian ?? ''} autoComplete="off" maxLength={30} />
          <small>Untuk barcode kartu ujian</small>
        </label>
        <label className="field">No. bangku
          <input name="no_bangku" defaultValue={edit?.no_bangku ?? ''} autoComplete="off" maxLength={20} />
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
