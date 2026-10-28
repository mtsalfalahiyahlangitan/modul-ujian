'use client';
import { useState } from 'react';
import { GraduationCap } from 'lucide-react';

// Logo madrasah dari public/logo-madrasah.png. Bila file belum ada, tampil ikon cadangan.
export default function LogoMadrasah({ size = 38 }: { size?: number }) {
  const [gagal, setGagal] = useState(false);
  return (
    <span className="logo logo-madrasah" style={{ width: size, height: size }}>
      {gagal
        ? <GraduationCap size={Math.round(size * 0.55)} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src="/logo-madrasah.png" alt="Logo madrasah" onError={() => setGagal(true)} />}
    </span>
  );
}
