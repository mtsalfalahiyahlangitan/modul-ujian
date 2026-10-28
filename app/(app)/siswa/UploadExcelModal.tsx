'use client';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { CircleAlert, FileSpreadsheet, LoaderCircle, RefreshCw, Upload, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { showToast } from '@/components/Toaster';
import type { Pratinjau, Ringkasan } from '@/lib/siswa-types';
import type { FormState } from '@/lib/util';

type Kolom = { key: string; label: string };
const TAMPIL_MAKS = 500;

// Pop up upload Excel generik: pilih file -> pratinjau (server memvalidasi) -> konfirmasi import.
export default function UploadExcelModal(props: {
  event: string; title: string; petunjuk: ReactNode; kolom: Kolom[]; tombolImport: string;
  pratinjau: (fd: FormData) => Promise<Pratinjau>;
  impor: (fd: FormData) => Promise<FormState>;
}) {
  const [buka, setBuka] = useState(false);
  useModalOpener(props.event, () => setBuka(true));
  if (!buka) return null;
  return (
    <Modal title={props.title} icon={<FileSpreadsheet size={17} />} wide onClose={() => setBuka(false)}>
      <Isi {...props} onTutup={() => setBuka(false)} />
    </Modal>
  );
}

function Isi({ petunjuk, kolom, tombolImport, pratinjau, impor, onTutup }: {
  petunjuk: ReactNode; kolom: Kolom[]; tombolImport: string;
  pratinjau: (fd: FormData) => Promise<Pratinjau>; impor: (fd: FormData) => Promise<FormState>; onTutup: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [hasil, setHasil] = useState<Pratinjau | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hanyaError, setHanyaError] = useState(false);
  const [membaca, bacaTransition] = useTransition();
  const [menyimpan, simpanTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function pilih(f: File | null) {
    setFile(f); setHasil(null); setError(null); setHanyaError(false);
    if (!f) return;
    const fd = new FormData();
    fd.set('file', f);
    bacaTransition(async () => {
      try {
        const r = await pratinjau(fd);
        if (r.ok === false) setError(r.msg); else setHasil(r);
      } catch {
        setError('Gagal menghubungi server. Coba lagi.');
      }
    });
  }

  function ulang() {
    setFile(null); setHasil(null); setError(null);
    if (input.current) input.current.value = '';
  }

  function simpan() {
    if (!file) return;
    const fd = new FormData();
    fd.set('file', file);
    setError(null);
    simpanTransition(async () => {
      try {
        const r = await impor(fd);
        if (r.ok) { onTutup(); showToast(r.msg, !!r.warn); } else setError(r.msg);
      } catch {
        setError('Gagal menghubungi server. Coba lagi.');
      }
    });
  }

  const data = hasil && hasil.ok ? hasil : null;
  const jmlError = data?.ringkasan.find((r) => r.status === 'error')?.jumlah ?? 0;
  const baris = data ? (hanyaError ? data.rows.filter((r) => r.status === 'error') : data.rows) : [];
  const info = new Map<string, Ringkasan>((data?.ringkasan ?? []).map((r) => [r.status, r] as [string, Ringkasan]));

  return (
    <div>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}

      {!data && (
        <>
          <label className="dropzone" style={{ opacity: membaca ? .6 : 1 }}>
            {membaca ? <LoaderCircle size={28} className="spin" /> : <Upload size={28} />}
            <strong>{membaca ? 'Membaca file…' : 'Pilih file Excel (.xlsx)'}</strong>
            <input
              ref={input} type="file" hidden disabled={membaca}
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={(e) => pilih(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="muted" style={{ marginTop: 12 }}>{petunjuk}</div>
        </>
      )}

      {data && (
        <>
          <div className="preview-sum">
            <strong>{data.namaFile}</strong>
            <span className="badge badge-gray">{data.total} baris</span>
            {data.ringkasan.map((r) => <span key={r.status} className={`badge ${r.cls}`}>{r.jumlah} {r.label.toLowerCase()}</span>)}
            {jmlError > 0 && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                <input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={hanyaError} onChange={(e) => setHanyaError(e.target.checked)} />
                Hanya tampilkan error
              </label>
            )}
          </div>
          {jmlError > 0 && (
            <div className="alert alert-warn" role="status">
              <CircleAlert size={18} />
              <span>Baris error tidak akan disimpan. Perbaiki di Excel lalu unggah ulang, atau lanjutkan untuk menyimpan {data.bisaDiimpor} baris yang valid saja.</span>
            </div>
          )}
          <div className="preview-scroll">
            <table className="tbl-desktop">
              <thead><tr><th>Baris</th><th>Status</th>{kolom.map((k) => <th key={k.key}>{k.label}</th>)}<th>Keterangan</th></tr></thead>
              <tbody>
                {baris.slice(0, TAMPIL_MAKS).map((r, n) => {
                  const st = info.get(r.status);
                  return (
                    <tr key={`${r.baris}-${n}`} className={r.status === 'error' ? 'row-error' : undefined}>
                      <td className="num">{r.baris}</td>
                      <td><span className={`badge ${st?.cls ?? 'badge-gray'}`}>{st?.label ?? r.status}</span></td>
                      {kolom.map((k) => <td key={k.key}>{r[k.key] || <span className="muted">-</span>}</td>)}
                      <td className="pesan">{r.pesan}</td>
                    </tr>
                  );
                })}
                {!baris.length && <tr><td colSpan={kolom.length + 3} className="empty">Tidak ada baris.</td></tr>}
              </tbody>
            </table>
            <ul className="kartu-list tbl-mobile">
              {baris.slice(0, TAMPIL_MAKS).map((r, n) => {
                const st = info.get(r.status);
                const judul = kolom.find((k) => k.key === 'nama') ?? kolom[0];
                return (
                  <li key={`${r.baris}-${n}`} className={`kartu${r.status === 'error' ? ' kartu-error' : ''}`}>
                    <div className="kartu-atas">
                      <span className="kartu-nama">{r[judul.key] || '-'}</span>
                      <span className={`badge ${st?.cls ?? 'badge-gray'}`}>{st?.label ?? r.status}</span>
                    </div>
                    <div className="kartu-meta">
                      <span>Baris {r.baris}</span>
                      {kolom.filter((k) => k !== judul && r[k.key]).map((k) => <span key={k.key}>{r[k.key]}</span>)}
                    </div>
                    {r.pesan && <div className="kartu-pesan">{r.pesan}</div>}
                  </li>
                );
              })}
              {!baris.length && <li className="empty">Tidak ada baris.</li>}
            </ul>
          </div>
          {baris.length > TAMPIL_MAKS && <p className="muted" style={{ marginTop: 8 }}>Menampilkan {TAMPIL_MAKS} dari {baris.length} baris. Semua baris valid tetap disimpan.</p>}
        </>
      )}

      <div className="preview-actions">
        <button type="button" className="btn" onClick={data || file ? ulang : onTutup} disabled={menyimpan || membaca}>
          {data || file ? <><RefreshCw size={16} />Ganti file</> : <><X size={16} />Batal</>}
        </button>
        {data && (
          <button type="button" className="btn btn-primary" onClick={simpan} disabled={menyimpan || data.bisaDiimpor === 0}>
            {menyimpan ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />}
            {menyimpan ? 'Menyimpan…' : `${tombolImport} (${data.bisaDiimpor})`}
          </button>
        )}
      </div>
    </div>
  );
}
