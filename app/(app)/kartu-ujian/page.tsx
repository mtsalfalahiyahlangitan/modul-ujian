import Link from 'next/link';
import { CircleAlert, Printer, RotateCcw, Search, TriangleAlert } from 'lucide-react';
import { daftarKelasSiswa, requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { ambilDataKartu, ambilPengaturanKartu, itemKartu } from '@/lib/kartu-data';
import { bacaParamKartu, KARTU_PER_HALAMAN, TINGKAT_LAIN, type ParamKartu } from '@/lib/kartu-ujian';
import { bandingKelas } from '@/lib/persyaratan-cetak';
import { ringkasTingkat } from '@/lib/tingkat';
import { urlKop } from '@/components/KartuUjian';
import PageHeader from '@/components/PageHeader';
import KartuStudio from './KartuStudio';

export default async function KartuUjianPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = (await searchParams) as ParamKartu;
  const db = adminDb();
  const f = bacaParamKartu(sp);
  const [, pengaturan, ruangR, gelR, kelas] = await Promise.all([
    requireAkses('kartu'),
    ambilPengaturanKartu(db),
    db.from('ruang').select('id,kode_ruang').order('kode_ruang'),
    db.from('gelombang').select('id,nama_gelombang').order('urutan'),
    daftarKelasSiswa(),
  ]);
  const { kartu, tanpaNomor } = await ambilDataKartu(db, f);
  const adaFilter = !!(f.tingkat || f.kelas || f.ruang || f.gel);
  // Pilihan tingkat mengikuti data kelas siswa yang diunggah (mis. 7, 8, 9; bila ada kelas lain, ikut muncul)
  const daftarKelas = [...kelas].filter(Boolean);
  const { tingkat: daftarTingkat, takTerbaca } = ringkasTingkat(daftarKelas);
  const halaman = Math.ceil(kartu.length / KARTU_PER_HALAMAN);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const lembarPertama = kartu.slice(0, KARTU_PER_HALAMAN).map(itemKartu);

  return (
    <div>
      <PageHeader title="Kartu ujian" desc="Atur header dan kop kartu, pilih siswa yang dicetak, lalu cetak di kertas F4 (9 kartu per lembar)." />

      {pengaturan.belumMigrasi && (
        <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>
          Database belum disiapkan untuk menu ini. Jalankan <code>supabase/migration_kartu_ujian.sql</code> di Supabase SQL Editor, lalu muat ulang halaman.
        </span></div>
      )}

      <KartuStudio key={qs} p={pengaturan} filter={f} lembarPertama={lembarPertama} jumlahLembar={halaman} urlKop={urlKop(pengaturan)}>
        <section className="panel">
          <div className="panel-head"><div><h2>2. Pilih siswa dan cetak</h2><p className="panel-ket">Kartu diurutkan per kelas, lalu nomor ujian.</p></div></div>
          <form method="get" className="kartu-filter">
            <label className="field">Tingkat
              <select name="tingkat" defaultValue={f.tingkat}>
                <option value="">Semua tingkat</option>
                {daftarTingkat.map((t) => <option key={t} value={t}>Kelas {t}</option>)}
                {takTerbaca > 0 && <option value={TINGKAT_LAIN}>Lainnya</option>}
              </select>
            </label>
            <label className="field">Kelas
              <select name="kelas" defaultValue={f.kelas}>
                <option value="">Semua kelas</option>
                {daftarKelas.sort(bandingKelas).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="field">Ruang
              <select name="ruang" defaultValue={f.ruang}>
                <option value="">Semua ruang</option>
                {(ruangR.data ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.kode_ruang}</option>)}
              </select>
            </label>
            <label className="field">Gelombang
              <select name="gel" defaultValue={f.gel}>
                <option value="">Semua gelombang</option>
                {(gelR.data ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.nama_gelombang}</option>)}
              </select>
            </label>
            <div className="kartu-filter-aksi">
              <button type="submit" className="btn"><Search size={16} />Terapkan</button>
              {adaFilter && <Link href="/kartu-ujian" className="btn"><RotateCcw size={16} />Reset</Link>}
            </div>
          </form>

          <div className="panel-body">
            <div className="kartu-ringkas">
              <div className="stat-mini"><span className="lbl">Kartu siap cetak</span><b>{kartu.length}</b></div>
              <div className="stat-mini"><span className="lbl">Lembar F4</span><b>{halaman}</b></div>
              <div className="stat-mini" data-warn={tanpaNomor.length > 0 || undefined}><span className="lbl">Belum ada no. ujian</span><b>{tanpaNomor.length}</b></div>
            </div>
            {tanpaNomor.length > 0 && (
              <div className="alert alert-warn" role="status"><TriangleAlert size={18} /><span>
                Siswa tanpa nomor ujian tidak ikut dicetak
                ({tanpaNomor.slice(0, 4).map((s) => `${s.nama}, ${s.kelas}`).join('; ')}{tanpaNomor.length > 4 ? `; dan ${tanpaNomor.length - 4} lainnya` : ''}).
                Isi di Data siswa, atau lewat Upload ruang &amp; gelombang (kolom No. Ujian).
              </span></div>
            )}
            <div className="kartu-cetak-aksi">
              {kartu.length > 0
                ? <a className="btn btn-primary" href={`/cetak/kartu${qs ? `?${qs}` : ''}`} target="_blank" rel="noopener"><Printer size={16} />Pratinjau &amp; cetak ({kartu.length} kartu)</a>
                : <span className="muted">Tidak ada kartu untuk dicetak dengan filter ini.</span>}
            </div>
          </div>
        </section>
      </KartuStudio>
    </div>
  );
}
