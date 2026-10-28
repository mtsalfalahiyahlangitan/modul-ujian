import { CircleAlert, Clock, LogOut, UserCheck, UserX, Undo2, Users } from 'lucide-react';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { absenCtx } from '@/lib/absen-ctx';
import { batasMasuk, bukaPulang } from '@/lib/aturan';
import { fetchAll, fmtJam, fmtTanggal, statusSiswa, tanggalHariIni } from '@/lib/util';
import Flash from '@/components/Flash';
import Picker from '@/components/Picker';
import ScanBox from '@/components/ScanBox';
import PageHeader from '@/components/PageHeader';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { GelBadge, StatusBadge } from '@/components/Badge';
import { aksiSiswa, tandaiSemuaHadir, tandaiSemuaPulang } from './actions';

export default async function AbsenPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireAkses('absen');
  const sp = await searchParams;
  const ctx = await absenCtx(me, sp);
  const db = adminDb();
  const today = tanggalHariIni();

  // Satu baris = satu siswa x satu gelombang (siswa dgn gelombang 1&3 tampil 2 baris)
  let siswa: any[] = [];
  let absMap = new Map<string, any>();
  if (ctx.ruang) {
    const [data, abs] = await Promise.all([
      fetchAll((a, b) =>
        db.from('siswa').select('*, siswa_gelombang(gelombang_id)').eq('ruang_id', ctx.ruang.id).order('nama').order('id').range(a, b)),
      // hanya absensi siswa di ruang ini (bukan seluruh sekolah)
      fetchAll((a, b) =>
        db.from('absensi').select('*, siswa!inner(ruang_id)').eq('siswa.ruang_id', ctx.ruang.id).eq('tanggal_ujian', today).order('id').range(a, b)),
    ]);
    const urutan = new Map<number, number>(ctx.gelList.map((g: any) => [g.id, g.urutan]));
    siswa = data.flatMap((s: any) => {
      const ids: number[] = (s.siswa_gelombang ?? []).map((x: any) => x.gelombang_id);
      return (ids.length ? ids : [null])
        .filter((gid) => !ctx.gel || gid === ctx.gel.id)
        .map((gid) => ({ ...s, gelombang_id: gid }));
    }).sort((x: any, y: any) => (urutan.get(x.gelombang_id) ?? 999) - (urutan.get(y.gelombang_id) ?? 999) || x.nama.localeCompare(y.nama));
    absMap = new Map(abs.map((x) => [`${x.siswa_id}-${x.gelombang_id}`, x]));
  }
  const gelMap = new Map<number, any>(ctx.gelList.map((g: any) => [g.id, g]));
  const gelDipakai = [...new Set(siswa.map((s) => s.gelombang_id).filter(Boolean))].map((id) => gelMap.get(id as number)).filter(Boolean);
  const A = (s: any) => absMap.get(`${s.id}-${s.gelombang_id}`) ?? null;
  const hitung = (f: (a: any) => boolean) => siswa.filter((s) => f(A(s))).length;
  const jumlahSiswa = new Set(siswa.map((s) => s.id)).size;

  return (
    <div>
      <PageHeader title="Absensi ujian" desc={fmtTanggal(today)} />
      <Flash sp={sp} />
      {!ctx.isAdmin && !ctx.ruang && (
        <div className="alert alert-warn" role="alert">
          <CircleAlert size={18} /><span>Akun Anda belum ditugaskan ke ruang. Hubungi admin.</span>
        </div>
      )}
      <Picker ctx={ctx} />

      {ctx.ruang && (
        <>
          <div className="room-title">
            <h2>{ctx.ruang.kode_ruang}</h2><span className="muted">{ctx.ruang.nama_ruang}</span>
          </div>

          <ScanBox ruangId={ctx.ruang.id} />

          <div className="stats">
            <div className="stat"><div><div className="lbl">Siswa</div><div className="val">{jumlahSiswa}</div><div className="sub">{siswa.length} peserta per gelombang</div></div><Users size={18} /></div>
            <div className="stat"><div><div className="lbl">Belum absen</div><div className="val">{hitung((a) => !a)}</div></div><Clock size={18} /></div>
            <div className="stat"><div><div className="lbl">Sedang hadir</div><div className="val">{hitung((a) => a?.status_kehadiran === 'hadir' && !a.waktu_pulang)}</div></div><UserCheck size={18} /></div>
            <div className="stat"><div><div className="lbl">Sudah pulang</div><div className="val">{hitung((a) => !!a?.waktu_pulang)}</div></div><LogOut size={18} /></div>
            <div className="stat"><div><div className="lbl">Tidak hadir</div><div className="val">{hitung((a) => a?.status_kehadiran === 'tidak_hadir')}</div></div><UserX size={18} /></div>
          </div>

          {gelDipakai.length > 0 && (
            <section className="panel">
              <div className="panel-head"><h2>Jadwal gelombang</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Gelombang</th><th>Status</th><th>Jadwal</th><th>Tap masuk sampai</th><th>Tap pulang dibuka</th></tr></thead>
                  <tbody>
                    {gelDipakai.map((g: any) => {
                      const j = ctx.jadwal[g.id];
                      return (
                        <tr key={g.id}>
                          <td>{g.nama_gelombang}</td>
                          <td><GelBadge status={g.status} /></td>
                          <td className="nowrap">{fmtJam(j?.mulai)} – {fmtJam(j?.selesai)}</td>
                          <td>{fmtJam(batasMasuk(g, j))}</td>
                          <td>{fmtJam(bukaPulang(g, j))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {ctx.gel && (
            <section className="panel">
              <div className="panel-head">
                <h2>Aksi massal: {ctx.gel.nama_gelombang}</h2>
                <div className="actions">
                  <form action={tandaiSemuaHadir} className="inline-form">
                    <input type="hidden" name="ruang_id" value={ctx.ruang.id} />
                    <input type="hidden" name="gel_id" value={ctx.gel.id} />
                    <ConfirmSubmit className="btn btn-sm btn-primary" message="Tandai semua siswa yang belum diabsen sebagai HADIR?">
                      <UserCheck size={14} />Tandai semua hadir
                    </ConfirmSubmit>
                  </form>
                  <form action={tandaiSemuaPulang} className="inline-form">
                    <input type="hidden" name="ruang_id" value={ctx.ruang.id} />
                    <input type="hidden" name="gel_id" value={ctx.gel.id} />
                    <ConfirmSubmit className="btn btn-sm" message="Tandai semua siswa yang hadir & belum pulang sebagai PULANG?">
                      <LogOut size={14} />Tandai semua pulang
                    </ConfirmSubmit>
                  </form>
                </div>
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head"><h2>Daftar peserta</h2></div>
            <div className="table-wrap">
              <table className="rtable">
                <thead><tr><th>No. induk</th><th>Nama</th><th>Kelas</th><th>Gelombang</th><th>Status</th><th>Masuk</th><th>Pulang</th><th>Absen manual</th></tr></thead>
                <tbody>
                  {siswa.map((s) => {
                    const a = A(s);
                    const g = gelMap.get(s.gelombang_id);
                    const hadir = a?.status_kehadiran === 'hadir';
                    return (
                      <tr key={`${s.id}-${s.gelombang_id ?? 'x'}`}>
                        <td data-label="No. induk">{s.no_induk}</td>
                        <td data-label="Nama">{s.nama}</td>
                        <td data-label="Kelas">{s.kelas}</td>
                        <td data-label="Gelombang" className="nowrap">{g?.nama_gelombang ?? <span className="muted">-</span>}</td>
                        <td data-label="Status">
                          <div>
                            <StatusBadge status={statusSiswa(a, g?.status)} />
                            {a?.keterangan && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{a.keterangan}</div>}
                          </div>
                        </td>
                        <td data-label="Masuk" className="nowrap">{fmtJam(a?.waktu_datang, true)}</td>
                        <td data-label="Pulang" className="nowrap">{fmtJam(a?.waktu_pulang, true)}</td>
                        <td className="aksi-cell">
                          {s.gelombang_id ? (
                            <form action={aksiSiswa} className="inline-form">
                              <input type="hidden" name="ruang_id" value={ctx.ruang.id} />
                              <input type="hidden" name="gel_id" value={s.gelombang_id} />
                              <input type="hidden" name="gel" value={ctx.gel?.id ?? ''} />
                              <input type="hidden" name="siswa_id" value={s.id} />
                              {!hadir && <input name="keterangan" placeholder="Keterangan" aria-label={`Keterangan ${s.nama}`} defaultValue={a?.keterangan ?? ''} className="input-sm" />}
                              {!hadir && <button name="aksi" value="hadir" className="btn btn-sm btn-primary"><UserCheck size={14} />Hadir</button>}
                              {!a && <button name="aksi" value="tidak_hadir" className="btn btn-sm"><UserX size={14} />Tidak hadir</button>}
                              {hadir && !a.waktu_pulang && <button name="aksi" value="pulang" className="btn btn-sm"><LogOut size={14} />Pulang</button>}
                              {a && (!a.waktu_pulang || ctx.isAdmin) && <button name="aksi" value="batal" className="btn btn-sm btn-danger"><Undo2 size={14} />Batalkan</button>}
                            </form>
                          ) : <span className="muted">Belum punya gelombang</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {!siswa.length && <tr><td colSpan={8} className="empty">Belum ada siswa di ruang ini{ctx.gel ? ` untuk ${ctx.gel.nama_gelombang}` : ''}.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
