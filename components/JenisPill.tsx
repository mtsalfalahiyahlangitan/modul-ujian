import { Check } from 'lucide-react';

// Pill singkatan jenis persyaratan. Warna per jenis diatur di globals.css lewat data-k.
// lengkap = true -> tampil outline dengan tanda centang (sudah lengkap); false/undefined -> terisi penuh (belum lengkap).
export function JenisPill({ kode, singkatan, lengkap, title }: { kode: string; singkatan: string; lengkap?: boolean; title?: string }) {
  return (
    <span className={`pill-jenis${lengkap ? ' lengkap' : ''}`} data-k={kode} title={title}>
      {singkatan}{lengkap && <Check size={10} strokeWidth={3} aria-label="lengkap" />}
    </span>
  );
}

// Keterangan singkatan: pill + nama lengkap, dipakai di atas tabel.
export function JenisLegend({ jenis, className = '' }: { jenis: { kode: string; singkatan: string; nama: string }[]; className?: string }) {
  return (
    <ul className={`jenis-legend ${className}`} aria-label="Keterangan singkatan">
      {jenis.map((j) => (
        <li key={j.kode}><JenisPill kode={j.kode} singkatan={j.singkatan} /><span>{j.nama}</span></li>
      ))}
    </ul>
  );
}
