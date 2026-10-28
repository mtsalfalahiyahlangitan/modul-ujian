'use client';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { konfirmasi } from './ConfirmHost';

const LABEL: Record<string, string> = { mulai: 'Ya, mulai', selesai: 'Ya, akhiri', batal: 'Ya, batalkan', reset: 'Ya, reset' };

function Tombol({ className, message, aksi, disabled, title, children }: {
  className: string; message?: string; aksi: string; disabled?: boolean; title?: string; children: ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={pending ? `${className} is-pending` : className}
      disabled={pending || disabled}
      aria-busy={pending}
      title={title}
      onClick={async (e) => {
        if (!message) return;
        e.preventDefault();
        const btn = e.currentTarget;
        const ya = await konfirmasi({ judul: 'Konfirmasi', pesan: message, tombol: LABEL[aksi], bahaya: aksi === 'batal' });
        if (ya) btn.form?.requestSubmit(btn);
      }}
    >
      {children}
    </button>
  );
}

// Satu tombol aksi status gelombang = satu form sendiri dengan "aksi" tersembunyi,
// jadi tidak bergantung pada nama/nilai tombol yang menekan submit.
export default function AksiStatus({ action, id, aksi, className = 'btn btn-sm', message, disabled, title, children }: {
  action: (fd: FormData) => void | Promise<void>;
  id: number; aksi: 'mulai' | 'selesai' | 'batal' | 'reset';
  className?: string; message?: string; disabled?: boolean; title?: string; children: ReactNode;
}) {
  return (
    <form action={action} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="aksi" value={aksi} />
      <Tombol className={className} message={message} aksi={aksi} disabled={disabled} title={title}>{children}</Tombol>
    </form>
  );
}
