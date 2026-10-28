'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Muat ulang data halaman secara berkala (tanpa reload penuh) supaya status gelombang yang berubah
// karena jam berjalan langsung tampil. Berhenti saat tab tidak terlihat, dan langsung segar saat tab dibuka lagi.
export default function AutoRefresh({ detik = 30 }: { detik?: number }) {
  const router = useRouter();
  useEffect(() => {
    const segarkan = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const t = setInterval(segarkan, detik * 1000);
    document.addEventListener('visibilitychange', segarkan);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', segarkan); };
  }, [router, detik]);
  return null;
}
