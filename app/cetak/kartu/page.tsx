import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { ambilDataKartu, ambilPengaturanKartu } from '@/lib/kartu-data';
import { bacaParamKartu, KARTU_PER_HALAMAN, type ParamKartu } from '@/lib/kartu-ujian';
import KartuUjian from '@/components/KartuUjian';
import CetakTombol from '../persyaratan/CetakTombol';

export const metadata = { title: 'Cetak kartu ujian' };

// Halaman cetak kartu ujian (tanpa sidebar): kertas F4, 9 kartu (3 x 3) per lembar. Cetak langsung atau "Simpan sebagai PDF".
export default async function CetakKartuPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = (await searchParams) as ParamKartu & { auto?: string };
  await requireAkses('kartu');
  const db = adminDb();
  const [pengaturan, { kartu, tanpaNomor }] = await Promise.all([ambilPengaturanKartu(db), ambilDataKartu(db, bacaParamKartu(sp))]);
  const lembar = Array.from({ length: Math.ceil(kartu.length / KARTU_PER_HALAMAN) }, (_, i) => kartu.slice(i * KARTU_PER_HALAMAN, (i + 1) * KARTU_PER_HALAMAN));

  return (
    <div className="cetak-kartu">
      {/* Ukuran kertas halaman ini F4 215 x 330 mm tanpa margin (menimpa @page halaman cetak lain di globals.css) */}
      <style>{'@media print { @page { size: 215mm 330mm; margin: 0; } }'}</style>
      <div className="cetak-bar">
        <CetakTombol auto={sp.auto === '1'} />
        <span className="muted">
          {kartu.length} kartu, {lembar.length} lembar F4. Di dialog cetak pilih ukuran kertas F4 / 215 x 330 mm, skala 100%, margin tidak ada, atau &quot;Simpan sebagai PDF&quot;.
          {tanpaNomor.length > 0 && <> {tanpaNomor.length} siswa tanpa nomor ujian tidak ikut dicetak.</>}
        </span>
      </div>
      {lembar.map((isi, i) => (
        <div key={i} className="kartu-lembar">
          {isi.map((d) => <KartuUjian key={d.no_induk} d={d} p={pengaturan} />)}
        </div>
      ))}
      {!lembar.length && <p className="cetak-kosong">Tidak ada kartu untuk dicetak. Pastikan siswa sudah punya nomor ujian.</p>}
    </div>
  );
}
