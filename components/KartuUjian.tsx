import KartuTampil from './KartuTampil';
import { svgBarcode, svgQr } from '@/lib/kartu-kode';
import { URL_KOP, URL_KOP_BAWAAN, type DataKartu, type PengaturanKartu } from '@/lib/kartu-ujian';

export const urlKop = (p: PengaturanKartu) => (p.ada_kop ? `${URL_KOP}?v=${p.versi}` : URL_KOP_BAWAAN);

// Satu kartu ujian untuk halaman cetak (komponen server: QR = no. induk, barcode = no. ujian dibuat sebagai SVG di sini).
export default function KartuUjian({ d, p }: { d: DataKartu; p: PengaturanKartu }) {
  return <KartuTampil d={d} t={p} kop={urlKop(p)} qr={svgQr(d.no_induk)} bar={svgBarcode(d.no_ujian)} />;
}
