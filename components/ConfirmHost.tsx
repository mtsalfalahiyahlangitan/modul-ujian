'use client';
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, TriangleAlert, X } from 'lucide-react';

// Dialog konfirmasi milik aplikasi (pengganti confirm() bawaan browser).
// Pemakaian di komponen client: if (!(await konfirmasi({ pesan: '...', tombol: 'Hapus', bahaya: true }))) return;
// <ConfirmHost /> dipasang sekali di layout.
const EVENT = 'app:confirm';
export type OpsiKonfirmasi = { judul?: string; pesan: string; tombol?: string; bahaya?: boolean };
type Detail = OpsiKonfirmasi & { selesai: (ok: boolean) => void };

export function konfirmasi(o: OpsiKonfirmasi): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { ...o, selesai: resolve } }));
  });
}

function Kotak({ req, tutup }: { req: Detail; tutup: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const batalRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const selesai = useRef(false);
  const akhir = (ok: boolean) => { if (selesai.current) return; selesai.current = true; tutup(ok); };

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // Aksi berbahaya: fokus awal di "Batal" agar Enter tidak langsung menghapus
    (req.bahaya ? batalRef : okRef).current?.focus();
  }, [req.bahaya]);

  return (
    <dialog ref={ref} className="modal sm konfirmasi" aria-labelledby="konf-judul" aria-describedby="konf-pesan" onClose={() => akhir(false)}>
      <div className="modal-card">
        <div className="modal-head">
          <h2 id="konf-judul">{req.judul ?? 'Konfirmasi'}</h2>
          <button type="button" className="icon-btn" aria-label="Tutup" onClick={() => akhir(false)}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <span className={req.bahaya ? 'konf-ikon bahaya' : 'konf-ikon'}>{req.bahaya ? <TriangleAlert size={20} /> : <CircleAlert size={20} />}</span>
          <p id="konf-pesan" className="konf-pesan">{req.pesan}</p>
        </div>
        <div className="konf-aksi">
          <button ref={batalRef} type="button" className="btn" onClick={() => akhir(false)}>Batal</button>
          <button ref={okRef} type="button" className={req.bahaya ? 'btn btn-danger-solid' : 'btn btn-primary'} onClick={() => akhir(true)}>{req.tombol ?? 'Ya, lanjutkan'}</button>
        </div>
      </div>
    </dialog>
  );
}

export default function ConfirmHost() {
  const [req, setReq] = useState<(Detail & { n: number }) | null>(null);
  const hitung = useRef(0);
  const aktif = useRef<Detail | null>(null);

  useEffect(() => {
    const h = (e: Event) => {
      aktif.current?.selesai(false); // permintaan lama yang belum dijawab dianggap batal
      const d = (e as CustomEvent<Detail>).detail;
      aktif.current = d;
      setReq({ ...d, n: ++hitung.current });
    };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);

  if (!req) return null;
  return (
    <Kotak
      key={req.n}
      req={req}
      tutup={(ok) => { aktif.current = null; req.selesai(ok); setReq(null); }}
    />
  );
}
