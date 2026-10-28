import { LoaderCircle } from 'lucide-react';

// Tampil seketika saat pindah menu, selagi data halaman baru dimuat dari server.
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <div className="loading"><LoaderCircle size={18} className="spin" />Memuat halaman</div>
      <div className="skel" style={{ height: 28, width: 220 }} />
      <div className="skel" style={{ height: 110 }} />
      <div className="skel" style={{ height: 280 }} />
    </div>
  );
}
