'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, Share, X } from 'lucide-react';
import LogoMadrasah from './LogoMadrasah';

// Ajakan memasang aplikasi ke layar utama.
// - Chrome / Edge / Android: tombol "Pasang" memunculkan dialog pemasangan bawaan browser (sekali klik).
// - iPhone / iPad (Safari): iOS tidak mengizinkan pemasangan lewat tombol, jadi yang tampil adalah petunjuk langkahnya.
// Tidak tampil bila aplikasi sudah dibuka dari layar utama, atau bila ditutup (muncul lagi setelah 7 hari).
type EvtPasang = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const KUNCI = 'pasang-app-tutup';
const JEDA = 7 * 24 * 3600 * 1000;

export default function PasangAplikasi() {
  const pathname = usePathname();
  const [evt, setEvt] = useState<EvtPasang | null>(null);
  const [ios, setIos] = useState(false);
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    // Service worker hanya di produksi agar tidak mengganggu mode pengembangan
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {});

    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      const t = Number(localStorage.getItem(KUNCI));
      if (t && Date.now() - t < JEDA) return;
    } catch { /* penyimpanan diblokir: tampilkan saja */ }

    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) { setIos(true); setTampil(true); }

    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as EvtPasang); setTampil(true); };
    const onInstalled = () => { setTampil(false); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  function tutup() {
    try { localStorage.setItem(KUNCI, String(Date.now())); } catch { /* abaikan */ }
    setTampil(false);
  }

  async function pasang() {
    if (!evt) return;
    await evt.prompt();
    const r = await evt.userChoice;
    setEvt(null);
    setTampil(false);
    if (r.outcome === 'dismissed') tutup();
  }

  if (!tampil || pathname.startsWith('/cetak')) return null;
  return (
    <aside className="pasang-app" role="dialog" aria-label="Pasang aplikasi">
      <LogoMadrasah size={42} />
      <div className="pasang-isi">
        <b>Pasang aplikasi Module Ujian</b>
        {evt
          ? <p>Tambahkan ke layar utama agar bisa dibuka seperti aplikasi biasa, tanpa mengetik link.</p>
          : <p>Ketuk <Share size={14} className="pasang-ikon" aria-label="Bagikan" /> Bagikan di Safari, lalu pilih <b>Tambah ke Layar Utama</b>.</p>}
        <div className="pasang-aksi">
          {evt && <button type="button" className="btn btn-sm btn-primary" onClick={pasang}><Download size={14} />Pasang</button>}
          <button type="button" className="btn btn-sm" onClick={tutup}>{evt ? 'Nanti saja' : 'Mengerti'}</button>
        </div>
      </div>
      <button type="button" className="icon-btn pasang-x" aria-label="Tutup" onClick={tutup}><X size={16} /></button>
    </aside>
  );
}
