import Link from 'next/link';
import { ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, Clock, Download, Printer, RotateCcw, Search, Upload, UserCheck, UserX, Users } from 'lucide-react';
import { batasiKelas, requireAksesSub } from '@/lib/auth';
import { batasSub } from '@/lib/akses';
import { ringkasanJenis } from '@/lib/persyaratan-ringkasan';
import { adminDb } from '@/lib/supabase/admin';
import { filterSiswa } from '@/lib/siswa-filter';
import { KODE_ABSEN_10, KODE_ABSEN_SEMEN, KODE_ADMINISTRASI, KODE_BISA_UPLOAD, KODE_SYAHRIYAH, KODE_TAFTISY, KODE_TASMI, KODE_TATHBIQ, CFG_JUMLAH, PER_HALAMAN, singkatJenis, type BarisPersyaratan, type JenisPersyaratan, type Terjaring } from '@/lib/persyaratan';
import { TZ } from '@/lib/util';
import { JUDUL_CETAK_DEFAULT } from '@/lib/persyaratan-cetak';
import PageHeader from '@/components/PageHeader';
import { JenisLegend, JenisPill } from '@/components/JenisPill';
import OpenModal from '@/components/OpenModal';
import DetailModal from './DetailModal';
import TargetJumlah from './TargetJumlah';
import HapusData from './HapusData';
import UploadExcelModal from '../siswa/UploadExcelModal';
import { importAdministrasi, pratinjauAdministrasi, importAbsen10, importAbsenSemen, importTaftisy, importTasmi, importSyahriyah, importTathbiq, pratinjauAbsen10, pratinjauAbsenSemen, pratinjauTaftisy, pratinjauSyahriyah, pratinjauTasmi, pratinjauTathbiq } from './actions';

const tglPendek = (v: string) => new Date(v).toLocaleDateString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });

