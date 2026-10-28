import { JenisPill } from './JenisPill';
import { ukuranMuat, type DataKartu } from '@/lib/kartu-ujian';

// Tampilan satu kartu ujian (murni, tanpa server) agar bisa dipakai pratinjau langsung di browser maupun cetak.
// QR dan barcode datang sebagai SVG yang dibuat server (lihat KartuUjian.tsx). Ukuran fisik kartu ada di globals.css (.kartu).
export type TeksKartu = { jenis_ujian: string; madrasah: string; tahun_ajaran: string };

// Lebar area teks kartu: 54 mm dikurangi padding kiri-kanan 3 mm
const LEBAR_ISI_MM = 48;

export default function KartuTampil({ d, t, kop, qr, bar }: { d: DataKartu; t: TeksKartu; kop: string; qr: string; bar: string }) {
  return (
    <div className="kartu-id">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="kartu-kop" src={kop} alt="" />
      <div className="kartu-judul" style={{ fontSize: `${ukuranMuat(t.jenis_ujian, LEBAR_ISI_MM, 17, 9, true, 0.02, 0.62)}pt` }}>{t.jenis_ujian}</div>
      <div className="kartu-madrasah" style={{ fontSize: `${ukuranMuat(t.madrasah, LEBAR_ISI_MM, 7, 5.5)}pt` }}>{t.madrasah}</div>
      <div className="kartu-tahun">Tahun Ajaran : {t.tahun_ajaran}</div>
      <div className="kartu-garis" />
      <div className="kartu-isi">
        <div className="kartu-baris kartu-dua"><span>NO UJIAN: {d.no_ujian}</span><span>NO BANGKU: {d.no_bangku}</span></div>
        <div className="kartu-baris kartu-nama">NAMA: {d.nama}</div>
        <div className="kartu-baris">KELAS: {d.kelas}</div>
        <div className="kartu-baris kartu-dua"><span>RUANG: {d.ruang}</span><span>GEL: {d.gelombang}</span></div>
        <div className="kartu-baris kartu-ket">
          <span>KETERANGAN:</span>
          {d.ket.map((k) => <JenisPill key={k.kode} kode={k.kode} singkatan={k.singkatan} lengkap={k.lengkap} title={`${k.nama}${k.lengkap ? ' (sudah lengkap)' : ''}`} />)}
        </div>
      </div>
      <div className="kartu-kode">
        <div className="kartu-qr" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="kartu-bar">
          <div className="kartu-bar-label">INDUK/NO UJIAN</div>
          <div className="kartu-bar-gambar" dangerouslySetInnerHTML={{ __html: bar }} />
          <div className="kartu-bar-angka">{d.no_ujian.split('').join(' ')}</div>
        </div>
      </div>
    </div>
  );
}
