import { LogOut, UserCheck, UserX, Users } from 'lucide-react';
import { requireAkses } from '@/lib/auth';
import { loadSummary } from '@/lib/data';
import { fmtJam, fmtTanggal } from '@/lib/util';
import PageHeader from '@/components/PageHeader';
import { GelBadge } from '@/components/Badge';
import AutoRefresh from '@/components/AutoRefresh';

export default async function Dashboard() {
  // cek login dan pengambilan data berjalan bersamaan
  const [, S] = await Promise.all([requireAkses('dashboard'), loadSummary(null)]);
  const absBy = (pred: (a: any) => boolean) => S.absensi.filter(pred).length;

  return (
    <div>
      <PageHeader title="Dashboard" desc={fmtTanggal(S.today)} />
      <AutoRefresh />

      <div className="stats">
        <div className="stat"><div><div className="lbl">Total siswa</div><div className="val">{S.siswa.length}</div></div><Users size={18} /></div>
        <div className="stat"><div><div className="lbl">Hadir</div><div className="val">{absBy((a) => a.status_kehadiran === 'hadir')}</div><div className="sub">semua gelombang</div></div><UserCheck size={18} /></div>
        <div className="stat"><div><div className="lbl">Tidak hadir</div><div className="val">{absBy((a) => a.status_kehadiran === 'tidak_hadir')}</div><div className="sub">semua gelombang</div></div><UserX size={18} /></div>
        <div className="stat"><div><div className="lbl">Sudah pulang</div><div className="val">{absBy((a) => !!a.waktu_pulang)}</div><div className="sub">semua gelombang</div></div><LogOut size={18} /></div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Per gelombang</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Gelombang</th><th>Status</th><th>Jadwal</th><th className="num">Siswa</th><th className="num">Hadir</th><th className="num">Tidak hadir</th><th className="num">Pulang</th></tr></thead>
            <tbody>
              {S.gels.map((g: any) => {
                const j = S.jadwal[g.id];
                const a = S.absensi.filter((x) => x.gelombang_id === g.id);
                return (
                  <tr key={g.id}>
                    <td>{g.nama_gelombang}</td>
                    <td><GelBadge status={g.status} /></td>
                    <td className="nowrap">{fmtJam(j?.mulai)} – {fmtJam(j?.selesai)}</td>
                    <td className="num">{S.siswa.filter((s) => s.gelombang_ids.includes(g.id)).length}</td>
                    <td className="num">{a.filter((x) => x.status_kehadiran === 'hadir').length}</td>
                    <td className="num">{a.filter((x) => x.status_kehadiran === 'tidak_hadir').length}</td>
                    <td className="num">{a.filter((x) => x.waktu_pulang).length}</td>
                  </tr>
                );
              })}
              {!S.gels.length && <tr><td colSpan={7} className="empty">Belum ada gelombang.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Per ruang</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Ruang</th><th className="num">Siswa</th><th className="num">Hadir</th><th className="num">Pulang</th><th>Kehadiran</th></tr></thead>
            <tbody>
              {S.ruang.map((r: any) => {
                const peserta = S.siswa.filter((s) => s.ruang_id === r.id);
                const ids = new Set(peserta.map((s) => s.id));
                const slot = peserta.reduce((n, s) => n + s.gelombang_ids.length, 0); // siswa x gelombang
                const a = S.absensi.filter((x) => ids.has(x.siswa_id));
                const hadir = a.filter((x) => x.status_kehadiran === 'hadir').length;
                const persen = slot ? Math.min(100, Math.round((hadir / slot) * 100)) : 0;
                return (
                  <tr key={r.id}>
                    <td>{r.kode_ruang} – {r.nama_ruang}</td>
                    <td className="num">{ids.size}</td>
                    <td className="num">{hadir}</td>
                    <td className="num">{a.filter((x) => x.waktu_pulang).length}</td>
                    <td style={{ minWidth: 150 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="bar" style={{ flex: 1 }} role="img" aria-label={`${persen} persen`}><i style={{ width: `${persen}%` }} /></div>
                        <span className="muted num" style={{ minWidth: 36 }}>{persen}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!S.ruang.length && <tr><td colSpan={5} className="empty">Belum ada ruang.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
