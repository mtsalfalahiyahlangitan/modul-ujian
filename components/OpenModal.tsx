'use client';
import { useEffect, useRef, type ReactNode } from 'react';

// Tombol di halaman (server component) membuka pop up yang ada di komponen client lain lewat event browser.
// Pop up langsung terbuka di browser, tanpa perjalanan ke server.
const EVENT = 'app:open-modal';
type Detail = { name: string; id?: number };

export function bukaModal(name: string, id?: number) {
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { name, id } }));
}

export default function OpenModal({ name, id, className, children }: {
  name: string; id?: number; className?: string; children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { name, id } }))}
    >
      {children}
    </button>
  );
}

export function useModalOpener(name: string, onOpen: (id?: number) => void) {
  const ref = useRef(onOpen);
  useEffect(() => { ref.current = onOpen; });
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<Detail>).detail;
      if (d.name === name) ref.current(d.id);
    };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, [name]);
}
