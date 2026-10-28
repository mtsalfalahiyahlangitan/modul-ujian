'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// Ukuran kertas cetak F4 (216 x 330 mm), margin 8 mm -> area cetak 200 x 314 mm. Harus sama dengan @page di globals.css.
const MM = 96 / 25.4;
const TINGGI_AREA = 314 * MM * 0.985; // sisakan 1,5% sebagai pengaman pembulatan browser

// Menjaga tiap siswa tetap SATU baris dan (bila "maks" diisi) seluruh data muat dalam batas jumlah halaman.
// Tinggi baris, padding, dan lebar tabel semuanya mengikuti ukuran huruf (satuan em), jadi cukup mencari ukuran huruf terbesar
// yang (1) tidak melebihi lebar kertas dan (2) tidak melebihi batas halaman. Pencarian dengan binary search.
export default function FitLebar({ children, maks, dasar = 11, minimum = 4 }: { children: ReactNode; maks: number | null; dasar?: number; minimum?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [info, setInfo] = useState<{ halaman: number; ukuran: number; muat: boolean } | null>(null);

  useEffect(() => {
    const wrap = ref.current;
    const tabel = wrap?.querySelector('table') as HTMLTableElement | null;
    const baris = tabel?.tBodies[0]?.rows;
    if (!wrap || !tabel || !baris?.length) return;
    const kepala = tabel.tHead as HTMLElement;
    const judul = wrap.querySelector('.cetak-judul') as HTMLElement | null;

    const coba = (ukuran: number) => {
      tabel.style.fontSize = `${ukuran}px`;
      if (tabel.offsetWidth > wrap.clientWidth + 0.5) return { ok: false, halaman: 0 };
      // Judul hanya di halaman pertama, jadi halaman pertama memuat lebih sedikit baris; header kolom diulang di tiap halaman
      const tinggiBaris = baris[0].getBoundingClientRect().height;
      const tinggiJudul = judul ? judul.getBoundingClientRect().height + 8 : 0; // 8 = jarak bawah judul
      const perHalaman = Math.max(1, Math.floor((TINGGI_AREA - kepala.offsetHeight) / tinggiBaris));
      const pertama = Math.max(0, Math.floor((TINGGI_AREA - tinggiJudul - kepala.offsetHeight) / tinggiBaris));
      const halaman = baris.length <= pertama ? 1 : 1 + Math.ceil((baris.length - pertama) / perHalaman);
      return { ok: !maks || halaman <= maks, halaman };
    };

    let hasil = coba(dasar), ukuran = dasar;
    if (!hasil.ok) {
      let lo = minimum, hi = dasar;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (coba(mid).ok) lo = mid; else hi = mid;
      }
      ukuran = lo; hasil = coba(lo);
    }
    setInfo({ halaman: hasil.halaman, ukuran: Math.round(ukuran * 10) / 10, muat: hasil.ok });
  }, [children, maks, dasar, minimum]);

  return (
    <div ref={ref} className="cetak-wrap">
      {info && (
        <p className={`cetak-info${info.muat ? '' : ' peringatan'}`}>
          {info.muat
            ? <>Perkiraan {info.halaman} halaman{maks ? ` (batas ${maks})` : ''}, ukuran huruf {info.ukuran}px.</>
            : <>Data tidak muat dalam {maks} halaman walau huruf sudah dikecilkan ke batas terkecil ({info.ukuran}px). Naikkan batas halaman, atau persempit dengan filter kelas / asrama.</>}
        </p>
      )}
      {children}
    </div>
  );
}
