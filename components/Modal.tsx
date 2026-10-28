'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Jendela pop up berbasis <dialog> bawaan browser (Esc, fokus, dan lapisan atas sudah ditangani).
// Terbuka saat komponen ini dirender, tanpa menunggu server. onClose dipanggil saat ditutup lewat Esc atau tombol X.
// Klik di luar jendela sengaja tidak menutup, supaya isian form tidak hilang karena salah klik.
export default function Modal({ title, icon, onClose, small, wide, children }: {
  title: string; icon?: ReactNode; onClose: () => void; small?: boolean; wide?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog ref={ref} className={small ? 'modal sm' : wide ? 'modal lg' : 'modal'} aria-labelledby="modal-title" onClose={onClose}>
      <div className="modal-card">
        <div className="modal-head">
          <h2 id="modal-title">{icon}{title}</h2>
          <button type="button" className="icon-btn" aria-label="Tutup" onClick={() => ref.current?.close()}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </dialog>
  );
}
