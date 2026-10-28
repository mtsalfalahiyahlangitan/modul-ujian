'use client';
import { useEffect } from 'react';
import { Printer } from 'lucide-react';

// Tombol cetak (juga untuk Simpan sebagai PDF lewat dialog cetak browser). auto = langsung buka dialog cetak.
export default function CetakTombol({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [auto]);
  return <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} />Cetak / Simpan PDF</button>;
}