export default async function PersyaratanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = adminDb();
  // kelas = batas kelas akun ini di Dashboard (null = semua); semuaTingkat = boleh upload / hapus data / ubah target
  const { me, kelas, semuaTingkat } = await requireAksesSub('dashboard');
  const batas = batasSub(me, 'dashboard');

  // "tampil": semua | terjaring (salah satu jenis) | belum (terjaring, belum lengkap) | bersih (tidak terjaring sama sekali) | j<id> (terjaring di jenis itu)
  const tampil = sp.tampil ?? '';
  const jenisFilter = /^j\d+$/.test(tampil) ? Number(tampil.slice(1)) : null;
  const hal = Math.max(1, Math.floor(Number(sp.hal)) || 1);

  // pt = semua penjaringan siswa (untuk ditampilkan); f = relasi khusus penyaring (!inner = hanya yang punya)
  let sel = '*, ruang(kode_ruang), pt:persyaratan_terjaring(jenis_id,alasan,detail,lengkap)';
  if (jenisFilter || tampil === 'terjaring' || tampil === 'belum') sel += ', f:persyaratan_terjaring!inner(jenis_id)';
  let q = db.from('siswa').select(sel, { count: 'exact' });
  q = batasiKelas(filterSiswa(q, sp), kelas);
  if (jenisFilter) q = q.eq('f.jenis_id', jenisFilter);
  else if (tampil === 'belum') q = q.eq('f.lengkap', false);
  else if (tampil === 'bersih') q = q.is('pt', null);

  const [jenisR, ruangR, ringkasData, totalR, terjaringR, belumR, listR] = await Promise.all([
    db.from('persyaratan_jenis').select('*').order('urutan').order('id'),
    db.from('ruang').select('id,kode_ruang').order('kode_ruang'),
    ringkasanJenis(db, kelas),
    batasiKelas(db.from('siswa').select('id', { count: 'exact', head: true }), kelas),
    batasiKelas(db.from('siswa').select('id, f:persyaratan_terjaring!inner(id)', { count: 'exact', head: true }), kelas),
    batasiKelas(db.from('siswa').select('id, f:persyaratan_terjaring!inner(id)', { count: 'exact', head: true }).eq('f.lengkap', false), kelas),
    q.order('nama').range((hal - 1) * PER_HALAMAN, hal * PER_HALAMAN - 1),
  ]);

  if (jenisR.error) {
    return (
      <div>
        <PageHeader title="Persyaratan ujian" />
        <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>
          Tabel persyaratan belum ada. Jalankan <code>supabase/migration_persyaratan.sql</code> di Supabase SQL Editor, lalu muat ulang halaman.
        </span></div>
      </div>
    );
  }

  const jenis = (jenisR.data ?? []) as JenisPersyaratan[];
  const jenisAdaData = jenis.filter((j) => j.data_terakhir).length;
  const jumlahPerJenis = new Map<number, number>(ringkasData.map((r) => [r.jenis_id, r.jumlah] as [number, number]));
  const lengkapPerJenis = new Map<number, number>(ringkasData.map((r) => [r.jenis_id, r.lengkap ?? 0] as [number, number]));
  const jenisById = new Map<number, JenisPersyaratan>(jenis.map((j) => [j.id, j] as [number, JenisPersyaratan]));
  const legendJenis = jenis.map((j) => ({ kode: j.kode, singkatan: singkatJenis(j.kode, j.nama), nama: j.nama }));
  const totalSiswa = totalR.count ?? 0;
  const siswaTerjaring = terjaringR.count ?? 0;
  const siswaBelumLengkap = belumR.count ?? 0;
  const total = listR.count ?? 0;
  const jumlahHal = Math.max(1, Math.ceil(total / PER_HALAMAN));

  const baris: BarisPersyaratan[] = ((listR.data ?? []) as any[]).map((s) => ({
    id: s.id, no_induk: s.no_induk, nama: s.nama, kelas: s.kelas, asrama: s.asrama, kamar: s.kamar ?? null,
    ruang: s.ruang?.kode_ruang ?? null,
    terjaring: ((s.pt ?? []) as Terjaring[]).slice().sort((a, b) => (jenis.findIndex((j) => j.id === a.jenis_id)) - (jenis.findIndex((j) => j.id === b.jenis_id))),
  }));

  const adaFilter = !!(sp.q || sp.kelas || sp.asrama || sp.ruang || tampil);
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    Object.entries({ ...sp, ...p }).forEach(([k, v]) => v && u.set(k, v));
    const s = u.toString();
    return s ? `/persyaratan?${s}` : '/persyaratan';
  };

  const aksiJenis = (j: JenisPersyaratan, n: number) => (
    <div className="actions">
      {semuaTingkat && CFG_JUMLAH[j.kode] && <TargetJumlah kode={j.kode} satuan={CFG_JUMLAH[j.kode].satuan} awal={j.target_minimal ?? null} adaData={!!j.data_terakhir} />}
      {semuaTingkat && (KODE_BISA_UPLOAD.has(j.kode)
        ? <OpenModal name={`upload-${j.kode}`} className="btn btn-sm"><Upload size={14} />Upload</OpenModal>
        : <span className="muted" style={{ fontSize: 13 }}>Upload belum tersedia</span>)}
      {n > 0 && <Link href={href({ tampil: `j${j.id}`, hal: undefined })} className="btn btn-sm">Lihat siswa</Link>}
      {semuaTingkat && (j.data_terakhir || n > 0) && <HapusData kode={j.kode} nama={j.nama} jumlah={n} />}
    </div>
  );
  const statusSiswa = (s: BarisPersyaratan) => s.terjaring.length > 0
    ? <div className="chips">{s.terjaring.map((t) => {
        const j = jenisById.get(t.jenis_id);
        return <JenisPill key={t.jenis_id} kode={j?.kode ?? ''} singkatan={j ? singkatJenis(j.kode, j.nama) : '?'} lengkap={t.lengkap} title={`${j?.nama ?? '?'}: ${t.lengkap ? 'sudah lengkap' : 'belum lengkap'}`} />;
      })}</div>
    : jenisAdaData > 0 ? <span className="badge badge-green">Tidak terjaring</span> : <span className="muted">-</span>;
  const pesanKosong = adaFilter ? 'Tidak ada siswa yang cocok dengan filter.' : 'Belum ada data siswa.';

  return (
    <div>
      <PageHeader title="Dashboard persyaratan ujian" desc={`Siswa yang terjaring pada penjaringan persyaratan ujian, beserta rincian per persyaratan.${Array.isArray(batas) ? ` Akun Anda dibatasi untuk kelas tingkat ${batas.join(', ')}; upload, hapus data, dan target minimal hanya untuk akun semua tingkat.` : ''}`} />

      <div className="stats">
        <div className="stat"><div><div className="lbl">Total siswa</div><div className="val">{totalSiswa}</div></div><Users size={18} /></div>
        <div className="stat"><div><div className="lbl">Terjaring</div><div className="val">{siswaTerjaring}</div><div className="sub">minimal di satu persyaratan</div></div><UserX size={18} /></div>
        <div className="stat"><div><div className="lbl">Belum lengkap</div><div className="val">{siswaBelumLengkap}</div><div className="sub">masih punya persyaratan terbuka</div></div><Clock size={18} /></div>
        <div className="stat"><div><div className="lbl">Tidak terjaring</div><div className="val">{totalSiswa - siswaTerjaring}</div><div className="sub">{jenisAdaData ? `dari ${jenisAdaData} persyaratan yang sudah diunggah` : 'belum ada data diunggah'}</div></div><UserCheck size={18} /></div>
        <div className="stat"><div><div className="lbl">Data diunggah</div><div className="val">{jenisAdaData}/{jenis.length}</div><div className="sub">jenis persyaratan</div></div><ClipboardCheck size={18} /></div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Ringkasan per persyaratan</h2></div>
        <div className="table-wrap tbl-desktop">
          <table>
            <thead><tr><th>Persyaratan</th><th>Data</th><th className="num">Siswa terjaring</th><th className="num">Sudah lengkap</th><th>Aksi</th></tr></thead>
            <tbody>
              {jenis.map((j) => {
                const n = jumlahPerJenis.get(j.id) ?? 0;
                return (
                  <tr key={j.id}>
                    <td>{j.nama}</td>
                    <td>{j.data_terakhir ? <span className="muted">Diperbarui {tglPendek(j.data_terakhir)}</span> : <span className="badge badge-gray">Belum diunggah</span>}</td>
                    <td className="num">{j.data_terakhir ? n : <span className="muted">-</span>}</td>
                    <td className="num">{j.data_terakhir ? lengkapPerJenis.get(j.id) ?? 0 : <span className="muted">-</span>}</td>
                    <td>{aksiJenis(j, n)}</td>
                  </tr>
                );
              })}
              {!jenis.length && <tr><td colSpan={5} className="empty">Belum ada jenis persyaratan.</td></tr>}
            </tbody>
          </table>
        </div>
        <ul className="kartu-list tbl-mobile">
          {jenis.map((j) => {
            const n = jumlahPerJenis.get(j.id) ?? 0;
            return (
              <li key={j.id} className="kartu">
                <div className="kartu-atas">
                  <span className="kartu-nama">{j.nama}</span>
                  {j.data_terakhir ? <span className="muted kartu-kecil">Diperbarui {tglPendek(j.data_terakhir)}</span> : <span className="badge badge-gray">Belum diunggah</span>}
                </div>
                {j.data_terakhir && <div className="kartu-meta"><span>Terjaring <b>{n}</b></span><span>Sudah lengkap <b>{lengkapPerJenis.get(j.id) ?? 0}</b></span></div>}
                {aksiJenis(j, n)}
              </li>
            );
          })}
          {!jenis.length && <li className="empty">Belum ada jenis persyaratan.</li>}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-head"><h2><Printer size={16} />Cetak / unduh data</h2></div>
        <form method="get" action="/cetak/persyaratan" target="_blank" className="toolbar">
          <input type="hidden" name="auto" value="1" />
          <label className="field field-cari">Judul
            <input name="judul" defaultValue={JUDUL_CETAK_DEFAULT} maxLength={150} />
          </label>
          <label className="field">Tampilkan
            <select name="status" defaultValue="terjaring">
              <option value="semua">Semua (terjaring atau tidak)</option>
              <option value="terjaring">Terjaring</option>
              <option value="lengkap">Lengkap (semua persyaratan sudah lengkap)</option>
            </select>
          </label>
          <label className="field">Kelas
            <input name="kelas" placeholder="Semua kelas" defaultValue={sp.kelas ?? ''} />
          </label>
          <label className="field">Asrama
            <input name="asrama" placeholder="Semua asrama" defaultValue={sp.asrama ?? ''} />
          </label>
          <label className="field">Maks. halaman
            <input type="number" name="maks" min={1} max={999} defaultValue={16} placeholder="Tanpa batas" />
          </label>
          <button type="submit" className="btn btn-primary"><Printer size={16} />Cetak / PDF</button>
          <button type="submit" formAction="/api/persyaratan/unduh" formTarget="_self" className="btn"><Download size={16} />Unduh Excel</button>
        </form>
        <p className="muted" style={{ padding: '0 16px 14px', fontSize: 13 }}>Kertas F4. Bila <b>Maks. halaman</b> diisi (mis. 16 lembar untuk mading), ukuran huruf dan tinggi baris menyesuaikan otomatis agar seluruh data muat; kosongkan untuk tanpa batas.</p>
      </section>

      <section className="panel">
        <form method="get" className="toolbar">
          <label className="field field-cari">Cari
            <input name="q" placeholder="Nama, no. induk, atau RFID" defaultValue={sp.q ?? ''} />
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
          <label className="field">Tampilkan
            <select name="tampil" defaultValue={tampil}>
              <option value="">Semua siswa</option>
              <option value="terjaring">Terjaring (semua persyaratan)</option>
              <option value="belum">Terjaring, belum lengkap</option>
              <option value="bersih">Tidak terjaring</option>
              <optgroup label="Terjaring di">
                {jenis.map((j) => <option key={j.id} value={`j${j.id}`}>{j.nama}</option>)}
              </optgroup>
            </select>
          </label>
          <button type="submit" className="btn"><Search size={16} />Cari</button>
          {adaFilter && <Link href="/persyaratan" className="btn"><RotateCcw size={16} />Reset</Link>}
        </form>
        <div className="panel-head" style={{ borderTop: 0 }}>
          <span className="muted">{total} siswa{jumlahHal > 1 ? `, halaman ${hal} dari ${jumlahHal}` : ''}</span>
          {tampil === 'bersih' && jenisAdaData < jenis.length && (
            <span className="muted">Termasuk siswa yang persyaratannya belum diunggah.</span>
          )}
        </div>

        {legendJenis.length > 0 && (
          <div className="legend-bar">
            <span className="legend-judul">Keterangan</span>
            <JenisLegend jenis={legendJenis} />
            <span className="legend-catatan">Pill terisi = belum lengkap. Pill dengan tanda centang = sudah lengkap.</span>
          </div>
        )}
        {listR.error && <div className="alert alert-error" role="alert" style={{ margin: 16 }}><CircleAlert size={18} /><span>{/lengkap/i.test(listR.error.message) ? <>Database belum diperbarui. Jalankan ulang <code>supabase/migration_persyaratan.sql</code> di Supabase SQL Editor (aman diulang), lalu muat ulang halaman.</> : listR.error.message}</span></div>}
        <div className="table-wrap tbl-desktop">
          <table>
            <thead><tr><th>No. induk</th><th>Nama</th><th>Kelas</th><th>Asrama</th><th>Ruang</th><th>Terjaring di</th><th>Aksi</th></tr></thead>
            <tbody>
              {baris.map((s) => (
                <tr key={s.id}>
                  <td>{s.no_induk}</td><td>{s.nama}</td><td>{s.kelas}</td><td>{s.asrama}</td>
                  <td>{s.ruang ?? <span className="muted">-</span>}</td>
                  <td>{statusSiswa(s)}</td>
                  <td><OpenModal name="persyaratan" id={s.id} className="btn btn-sm"><ClipboardCheck size={14} />Detail</OpenModal></td>
                </tr>
              ))}
              {!baris.length && <tr><td colSpan={7} className="empty">{pesanKosong}</td></tr>}
            </tbody>
          </table>
        </div>
        <ul className="kartu-list tbl-mobile">
          {baris.map((s) => (
            <li key={s.id} className="kartu">
              <div className="kartu-atas">
                <span className="kartu-nama">{s.nama}</span>
                <OpenModal name="persyaratan" id={s.id} className="btn btn-sm"><ClipboardCheck size={14} />Detail</OpenModal>
              </div>
              <div className="kartu-meta"><span>{s.no_induk}</span><span>Kelas {s.kelas}</span><span>{s.asrama}</span>{s.ruang && <span>Ruang {s.ruang}</span>}</div>
              {statusSiswa(s)}
            </li>
          ))}
          {!baris.length && <li className="empty">{pesanKosong}</li>}
        </ul>
        {jumlahHal > 1 && (
          <div className="panel-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            {hal > 1 ? <Link className="btn btn-sm" href={href({ hal: String(hal - 1) })}><ChevronLeft size={14} />Sebelumnya</Link> : <span />}
            <span className="muted">Halaman {hal} dari {jumlahHal}</span>
            {hal < jumlahHal ? <Link className="btn btn-sm" href={href({ hal: String(hal + 1) })}>Berikutnya<ChevronRight size={14} /></Link> : <span />}
          </div>
        )}
      </section>
      <DetailModal rows={baris} jenis={jenis} />
      {semuaTingkat && (
        <>
        <UploadExcelModal
          event={`upload-${KODE_ABSEN_10}`} title="Upload siswa terjaring Absen 10%" tombolImport="Simpan daftar terjaring"
          pratinjau={pratinjauAbsen10} impor={importAbsen10}
          kolom={[{ key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'kelas', label: 'Kelas' }, { key: 'asrama', label: 'Asrama' }, { key: 'persen', label: 'Alpha' }]}
          petunjuk={<>
            <p>File berisi kolom <b>INDUK</b> (No. Induk / NIS) dan <b>JUMLAH %</b> (persentase alpha). Kolom NO, NAMA, ASRAMA, dan KELAS boleh ada tetapi tidak dipakai; siswa dicocokkan dengan <b>No. Induk</b> di data siswa. Nilai 0,81 atau 81% sama-sama dibaca 81%.</p>
            <p>File ini dianggap <b>daftar lengkap</b> siswa terjaring. Siswa yang sudah ada di daftar dan masih ada di file tetap memakai status lengkap-nya. Siswa yang tidak ada di file <b>dihapus dari daftar</b> (jumlahnya tampil di ringkasan sebelum disimpan).</p>
          </>}
        />
        <UploadExcelModal
          event={`upload-${KODE_ABSEN_SEMEN}`} title="Upload siswa terjaring Absen Semen" tombolImport="Simpan daftar terjaring"
          pratinjau={pratinjauAbsenSemen} impor={importAbsenSemen}
          kolom={[{ key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'kelas', label: 'Kelas' }, { key: 'asrama', label: 'Asrama' }, { key: 'sakit', label: 'S' }, { key: 'izin', label: 'I' }, { key: 'alpha', label: 'A' }]}
          petunjuk={<>
            <p>File berisi kolom <b>INDUK</b> (No. Induk / NIS), serta <b>S</b> (sakit), <b>I</b> (izin), dan <b>A</b> (alpha) berupa jumlah hari. Sel kosong dibaca 0. Kolom NAMA, ASRAMA, dan KELAS boleh ada tetapi tidak dipakai; siswa dicocokkan dengan <b>No. Induk</b> di data siswa.</p>
            <p>File ini dianggap <b>daftar lengkap</b> siswa terjaring. Siswa yang sudah ada di daftar dan masih ada di file tetap memakai status lengkap-nya. Siswa yang tidak ada di file <b>dihapus dari daftar</b> (jumlahnya tampil di ringkasan sebelum disimpan).</p>
          </>}
        />
        <UploadExcelModal
          event={`upload-${KODE_TASMI}`} title="Upload siswa terjaring Tasmi'" tombolImport="Simpan daftar terjaring"
          pratinjau={pratinjauTasmi} impor={importTasmi}
          kolom={[{ key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'kelas', label: 'Kelas' }, { key: 'asrama', label: 'Asrama' }]}
          petunjuk={<>
            <p>File cukup berisi kolom <b>INDUK</b> (No. Induk / NIS). Kolom NAMA, ASRAMA, dan KELAS boleh ada tetapi tidak dipakai; siswa dicocokkan dengan <b>No. Induk</b> di data siswa.</p>
            <p>File ini dianggap <b>daftar lengkap</b> siswa terjaring. Siswa yang sudah ada di daftar dan masih ada di file tetap memakai status lengkap-nya. Siswa yang tidak ada di file <b>dihapus dari daftar</b> (jumlahnya tampil di ringkasan sebelum disimpan).</p>
          </>}
        />
        <UploadExcelModal
          event={`upload-${KODE_TAFTISY}`} title="Upload data Taftisy" tombolImport="Simpan data Taftisy"
          pratinjau={pratinjauTaftisy} impor={importTaftisy}
          kolom={[{ key: 'sheet', label: 'Tingkat' }, { key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'kelas', label: 'Kelas' }, { key: 'belum', label: 'Pelajaran belum' }]}
          petunjuk={<>
            <p>Satu file boleh berisi beberapa sheet (satu sheet per tingkat). Tiap sheet berisi kolom <b>INDUK</b> (No. Induk / NIS), lalu kolom pelajaran setelah NAMA, ASRAMA, dan KELAS. Daftar pelajaran <b>mengikuti judul kolom di tiap sheet</b>, jadi boleh berbeda antar tingkat.</p>
            <p>Sel berisi <b>X</b> = pelajaran sudah lengkap, kosong = belum. Siswa yang semua pelajarannya sudah X tidak dimasukkan ke daftar terjaring. Siswa dicocokkan dengan <b>No. Induk</b> di data siswa.</p>
            <p>File ini dianggap <b>daftar lengkap</b>. Siswa yang tidak ada di file <b>dihapus dari daftar</b>. Ceklis yang sudah diubah pengampu tetap dipertahankan saat upload ulang.</p>
          </>}
        />
        <UploadExcelModal
          event={`upload-${KODE_TATHBIQ}`} title="Upload data Tathbiq" tombolImport="Simpan data Tathbiq"
          pratinjau={pratinjauTathbiq} impor={importTathbiq}
          kolom={[{ key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'kelas', label: 'Kelas' }, { key: 'asrama', label: 'Asrama' }, { key: 'jumlah', label: "Maqro'" }, { key: 'hasil', label: 'Hasil' }]}
          petunjuk={<>
            <p>File berisi kolom <b>INDUK</b> (No. Induk / NIS) dan <b>JUMLAH</b> (jumlah maqro' yang berhasil disetorkan). JUMLAH yang kosong dibaca <b>0</b>. Kolom NAMA, ASRAMA, dan KELAS boleh ada tetapi tidak dipakai; siswa dicocokkan dengan <b>No. Induk</b> di data siswa.</p>
            <p><b>Isi dulu target minimal maqro'</b> di baris Tathbiq. Siswa dengan jumlah <b>kurang dari target</b> menjadi terjaring; jumlah sama atau lebih berarti tidak terjaring. Bila target diubah kemudian, daftar terjaring dihitung ulang dari data yang sudah diunggah.</p>
            <p>File ini dianggap data lengkap semua siswa. Siswa yang tidak ada di file dihapus dari data Tathbiq. Siswa yang tetap terjaring tetap memakai status lengkap-nya.</p>
          </>}
        />
        <UploadExcelModal
          event={`upload-${KODE_SYAHRIYAH}`} title="Upload data Syahriyah" tombolImport="Simpan data Syahriyah"
          pratinjau={pratinjauSyahriyah} impor={importSyahriyah}
          kolom={[{ key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'kelas', label: 'Kelas' }, { key: 'asrama', label: 'Asrama' }, { key: 'jumlah', label: 'Bulan terbayar' }, { key: 'hasil', label: 'Hasil' }]}
          petunjuk={<>
            <p>File berisi kolom <b>INDUK</b> (No. Induk / NIS) dan <b>JUMLAH TERBAYAR</b> (jumlah bulan syahriyah yang sudah dibayar). Jumlah yang kosong dibaca <b>0</b>. Kolom NAMA, ASRAMA, dan KELAS boleh ada tetapi tidak dipakai; siswa dicocokkan dengan <b>No. Induk</b> di data siswa.</p>
            <p><b>Isi dulu target minimal bulan</b> di baris Syahriyah. Siswa dengan jumlah <b>kurang dari target</b> menjadi terjaring; jumlah sama atau lebih berarti tidak terjaring. Bila target diubah kemudian, daftar terjaring dihitung ulang dari data yang sudah diunggah.</p>
            <p>Siswa yang <b>tidak ada di file</b> tidak terjaring (data lamanya dihapus). Siswa yang tetap terjaring tetap memakai status lengkap-nya.</p>
          </>}
        />
        <UploadExcelModal
          event={`upload-${KODE_ADMINISTRASI}`} title="Upload data Administrasi" tombolImport="Simpan data Administrasi"
          pratinjau={pratinjauAdministrasi} impor={importAdministrasi}
          kolom={[{ key: 'no_induk', label: 'No. induk' }, { key: 'nama', label: 'Nama' }, { key: 'kelas', label: 'Kelas' }, { key: 'keterangan', label: 'Jenis / hutang' }, { key: 'nominal', label: 'Nominal' }]}
          petunjuk={<>
            <p>File satu sheet berisi kolom <b>INDUK</b> (No. Induk / NIS), <b>JENIS/HUTANG</b> (keterangan), dan <b>NOMINAL</b>. Kolom NAMA, ASRAMA, dan KELAS boleh ada tetapi tidak dipakai; siswa dicocokkan dengan <b>No. Induk</b> di data siswa.</p>
            <p>Satu No. Induk boleh muncul di <b>beberapa baris</b> dengan keterangan berbeda; tiap baris menjadi satu catatan dan semuanya tampil saat pengampu klik Lengkapi. Siswa yang hanya diisi <b>No. Induk</b> (jenis/hutang dan nominal kosong) <b>tetap terjaring</b>, misalnya untuk dipanggil ke kantor.</p>
            <p>File ini dianggap <b>daftar lengkap</b>. Siswa yang tidak ada di file <b>dihapus dari daftar</b>. Ceklis yang sudah diisi pengampu tetap dipertahankan saat upload ulang. Bila salah satu baris siswa error, semua baris siswa itu dilewati.</p>
          </>}
        />
        </>
      )}
    </div>
  );
}
