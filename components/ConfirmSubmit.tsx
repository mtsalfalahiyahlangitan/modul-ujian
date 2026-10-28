'use client';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { konfirmasi } from './ConfirmHost';

// Tombol submit dengan konfirmasi (dialog milik aplikasi). Isi tombol (ikon + teks) dikirim lewat children.
// Selama form diproses, tombol dinonaktifkan dan memberi tanda sedang bekerja.
export default function ConfirmSubmit({ message, className = 'btn btn-sm btn-danger', tombol, judul, children }: {
  message: string; className?: string; tombol?: string; judul?: string; children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={pending ? `${className} is-pending` : className}
      disabled={pending}
      aria-busy={pending}
      onClick={async (e) => {
        e.preventDefault();
        const btn = e.currentTarget;
        const ya = await konfirmasi({ judul, pesan: message, tombol, bahaya: className.includes('btn-danger') });
        if (ya) btn.form?.requestSubmit(btn);
      }}
    >
      {children}
    </button>
  );
}
