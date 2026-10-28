import Link from 'next/link';
import { Download, Eye } from 'lucide-react';
import { requireAkses } from '@/lib/auth';
import { lihatSemuaRuang } from '@/lib/akses';
import { loadSummary } from '@/lib/data';
import { fmtTanggal } from '@/lib/util';
import PageHeader from '@/components/PageHeader';

export default async function LaporanPage() {
  const me = await requireAkses('laporan');
  const admin = lihatSemuaRuang(me);
  const S = await loadSummary(admin ? null : me.ruang_id);
  const berjalan = S.gels.filter((g: any) => g.status === 'berlangsung');

  return (
    <div>
      <PageHeader title="Laporan" desc={`Rekap kehadiran ${fmtTanggal(S.today)}`}>
        {admin && (
          <a className="btn btn-primary" href={`/api/laporan?ruang=semua&tanggal=${S.today}`}>
            <Download size={17} />Unduh semua ruang (CSV)
          </a>
        )}
      </PageHeader>

      <div className="panel">
        <div className="panel-body filter-row">
          <span className="filter-label" style={{ width: 'auto' }}>Gelombang berjalan</span>
          {berjalan.length
            ? <div className="chips">{berjalan.map((g: any) => <span key={g.id} className="badge badge-green">{g.nama_gelombang}</span>)}</div>
            : <span className="muted">Tidak ada</span>}
        </div>
      </div>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ruang</th><th className="num">Siswa</th><th className="num">Hadir</th><th>Aksi</th></tr></thead>
            <tbody>
              {S.ruang.map((r: any) => {
                const ids = new Set(S.siswa.filter((s) => s.ruang_id === r.id).map((s) => s.id));
                const hadir = S.absensi.filter((a) => ids.has(a.siswa_id) && a.status_kehadiran === 'hadir').length;
                return (
                  <tr key={r.id}>
                    <td>{r.kode_ruang} – {r.nama_ruang}</td>
                    <td className="num">{ids.size}</td>
                    <td className="num">{hadir}</td>
                    <td>
                      <div className="actions">
                        <Link className="btn btn-sm" href={`/laporan/${r.id}`}><Eye size={15} />Detail</Link>
                        <a className="btn btn-sm" href={`/api/laporan?ruang=${r.id}&tanggal=${S.today}`}><Download size={15} />Unduh CSV</a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!S.ruang.length && <tr><td colSpan={4} className="empty">Belum ada ruang.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
