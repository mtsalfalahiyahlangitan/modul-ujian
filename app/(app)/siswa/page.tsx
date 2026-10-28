import Link from 'next/link';
import { RotateCcw, Search } from 'lucide-react';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { formatGelombang } from '@/lib/gelombang-input';
import { filterSiswa } from '@/lib/siswa-filter';
import Flash from '@/components/Flash';
import PageHeader from '@/components/PageHeader';
import { importRuangExcel, importSiswaExcel, pratinjauRuang, pratinjauSiswa } from './actions';
import SiswaTable, { type BarisSiswa } from './SiswaTable';
import SiswaModal, { type SiswaRow } from './SiswaModal';
import UploadExcelModal from './UploadExcelModal';
import TambahSiswaMenu from './TambahSiswaMenu';

export default async function SiswaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = adminDb();

  // Saat filter gelombang aktif, pakai !inner agar hanya siswa di gelombang itu yang muncul
  const filterGel = sp.gel ? Number(sp.gel) : null;
  let q = db.from('siswa').select(
    filterGel
      ? '*, ruang(kode_ruang), sg:siswa_gelombang!inner(gelombang_id), semua:siswa_gelombang(gelombang(urutan,nama_gelombang))'
      : '*, ruang(kode_ruang), semua:siswa_gelombang(gelombang(urutan,nama_gelombang))',
    { count: 'exact' });
  q = filterSiswa(q, sp);
  // Cek login dan semua query berjalan bersamaan (bukan berurutan)
  const [, ruangR, gelR, { data: siswa, count }] = await Promise.all([
    requireAkses('siswa'),
    db.from('ruang').select('*').order('kode_ruang'),
    db.from('gelombang').select('*').order('urutan'),
    q.order('nama').limit(200),
  ]);

  const gelDari = (s: any) => ((s?.semua ?? []) as any[]).map((x) => x.gelombang).filter(Boolean);
  const adaFilter = !!(sp.q || sp.kelas || sp.asrama || sp.ruang || sp.gel);
  // Data untuk pop up edit dikirim sekali; pop up terbuka langsung di browser tanpa ke server
  const rowsEdit: SiswaRow[] = (siswa ?? []).map((s: any) => ({
    id: s.id, no_induk: s.no_induk, nama: s.nama, asrama: s.asrama, kamar: s.kamar ?? null, kelas: s.kelas,
    rfid: s.rfid ?? null, ruang_id: s.ruang_id ?? null, gelombang: formatGelombang(gelDari(s)),
    no_ujian: s.no_ujian ?? null, no_bangku: s.no_bangku ?? null,
  }));
  const baris: BarisSiswa[] = (siswa ?? []).map((s: any) => ({
    id: s.id, no_induk: s.no_induk, nama: s.nama, asrama: s.asrama, kamar: s.kamar ?? null, kelas: s.kelas,
    rfid: s.rfid ?? null, ruang: s.ruang?.kode_ruang ?? null, gelombang: formatGelombang(gelDari(s)),
    no_ujian: s.no_ujian ?? null, no_bangku: s.no_bangku ?? null,
  }));
  const ruangOpt = (ruangR.data ?? []).map((r: any) => ({ id: r.id, kode_ruang: r.kode_ruang }));

  return (
    <div>
      <PageHeader title="Data siswa" desc="Kelola peserta ujian, ruang, dan gelombangnya.">
        <TambahSiswaMenu />
      </PageHeader>
      <Flash sp={sp} />

      <section className="panel">
        <form method="get" className="toolbar">
          <label className="field" style={{ maxWidth: 260 }}>Cari
            <input name="q" placeholder="Nama, no. induk, RFID, atau no. ujian" defaultValue={sp.q ?? ''} />
          </label>
          <label className="field">Kelas
            <input name="kelas" defaultValue={sp.kelas ?? ''} />
          </label>
          <label className="field">Asrama
            <input name="asrama" defaultValue={sp.asrama ?? ''} />
          </label>
          <label className="field">Ruang
            <select name="ruang" defaultValue={sp.ruang ?? ''}>
              <option value="">Semua ruang</option>
              {(ruangR.data ?? []).map((r: any) => <option key={r.id} value={r.id}>{r.kode_ruang}</option>)}
            </select>
          </label>
          <label className="field">Gelombang
            <select name="gel" defaultValue={sp.gel ?? ''}>
              <option value="">Semua gelombang</option>
              {(gelR.data ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.nama_gelombang}</option>)}
            </select>
          </label>
          <button type="submit" className="btn"><Search size={16} />Cari</button>
          {adaFilter && <Link href="/siswa" className="btn"><RotateCcw size={16} />Reset</Link>}
        </form>
        <div className="panel-head" style={{ borderTop: 0 }}>
          <span className="muted">{count ?? 0} siswa{(count ?? 0) > 200 ? ', ditampilkan 200 pertama' : ''}</span>
        </div>
        <SiswaTable rows={baris} total={count ?? 0} filter={{ q: sp.q, kelas: sp.kelas, asrama: sp.asrama, ruang: sp.ruang, gel: sp.gel }} adaFilter={adaFilter} />
      </section>
      <SiswaModal rows={rowsEdit} ruang={ruangOpt} />
      <UploadExcelModal
        event="siswa-import" title="Upload data siswa dari Excel" tombolImport="Simpan siswa"
        pratinjau={pratinjauSiswa} impor={importSiswaExcel}
        kolom={[{ key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'asrama', label: 'Asrama' }, { key: 'kamar', label: 'Kamar' }, { key: 'kelas', label: 'Kelas' }, { key: 'rfid', label: 'RFID' }]}
        petunjuk={<>
          <p>Upload file ekspor dari aplikasi madrasah apa adanya. Kolom yang dipakai dibaca dari judul kolom: <b>NIS</b>, <b>Nama</b>, <b>Kelas Madrasah</b>, <b>Asrama</b>, <b>Ruangan Asrama</b> (kamar), dan <b>RFID</b>. Kolom lain diabaikan, dan tanda &quot;-&quot; dianggap kosong.</p>
          <p>No. induk yang sudah ada akan diperbarui; ruang ujian dan gelombangnya tidak berubah. RFID kosong tidak menghapus RFID yang sudah tersimpan. Belum punya file ekspor? <a href="/api/siswa/template" download>Unduh template</a>.</p>
        </>}
      />
      <UploadExcelModal
        event="ruang-import" title="Upload ruang & gelombang siswa" tombolImport="Simpan ruang & gelombang"
        pratinjau={pratinjauRuang} impor={importRuangExcel}
        kolom={[{ key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'kelas', label: 'Kelas' }, { key: 'kode_ruang', label: 'Ruang' }, { key: 'gelombang', label: 'Gelombang' }, { key: 'no_ujian', label: 'No. ujian' }, { key: 'no_bangku', label: 'No. bangku' }]}
        petunjuk={<>
          <p>File berisi kolom <b>No. Induk</b> (atau NIS), <b>Kode Ruang</b>, <b>Gelombang</b>, <b>No. Ujian</b>, dan <b>No. Bangku</b>. Setiap baris dicocokkan dengan No. Induk di data siswa; yang tidak ditemukan ditandai error.</p>
          <p>Gelombang lebih dari satu ditulis dengan &amp;, contoh <code>1&amp;3</code>. No. ujian tidak boleh sama dengan siswa lain (dipakai untuk barcode kartu ujian). Sel kosong = tidak diubah. Paling mudah: <a href="/api/siswa/template-ruang" download>unduh template</a> yang sudah berisi semua siswa, lalu isi empat kolom terakhir.</p>
        </>}
      />
    </div>
  );
}
