'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { scanAbsen } from '@/app/(app)/absen/actions';
import { Camera, CameraOff, Check, CircleAlert, Info, LogIn, LogOut, ScanLine, CircleX } from 'lucide-react';
import type { ScanResult } from '@/lib/scan-types';

function beep(okk: boolean, pulang = false) {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const o = ctx.createOscillator();
    o.frequency.value = okk ? (pulang ? 660 : 880) : 220;
    o.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, okk ? 120 : 350);
  } catch { /* abaikan */ }
}

export default function ScanBox({ ruangId }: { ruangId: number }) {
  const [state, formAction] = useActionState<ScanResult | null, FormData>(scanAbsen, null);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const last = useRef({ kode: '', t: 0 });
  const [kamera, setKamera] = useState(false);
  const [kameraErr, setKameraErr] = useState('');

  // Bunyi + fokus kembali ke kolom scan setiap ada hasil
  useEffect(() => {
    if (state) beep(state.ok, state.kind === 'pulang');
    inputRef.current?.focus();
  }, [state]);

  // Scan lewat kamera HP/laptop (QR & barcode)
  useEffect(() => {
    if (!kamera) return;
    let scanner: any;
    let batal = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (batal) return;
        scanner = new Html5Qrcode('scan-reader');
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 200 } },
          (text: string) => {
            const now = Date.now();
            if (text === last.current.kode && now - last.current.t < 3000) return; // cegah baca ganda
            last.current = { kode: text, t: now };
            if (inputRef.current) inputRef.current.value = text;
            formRef.current?.requestSubmit();
          },
          () => {}
        );
      } catch (e: any) {
        setKameraErr('Kamera tidak bisa dibuka (butuh izin kamera & HTTPS): ' + (e?.message ?? e));
        setKamera(false);
      }
    })();
    return () => {
      batal = true;
      if (scanner) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [kamera]);

  const hasil = {
    masuk: { Icon: LogIn, label: 'Masuk' },
    pulang: { Icon: LogOut, label: 'Pulang' },
    info: { Icon: Info, label: '' },
    error: { Icon: CircleX, label: 'Ditolak' },
  };

  return (
    <section className="panel scan">
      <div className="panel-head">
        <h2><ScanLine size={18} />Scan kehadiran</h2>
        <span className="muted">Tap pertama = masuk, tap kedua = pulang</span>
      </div>
      <div className="panel-body">
        <form
          ref={formRef}
          action={formAction}
          onSubmit={() => setTimeout(() => { if (inputRef.current) inputRef.current.value = ''; }, 0)}
        >
          <input type="hidden" name="ruang_id" value={ruangId} />
          <div className="scan-row">
            <input ref={inputRef} name="kode" autoFocus autoComplete="off" aria-label="Kode kartu, barcode, atau QR"
              placeholder="Tap kartu atau scan kode, lalu Enter" />
            <button type="submit" className="btn btn-primary"><Check size={17} />Proses</button>
            <button type="button" className="btn" onClick={() => { setKameraErr(''); setKamera((k) => !k); }}>
              {kamera ? <><CameraOff size={17} />Tutup kamera</> : <><Camera size={17} />Pakai kamera</>}
            </button>
          </div>
        </form>
        {kameraErr && (
          <div className="alert alert-error" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>
            <CircleAlert size={18} /><span>{kameraErr}</span>
          </div>
        )}
        {kamera && <div id="scan-reader" style={{ width: 300, maxWidth: '100%', marginTop: 12 }} />}
      </div>
      {state && (() => {
        const { Icon, label } = hasil[state.kind];
        return (
          <div className={`scan-result ${state.kind}`} role="status" aria-live="polite">
            <Icon size={22} />
            <span>{label && <b>{label}. </b>}{state.msg}</span>
          </div>
        );
      })()}
    </section>
  );
}
