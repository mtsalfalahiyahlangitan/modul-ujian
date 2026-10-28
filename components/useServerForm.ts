'use client';
import { useState, useTransition, type FormEvent } from 'react';
import type { FormState } from '@/lib/util';

// Mengirim form ke server action tanpa reload/redirect. Error ditampilkan di dalam pop up
// dan isian tetap utuh (React 19 mengosongkan form bila memakai prop action, jadi dipakai onSubmit).
export function useServerForm(
  action: (fd: FormData) => Promise<FormState>,
  onSuccess: (r: FormState) => void,
) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      try {
        const r = await action(fd);
        if (r.ok) onSuccess(r); else setError(r.msg);
      } catch {
        setError('Gagal menghubungi server. Coba lagi.');
      }
    });
  }
  return { pending, error, onSubmit };
}
