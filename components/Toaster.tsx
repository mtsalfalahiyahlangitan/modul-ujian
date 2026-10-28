'use client';
import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

const EVENT = 'app:toast';
type Detail = { msg: string; warn: boolean };

export function showToast(msg: string, warn = false) {
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { msg, warn } }));
}

// Pemberitahuan singkat di pojok layar (mis. "Siswa tersimpan"). Dipasang sekali di layout.
export default function Toaster() {
  const [t, setT] = useState<Detail | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const h = (e: Event) => {
      setT((e as CustomEvent<Detail>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setT(null), 4000);
    };
    window.addEventListener(EVENT, h);
    return () => { window.removeEventListener(EVENT, h); clearTimeout(timer); };
  }, []);
  if (!t) return null;
  return (
    <div className={t.warn ? 'toast warn' : 'toast'} role="status" aria-live="polite">
      {t.warn ? <CircleAlert size={18} /> : <CircleCheck size={18} />}<span>{t.msg}</span>
    </div>
  );
}
