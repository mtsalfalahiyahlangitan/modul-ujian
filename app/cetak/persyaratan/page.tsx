import { requireAksesSub } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { ambilDataCetak, bacaParamCetak, belumLengkap, type ParamCetak } from '@/lib/persyaratan-cetak';
import { singkatJenis } from '@/lib/persyaratan';
import { JenisLegend, JenisPill } from '@/components/JenisPill';
import CetakTombol from './CetakTombol';
import FitLebar from './FitLebar';

export const metadata = { title: 'Cetak persyaratan ujian' };

// Halaman cetak daftar penjaringan persyaratan ujian (tanpa sidebar). Cetak langsung atau pilih "Simpan sebagai PDF" di dialog cetak.
export default async function CetakPersyaratanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { kelas } = await requireAksesSub('dashboard'); // cetak mengikuti batas tingkat kelas di Dashboard
  const p = bacaParamCetak(sp as ParamCetak);
  const { baris, adaData, jenis } = await ambilDataCetak(adminDb(), p, kelas);
  const legend = jenis.map((j) => ({ kode: j.kode, singkatan: singkatJenis(j.kode, j.nama), nama: j.nama }));

  const persyaratanSel = (s: (typeof baris)[number], ada: boolean) => {
    const belum = belumLengkap(s);
    if (belum.length) return belum.map((t) => <JenisPill key={t.kode} kode={t.kode} singkatan={t.singkatan} />);
    if (s.terjaring.length) return 'Lengkap';
    return ada ? 'Tidak terjaring' : '-';
  };

  return (
    <div className="cetak">
      <div className="cetak-bar">
        <CetakTombol auto={sp.auto === '1'} />
        <form method="get" className="cetak-form">
          <input type="hidden" name="judul" value={p.judul} /><input type="hidden" name="status" value={p.status} />
          <input type="hidden" name="kelas" value={p.kelas} /><input type="hidden" name="asrama" value={p.asrama} />
          <label>Maks. halaman <input type="number" name="maks" min={1} max={999} placeholder="Tanpa batas" defaultValue={p.maks ?? ''} /></label>
          <button type="submit" className="btn btn-sm">Terapkan</button>
        </form>
        <span className="muted">{baris.length} siswa. Kertas F4. Di dialog cetak pilih printer, atau &quot;Simpan sebagai PDF&quot;.</span>
      </div>

      <FitLebar maks={p.maks}>
      <div className="cetak-judul">{p.judul}</div>
      <table className="cetak-tabel">
        <thead>
          {legend.length > 0 && <tr className="cetak-legend-baris"><th colSpan={6} className="c-legend"><JenisLegend jenis={legend} className="cetak-legend" /></th></tr>}
          <tr><th className="c-no">NO</th><th className="c-induk">INDUK</th><th>NAMA</th><th className="c-asrama">ASRAMA</th><th className="c-kelas">KELAS</th><th className="c-pers">PERSYARATAN</th></tr>
        </thead>
        <tbody>
          {baris.map((s, i) => (
            <tr key={s.no_induk}>
              <td className="c-no">{i + 1}</td><td className="c-induk">{s.no_induk}</td><td>{s.nama}</td>
              <td className="c-asrama">{s.asrama}</td><td className="c-kelas">{s.kelas}</td>
              <td className="c-pers">{persyaratanSel(s, adaData)}</td>
            </tr>
          ))}
          {!baris.length && <tr><td colSpan={6} className="cetak-kosong">Tidak ada data yang cocok dengan filter.</td></tr>}
        </tbody>
      </table>
      <div className="cetak-penutup" />
      </FitLebar>
    </div>
  );
}
