import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Download, Filter } from 'lucide-react';
import { requireAkses, bolehAksesRuang } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { buildLaporan } from '@/lib/laporan';
import { fmtJam, tanggalHariIni } from '@/lib/util';
import PageHeader from '@/components/PageHeader';
import { StatusBadge } from '@/components/Badge';

export default async function DetailRuang({ params, searchParams }: {
  params: Promise<{ ruangId: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await requireAkses('laporan');
  const { ruangId } = await params;
  const sp = await searchParams;
  const rid = Number(ruangId);
  if (!bolehAksesRuang(me, rid)) redirect('/laporan');

  const tanggal = sp.tanggal || tanggalHariIni();
  const gelId = sp.gel ? Number(sp.gel) : null;
  const [{ data: gels }, { rows, ruang }] = await Promise.all([
    adminDb().from('gelombang').select('*').order('urutan'),
    buildLaporan({ ruangId: rid, gelId, tanggal }),
  ]);
  if (!ruang) notFound();

  return (
    <div>
      <PageHeader title={`${ruang.kode_ruang} – ${ruang.nama_ruang}`} desc="Detail kehadiran per siswa dan gelombang">
        <Link className="btn" href="/laporan"><ArrowLeft size={17} />Kembali</Link>
      </PageHeader>

      <section className="panel">
        <form method="get" className="toolbar">
          <label className="field">Gelombang
            <select name="gel" defaultValue={sp.gel ?? ''}>
              <option value="">Semua gelombang</option>
              {(gels ?? []).map((g: any) => <option key={g.id} value={g.id}>{g.nama_gelombang}</option>)}
            </select>
          </label>
          <label className="field">Tanggal
            <input type="date" name="tanggal" defaultValue={tanggal} />
          </label>
          <button type="submit" className="btn"><Filter size={16} />Tampilkan</button>
          <a className="btn" href={`/api/laporan?ruang=${rid}&tanggal=${tanggal}${gelId ? `&gel=${gelId}` : ''}`}><Download size={16} />Unduh CSV</a>
        </form>
        <div className="table-wrap">
          <table>
            <thead><tr><th>No. induk</th><th>Nama</th><th>Asrama</th><th>Kelas</th><th>Gelombang</th><th>Status</th><th>Datang</th><th>Pulang</th><th>Keterangan</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.siswa_id}-${r.gelombang_id ?? 'x'}`}>
                  <td>{r.no_induk}</td><td>{r.nama}</td><td>{r.asrama}</td><td>{r.kelas}</td><td className="nowrap">{r.gelombang}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="nowrap">{fmtJam(r.datang, true)}</td><td className="nowrap">{fmtJam(r.pulang, true)}</td>
                  <td>{r.keterangan ?? ''}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={9} className="empty">Tidak ada data untuk filter ini.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
