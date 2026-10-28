import Link from 'next/link';
import { ChevronLeft, ChevronRight, CircleAlert, ClipboardCheck, Clock, Repeat, RotateCcw, Search, Users, UserX } from 'lucide-react';
import { adminDb } from '@/lib/supabase/admin';
import { filterSiswa } from '@/lib/siswa-filter';
import { bandingKelas, bandingNama } from '@/lib/persyaratan-cetak';
import { singkatJenis, type BarisPersyaratan, type JenisPersyaratan, type Terjaring } from '@/lib/persyaratan';
import { fetchAll } from '@/lib/util';
import type { Wali } from '@/lib/wali';
import LogoMadrasah from '@/components/LogoMadrasah';
import OpenModal from '@/components/OpenModal';
import { JenisLegend, JenisPill } from '@/components/JenisPill';
import DetailModal from '../(app)/persyaratan/DetailModal';
import { gantiWali } from './actions';

const PER_HALAMAN = 50;

// Data siswa di kelas wali: hanya baca. Filter memakai query string (cari, tampil, kelas, hal).
export default async function DataWali({ wali, sp }: { wali: Wali; sp: Record<string, string | undefined> }) {
  const db = adminDb();
  const kelasWali = wali.kelas;
  const kelasAktif = sp.kelas && kelasWali.includes(sp.kelas) ? [sp.kelas] : kelasWali;
  const tampil = sp.tampil ?? '';
  const jenisFilter = /^j\d+$/.test(tampil) ? Number(tampil.slice(1)) : null;
  const hal = Math.max(1, Math.floor(Number(sp.hal)) || 1);

  const kepala = (
    <header className="wali-head">
      <LogoMadrasah size={40} />
      <div className="wali-judul"><small>Wali kelas</small><b>{wali.nama}</b></div>
      <form action={gantiWali}><button type="submit" className="btn btn-sm" title="Ganti wali kelas"><Repeat size={14} />Ganti</button></form>
    </header>
  );

  if (!kelasWali.length) {
    return (
      <>
        {kepala}
        <div className="alert alert-warn" role="alert"><CircleAlert size={18} /><span>Belum ada kelas yang diatur untuk Anda. Hubungi admin madrasah.</span></div>
      </>
    );
  }

  let sel = '*, ruang(kode_ruang), pt:persyaratan_terjaring(jenis_id,alasan,detail,lengkap)';
  if (jenisFilter || tampil === 'terjaring' || tampil === 'belum') sel += ', f:persyaratan_terjaring!inner(jenis_id)';

  const [jenisR, totalR, terjaringR, belumR, data] = await Promise.all([
    db.from('persyaratan_jenis').select('*').order('urutan').order('id'),
    db.from('siswa').select('id', { count: 'exact', head: true }).in('kelas', kelasWali),
    db.from('siswa').select('id, f:persyaratan_terjaring!inner(id)', { count: 'exact', head: true }).in('kelas', kelasWali),
    db.from('siswa').select('id, f:persyaratan_terjaring!inner(id)', { count: 'exact', head: true }).in('kelas', kelasWali).eq('f.lengkap', false),
    fetchAll((from, to) => {
      let q: any = filterSiswa(db.from('siswa').select(sel).in('kelas', kelasAktif), { q: sp.cari });
      if (jenisFilter) q = q.eq('f.jenis_id', jenisFilter);
      else if (tampil === 'belum') q = q.eq('f.lengkap', false);
      else if (tampil === 'bersih') q = q.is('pt', null);
      return q.order('id').range(from, to);
    }),
  ]);

  const jenis = (jenisR.data ?? []) as JenisPersyaratan[];
  const jenisById = new Map(jenis.map((j) => [j.id, j] as const));
  const jenisAdaData = jenis.filter((j) => j.data_terakhir).length;
  const urutJenis = (id: number) => jenis.findIndex((j) => j.id === id);
  const legend = jenis.map((j) => ({ kode: j.kode, singkatan: singkatJenis(j.kode, j.nama), nama: j.nama }));

  // Urut kelas dulu, lalu nama sesuai abjad
  const semua: BarisPersyaratan[] = (data as any[])
    .map((s) => ({
      id: s.id, no_induk: s.no_induk, nama: s.nama, kelas: s.kelas, asrama: s.asrama, kamar: s.kamar ?? null,
      ruang: s.ruang?.kode_ruang ?? null,
      terjaring: ((s.pt ?? []) as Terjaring[]).slice().sort((a, b) => urutJenis(a.jenis_id) - urutJenis(b.jenis_id)),
    }))
    .sort((a, b) => bandingKelas(a.kelas, b.kelas) || bandingNama(a.nama, b.nama));
  const total = semua.length;
  const jumlahHal = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const baris = semua.slice((hal - 1) * PER_HALAMAN, hal * PER_HALAMAN);

  const adaFilter = !!(sp.cari || tampil || sp.kelas);
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    Object.entries({ ...sp, ...p }).forEach(([k, v]) => v && u.set(k, v));
    const s = u.toString();
    return s ? `/wali?${s}` : '/wali';
  };

  const status = (s: BarisPersyaratan) => s.terjaring.length > 0
    ? <div className="chips">{s.terjaring.map((t) => {
        const j = jenisById.get(t.jenis_id);
        return <JenisPill key={t.jenis_id} kode={j?.kode ?? ''} singkatan={j ? singkatJenis(j.kode, j.nama) : '?'} lengkap={t.lengkap} title={`${j?.nama ?? '?'}: ${t.lengkap ? 'sudah lengkap' : 'belum lengkap'}`} />;
      })}</div>
    : jenisAdaData > 0 ? <span className="badge badge-green">Tidak terjaring</span> : <span className="muted">-</span>;

  return (
    <>
      {kepala}

      {kelasWali.length > 1 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <Link className="chip" href={href({ kelas: undefined, hal: undefined })} aria-current={!sp.kelas ? 'true' : undefined}>Semua kelas</Link>
          {kelasWali.slice().sort(bandingKelas).map((k) => (
            <Link key={k} className="chip" href={href({ kelas: k, hal: undefined })} aria-current={sp.kelas === k ? 'true' : undefined}>{k}</Link>
          ))}
        </div>
      )}

      <div className="wali-stats">
        <div className="wali-stat"><div className="lbl"><Users size={13} /> Siswa</div><div className="val">{totalR.count ?? 0}</div></div>
        <div className="wali-stat"><div className="lbl"><UserX size={13} /> Terjaring</div><div className="val">{terjaringR.count ?? 0}</div></div>
        <div className="wali-stat"><div className="lbl"><Clock size={13} /> Belum lengkap</div><div className="val">{belumR.count ?? 0}</div></div>
      </div>

      {legend.length > 0 && (
        <details className="wali-legend">
          <summary>Keterangan singkatan</summary>
          <JenisLegend jenis={legend} />
          <p className="muted">Pill terisi = belum lengkap. Pill dengan tanda centang = sudah lengkap.</p>
        </details>
      )}

      <section className="panel">
        <form method="get" action="/wali" className="wali-filter">
          {sp.kelas && <input type="hidden" name="kelas" value={sp.kelas} />}
          <label className="field">Cari siswa
            <input name="cari" placeholder="Nama atau no. induk" defaultValue={sp.cari ?? ''} autoComplete="off" />
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
          <div className="wali-aksi">
            <button type="submit" className="btn btn-primary"><Search size={16} />Cari</button>
            {adaFilter && <Link href="/wali" className="btn"><RotateCcw size={16} />Reset</Link>}
          </div>
        </form>
        <div className="panel-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
          <span className="muted">{total} siswa{jumlahHal > 1 ? `, halaman ${hal} dari ${jumlahHal}` : ''}</span>
        </div>

        {/* Desktop: daftar detail berbentuk tabel padat supaya banyak siswa muat dalam satu layar */}
        <div className="table-wrap tbl-desktop wali-tabel">
          <table>
            <thead><tr><th>No. induk</th><th>Nama</th><th>Kelas</th><th>Asrama</th><th>Terjaring di</th><th></th></tr></thead>
            <tbody>
              {baris.map((s) => (
                <tr key={s.id}>
                  <td className="nowrap">{s.no_induk}</td>
                  <td className="wali-td-nama">{s.nama}</td>
                  <td className="nowrap">{s.kelas}</td>
                  <td>{s.asrama}{s.kamar ? `, ${s.kamar}` : ''}</td>
                  <td>{status(s)}</td>
                  <td className="wali-td-aksi"><OpenModal name="persyaratan" id={s.id} className="btn btn-sm"><ClipboardCheck size={14} />Detail</OpenModal></td>
                </tr>
              ))}
              {!baris.length && <tr><td colSpan={6} className="empty">{adaFilter ? 'Tidak ada siswa yang cocok dengan filter.' : 'Belum ada data siswa di kelas Anda.'}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* HP: kartu per siswa */}
        <ul className="kartu-list tbl-mobile" style={{ borderTop: '1px solid var(--border)' }}>
          {baris.map((s) => (
            <li key={s.id} className="kartu wali-card">
              <div className="kartu-atas">
                <span className="kartu-nama">{s.nama}</span>
                <OpenModal name="persyaratan" id={s.id} className="btn btn-sm"><ClipboardCheck size={14} />Detail</OpenModal>
              </div>
              <div className="kartu-meta"><span>{s.no_induk}</span><span>Kelas {s.kelas}</span><span>{s.asrama}{s.kamar ? `, ${s.kamar}` : ''}</span></div>
              {status(s)}
            </li>
          ))}
          {!baris.length && <li className="empty">{adaFilter ? 'Tidak ada siswa yang cocok dengan filter.' : 'Belum ada data siswa di kelas Anda.'}</li>}
        </ul>

        {jumlahHal > 1 && (
          <div className="panel-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            {hal > 1 ? <Link className="btn btn-sm" href={href({ hal: String(hal - 1) })}><ChevronLeft size={14} />Sebelumnya</Link> : <span />}
            <span className="muted">{hal}/{jumlahHal}</span>
            {hal < jumlahHal ? <Link className="btn btn-sm" href={href({ hal: String(hal + 1) })}>Berikutnya<ChevronRight size={14} /></Link> : <span />}
          </div>
        )}
      </section>
      <DetailModal rows={baris} jenis={jenis} />
    </>
  );
}
