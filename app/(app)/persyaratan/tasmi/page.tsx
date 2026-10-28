import Link from 'next/link';
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Clock, RotateCcw, Search, Users } from 'lucide-react';
import { batasiKelas, requireAksesSub } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { filterSiswa } from '@/lib/siswa-filter';
import { KODE_TASMI, PER_HALAMAN } from '@/lib/persyaratan';
import { TZ } from '@/lib/util';
import PageHeader from '@/components/PageHeader';
import AksiLengkap from '../AksiLengkap';

const tgl = (v: string) => new Date(v).toLocaleDateString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });

// Menu pengampu Tasmi': daftar siswa terjaring (dari upload TU di Dashboard) dan verifikasi akhir "Lengkap".
export default async function TasmiPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = adminDb();
  const [{ kelas }, jenisR] = await Promise.all([requireAksesSub('tasmi'), db.from('persyaratan_jenis').select('id,nama,data_terakhir').eq('kode', KODE_TASMI).maybeSingle()]);

  const jenis = jenisR.data as { id: number; nama: string; data_terakhir: string | null } | null;
  if (jenisR.error || !jenis) {
    return (
      <div>
        <PageHeader title="Tasmi'" />
        <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>
          Data persyaratan belum ada. Jalankan <code>supabase/migration_persyaratan.sql</code> di Supabase SQL Editor, lalu muat ulang halaman.
        </span></div>
      </div>
    );
  }

  const status = sp.status === 'belum' || sp.status === 'lengkap' ? sp.status : '';
  const hal = Math.max(1, Math.floor(Number(sp.hal)) || 1);

  // f = baris penjaringan Absen 10% milik siswa (inner join: hanya siswa yang terjaring)
  let q = db.from('siswa').select('id,no_induk,nama,kelas,asrama,kamar, f:persyaratan_terjaring!inner(jenis_id,lengkap,lengkap_at)', { count: 'exact' });
  q = batasiKelas(filterSiswa(q, sp), kelas).eq('f.jenis_id', jenis.id);
  if (status) q = q.eq('f.lengkap', status === 'lengkap');

  const jumlah = (lengkap?: boolean) => {
    let c = batasiKelas(db.from('persyaratan_terjaring').select(kelas === null ? 'id' : 'id, s:siswa!inner(kelas)', { count: 'exact', head: true }).eq('jenis_id', jenis.id), kelas, 's.kelas');
    if (lengkap !== undefined) c = c.eq('lengkap', lengkap);
    return c;
  };
  const [listR, totalR, lengkapR] = await Promise.all([
    q.order('kelas').order('nama').range((hal - 1) * PER_HALAMAN, hal * PER_HALAMAN - 1),
    jumlah(), jumlah(true),
  ]);

  const total = totalR.count ?? 0;
  const lengkap = lengkapR.count ?? 0;
  const jumlahFilter = listR.count ?? 0;
  const jumlahHal = Math.max(1, Math.ceil(jumlahFilter / PER_HALAMAN));
  const adaFilter = !!(sp.q || sp.kelas || sp.asrama || status);
  const href = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    Object.entries({ ...sp, ...p }).forEach(([k, v]) => v && u.set(k, v));
    const s = u.toString();
    return s ? `/persyaratan/tasmi?${s}` : '/persyaratan/tasmi';
  };

  const baris = ((listR.data ?? []) as any[]).map((s) => {
    const f = (s.f ?? [])[0] ?? {};
    return { ...s, lengkap: !!f.lengkap, lengkap_at: (f.lengkap_at ?? null) as string | null };
  });

  const badgeStatus = (s: { lengkap: boolean; lengkap_at: string | null }) => s.lengkap
    ? <><span className="badge badge-green">Lengkap</span>{s.lengkap_at && <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>{tgl(s.lengkap_at)}</span>}</>
    : <span className="badge badge-amber">Belum lengkap</span>;
  const pesanKosong = adaFilter ? 'Tidak ada siswa yang cocok dengan filter.' : 'Belum ada data. Tata Usaha mengunggah daftar siswa terjaring lewat Dashboard persyaratan.';

  return (
    <div>
      <PageHeader title="Tasmi'" desc="Siswa yang terjaring pada persyaratan Tasmi'. Klik Lengkap setelah persyaratan siswa diverifikasi lengkap." />

      <div className="stats">
        <div className="stat"><div><div className="lbl">Siswa terjaring</div><div className="val">{total}</div>{jenis.data_terakhir && <div className="sub">data per {tgl(jenis.data_terakhir)}</div>}</div><Users size={18} /></div>
        <div className="stat"><div><div className="lbl">Belum lengkap</div><div className="val">{total - lengkap}</div></div><Clock size={18} /></div>
        <div className="stat"><div><div className="lbl">Sudah lengkap</div><div className="val">{lengkap}</div><div className="sub">{total ? `${Math.round((lengkap / total) * 100)}% dari yang terjaring` : '\u00A0'}</div></div><CircleCheck size={18} /></div>
      </div>

      <section className="panel">
        <form method="get" className="toolbar">
          <label className="field field-cari">Cari
            <input name="q" placeholder="Nama atau no. induk" defaultValue={sp.q ?? ''} />
          </label>
          <label className="field">Kelas
            <input name="kelas" defaultValue={sp.kelas ?? ''} />
          </label>
          <label className="field">Asrama
            <input name="asrama" defaultValue={sp.asrama ?? ''} />
          </label>
          <label className="field">Status
            <select name="status" defaultValue={status}>
              <option value="">Semua</option>
              <option value="belum">Belum lengkap</option>
              <option value="lengkap">Sudah lengkap</option>
            </select>
          </label>
          <button type="submit" className="btn"><Search size={16} />Cari</button>
          {adaFilter && <Link href="/persyaratan/tasmi" className="btn"><RotateCcw size={16} />Reset</Link>}
        </form>
        <div className="panel-head" style={{ borderTop: 0 }}>
          <span className="muted">{jumlahFilter} siswa{jumlahHal > 1 ? `, halaman ${hal} dari ${jumlahHal}` : ''}</span>
        </div>

        {listR.error && <div className="alert alert-error" role="alert" style={{ margin: 16 }}><CircleAlert size={18} /><span>{/lengkap/i.test(listR.error.message) ? <>Database belum diperbarui. Jalankan ulang <code>supabase/migration_persyaratan.sql</code> di Supabase SQL Editor (aman diulang), lalu muat ulang halaman.</> : listR.error.message}</span></div>}
        <div className="table-wrap tbl-desktop">
          <table>
            <thead><tr><th>No. induk</th><th>Nama</th><th>Kelas</th><th>Asrama</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {baris.map((s) => (
                <tr key={s.id}>
                  <td>{s.no_induk}</td><td>{s.nama}</td><td>{s.kelas}</td>
                  <td>{s.asrama}{s.kamar ? <span className="muted">, {s.kamar}</span> : null}</td>
                  <td>{badgeStatus(s)}</td>
                  <td><AksiLengkap kode={KODE_TASMI} siswaId={s.id} nama={s.nama} lengkap={s.lengkap} /></td>
                </tr>
              ))}
              {!baris.length && <tr><td colSpan={6} className="empty">{pesanKosong}</td></tr>}
            </tbody>
          </table>
        </div>
        <ul className="kartu-list tbl-mobile">
          {baris.map((s) => (
            <li key={s.id} className="kartu">
              <div className="kartu-atas">
                <span className="kartu-nama">{s.nama}</span>
              </div>
              <div className="kartu-meta"><span>{s.no_induk}</span><span>Kelas {s.kelas}</span><span>{s.asrama}{s.kamar ? `, ${s.kamar}` : ''}</span></div>
              <div className="kartu-bawah">
                <div>{badgeStatus(s)}</div>
                <AksiLengkap kode={KODE_TASMI} siswaId={s.id} nama={s.nama} lengkap={s.lengkap} />
              </div>
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
    </div>
  );
}
