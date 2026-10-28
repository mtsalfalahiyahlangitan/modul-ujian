'use client';
import { useMemo, useState } from 'react';
import { CircleAlert, LayoutGrid, LoaderCircle, Save, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { useServerForm } from '@/components/useServerForm';
import { showToast } from '@/components/Toaster';
import { bangunRuang, cekPola } from '@/lib/ruang-gen';
import { buatRuangMassal } from './actions';

export default function RuangMassalModal({ ada }: { ada: string[] }) {
  const [buka, setBuka] = useState(false);
  useModalOpener('ruang-massal', () => setBuka(true));
  if (!buka) return null;
  return (
    <Modal title="Buat ruang massal" icon={<LayoutGrid size={17} />} onClose={() => setBuka(false)}>
      <Form ada={ada} onCancel={() => setBuka(false)} onDone={(msg, warn) => { setBuka(false); showToast(msg, warn); }} />
    </Modal>
  );
}

function Form({ ada, onCancel, onDone }: { ada: string[]; onCancel: () => void; onDone: (msg: string, warn: boolean) => void }) {
  const { pending, error, onSubmit } = useServerForm(buatRuangMassal, (r) => onDone(r.msg, !!r.warn));
  const [prefix, setPrefix] = useState('R-');
  const [mulai, setMulai] = useState('1');
  const [jumlah, setJumlah] = useState('10');
  const [digit, setDigit] = useState('2');
  const [pola, setPola] = useState('Ruang {no}');

  const p = { prefix: prefix.trim(), mulai: Number(mulai), jumlah: Number(jumlah), digit: Number(digit), pola: pola.trim() || 'Ruang {no}' };
  const salah = cekPola(p);
  const { daftar, lewat } = useMemo(() => {
    if (salah) return { daftar: [], lewat: 0 };
    const set = new Set(ada.map((k) => k.toLowerCase()));
    const d = bangunRuang(p).map((r) => ({ ...r, sudah: set.has(r.kode_ruang.toLowerCase()) }));
    return { daftar: d, lewat: d.filter((r) => r.sudah).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix, mulai, jumlah, digit, pola, salah, ada]);
  const baru = daftar.length - lewat;
  const tampil = daftar.length > 8 ? [...daftar.slice(0, 4), null, ...daftar.slice(-3)] : daftar;

  return (
    <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
      <div className="form-grid">
        <label className="field">Awalan kode
          <input name="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="R-" autoFocus />
        </label>
        <label className="field">Nomor awal
          <input name="mulai" type="number" min="0" value={mulai} onChange={(e) => setMulai(e.target.value)} required />
        </label>
        <label className="field">Jumlah ruang
          <input name="jumlah" type="number" min="1" max="200" value={jumlah} onChange={(e) => setJumlah(e.target.value)} required />
          <small>maksimal 200</small>
        </label>
        <label className="field">Digit nomor
          <input name="digit" type="number" min="0" max="4" value={digit} onChange={(e) => setDigit(e.target.value)} />
          <small>2 → 01, 02, … (0 = tanpa nol di depan)</small>
        </label>
        <label className="field span-2">Pola nama ruang
          <input name="pola" value={pola} onChange={(e) => setPola(e.target.value)} />
          <small>{'{no}'} diganti nomor ruang, contoh &quot;Ruang {'{no}'}&quot;</small>
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="muted" style={{ marginBottom: 6 }}>Pratinjau</div>
        {salah ? (
          <div className="alert alert-warn" role="status"><CircleAlert size={18} /><span>{salah}</span></div>
        ) : (
          <>
            <div className="chips">
              {tampil.map((r, i) => r
                ? <span key={r.kode_ruang} className={`badge ${r.sudah ? 'badge-gray' : 'badge-green'}`} title={r.nama_ruang}>{r.kode_ruang}{r.sudah ? ' (sudah ada)' : ''}</span>
                : <span key={`titik${i}`} className="muted">…</span>)}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              {baru} ruang akan dibuat{lewat ? `, ${lewat} dilewati karena kodenya sudah ada` : ''}. Contoh nama: {daftar[0]?.nama_ruang}.
            </p>
          </>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={pending}><X size={16} />Batal</button>
        <button type="submit" className="btn btn-primary" disabled={pending || !!salah || baru === 0}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{pending ? 'Membuat…' : `Buat ${baru} ruang`}
        </button>
      </div>
    </form>
  );
}
