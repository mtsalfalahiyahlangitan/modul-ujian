import bwipjs from 'bwip-js/node';

// Kode batang dan QR sebagai SVG (dibuat di server, tanpa gambar). Dipakai kartu ujian.
// Atribut ukuran dibuang agar SVG mengikuti kotak pembungkusnya (lihat .kartu-qr / .kartu-bar di globals.css).
const lepasUkuran = (svg: string, rasio: 'none' | 'xMidYMid meet') =>
  svg.replace(/<svg /, `<svg preserveAspectRatio="${rasio}" shape-rendering="crispEdges" `);

// QR berisi no. induk
export function svgQr(teks: string): string {
  return lepasUkuran(bwipjs.toSVG({ bcid: 'qrcode', text: teks, eclevel: 'M', paddingwidth: 0, paddingheight: 0 } as Parameters<typeof bwipjs.toSVG>[0]), 'xMidYMid meet');
}
// Barcode Code 128 berisi no. ujian. paddingwidth 10 = 10 modul ruang kosong kiri-kanan (syarat Code 128 agar terbaca scanner).
// Direntangkan ke lebar kotak (rasio batang tetap sama, hanya skala horizontal).
export function svgBarcode(teks: string): string {
  return lepasUkuran(bwipjs.toSVG({ bcid: 'code128', text: teks, height: 10, includetext: false, paddingwidth: 10, paddingheight: 0 }), 'none');
}
