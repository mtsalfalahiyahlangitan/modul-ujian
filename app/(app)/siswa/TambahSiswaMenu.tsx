'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, MapPinned, Plus, UserPlus } from 'lucide-react';
import { bukaModal } from '@/components/OpenModal';

// Tombol "Tambah siswa" yang membuka daftar pilihan.
export default function TambahSiswaMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const klikLuar = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', klikLuar);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', klikLuar); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pilih = (fn?: () => void) => () => { setOpen(false); fn?.(); };

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="btn btn-primary" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Plus size={16} />Tambah siswa<ChevronDown size={16} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" className="menu-item" onClick={pilih(() => bukaModal('siswa'))}>
            <UserPlus size={16} />Tambah manual
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={pilih(() => bukaModal('siswa-import'))}>
            <FileSpreadsheet size={16} />Upload data siswa (Excel)
          </button>
          <div className="menu-sep" role="separator" />
          <a role="menuitem" className="menu-item" href="/api/siswa/template-ruang" download onClick={pilih()}>
            <Download size={16} />Unduh template ruang &amp; gelombang
          </a>
          <button type="button" role="menuitem" className="menu-item" onClick={pilih(() => bukaModal('ruang-import'))}>
            <MapPinned size={16} />Upload ruang &amp; gelombang
          </button>
        </div>
      )}
    </div>
  );
}
