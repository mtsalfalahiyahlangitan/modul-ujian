import { Check, CircleAlert, Minus, Pencil, Trash2, UserPlus } from 'lucide-react';
import { daftarKelasSiswa, requireAdmin } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { AREA, LABEL_PERAN, SUB_PERSYARATAN, bacaAksesPersyaratan, type AksesPersyaratan, type Peran } from '@/lib/akses';
import { ringkasTingkat } from '@/lib/tingkat';
import Flash from '@/components/Flash';
import PageHeader from '@/components/PageHeader';
import OpenModal from '@/components/OpenModal';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { hapusAkun } from './actions';
import AkunModal, { type AkunRow } from './AkunModal';

const URUT: Record<Peran, number> = { super_admin: 0, staf: 1, petugas: 2 };
const BADGE: Record<Peran, string> = { super_admin: 'badge-green', staf: 'badge-amber', petugas: 'badge-gray' };

// "Dashboard (semua tingkat), Absen 10% (kelas 7, 8)" untuk ringkasan di tabel akun
function ringkasPersyaratan(a: AksesPersyaratan | null): string {
  if (!a) return 'semua sub menu, semua tingkat (belum diatur)';
  const bagian = SUB_PERSYARATAN.filter((x) => a[x.key] !== undefined).map((x) => `${x.label} (${a[x.key] === '*' ? 'semua tingkat' : `kelas ${(a[x.key] as number[]).join(', ')}`})`);
  return bagian.length ? bagian.join(', ') : 'belum ada sub menu';
}

export default async function PengaturanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = adminDb();
  const [me, usersR, ruangR, kelasSiswa] = await Promise.all([
    requireAdmin(),
    db.from('users').select('*'),
    db.from('ruang').select('id,kode_ruang').order('kode_ruang'),
    daftarKelasSiswa().catch(() => [] as string[]),
  ]);
  const infoTingkat = ringkasTingkat(kelasSiswa); // pilihan tingkat kelas di form = yang ada di data siswa

  if (usersR.error) {
    return (
      <div>
        <PageHeader title="Pengaturan" />
        <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{usersR.error.message}</span></div>
      </div>
    );
  }

  const ruang = (ruangR.data ?? []) as { id: number; kode_ruang: string }[];
  const kodeRuang = new Map(ruang.map((r) => [r.id, r.kode_ruang] as const));
  const users = ((usersR.data ?? []) as any[])
    .map((u) => ({ id: u.id as string, nama: u.nama as string, username: u.username as string, role: u.role as Peran, ruang_id: (u.ruang_id ?? null) as number | null, akses: (u.akses ?? []) as string[], aksesPersyaratan: bacaAksesPersyaratan(u.akses_persyaratan) }))
    .sort((a, b) => (URUT[a.role] ?? 9) - (URUT[b.role] ?? 9) || a.nama.localeCompare(b.nama, 'id', { numeric: true }));
  const adaPetugas = new Set(users.filter((u) => u.role === 'petugas').map((u) => u.ruang_id));
  const ruangBebas = ruang.filter((r) => !adaPetugas.has(r.id));
  const rows: AkunRow[] = users.map((u) => ({ id: u.id, nama: u.nama, username: u.username, role: u.role, akses: u.akses, aksesPersyaratan: u.aksesPersyaratan }));
  const label = new Map<string, string>(AREA.map((a) => [a.key, a.label] as const));

  return (
    <div>
      <PageHeader title="Pengaturan" desc="Kelola akun yang bisa masuk ke aplikasi dan batasi menu yang boleh dibuka tiap akun. Perubahan hak akses langsung berlaku pada akses berikutnya.">
        <OpenModal name="akun" className="btn btn-primary"><UserPlus size={16} />Tambah akun</OpenModal>
      </PageHeader>
      <Flash sp={sp} />

      <section className="panel">
        <div className="panel-head"><h2>Akun login</h2><span className="muted">{users.length} akun</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nama</th><th>Username</th><th>Peran</th><th>Akses menu</th><th>Aksi</th></tr></thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id}>
                  <td>{u.nama}{u.id === me.id && <span className="badge badge-gray" style={{ marginLeft: 8 }}>Anda</span>}</td>
                  <td className="nowrap">{u.username}</td>
                  <td><span className={`badge ${BADGE[u.role] ?? 'badge-gray'}`}>{LABEL_PERAN[u.role] ?? u.role}</span></td>
                  <td>
                    {u.role === 'super_admin' && <span className="muted">Semua menu dan Pengaturan</span>}
                    {u.role === 'petugas' && <span className="muted">Absensi dan Laporan ruang {u.ruang_id ? kodeRuang.get(u.ruang_id) ?? '-' : '-'}</span>}
                    {u.role === 'staf' && (u.akses.length
                      ? <>
                          <div className="chips">{u.akses.map((k) => <span key={k} className="badge badge-gray">{label.get(k) ?? k}</span>)}</div>
                          {u.akses.includes('persyaratan') && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Persyaratan ujian: {ringkasPersyaratan(u.aksesPersyaratan)}</div>}
                        </>
                      : <span className="badge badge-red">Belum ada akses</span>)}
                  </td>
                  <td>
                    <div className="actions">
                      <OpenModal name="akun" id={i + 1} className="btn btn-sm"><Pencil size={14} />Edit</OpenModal>
                      {u.id !== me.id && (
                        <form action={hapusAkun} className="inline-form">
                          <input type="hidden" name="id" value={u.id} />
                          <ConfirmSubmit judul="Hapus akun" tombol="Hapus" message={`Hapus akun ${u.username} (${u.nama})?\n\nAkun ini tidak bisa masuk lagi. Tindakan ini tidak bisa dibatalkan.`}><Trash2 size={14} />Hapus</ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td colSpan={5} className="empty">Belum ada akun.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Hak akses per peran</h2></div>
        <div className="table-wrap">
          <table className="matriks">
            <thead><tr><th>Menu</th><th>Administrator</th><th>Staf</th><th>Petugas ruang</th></tr></thead>
            <tbody>
              {AREA.map((a) => (
                <tr key={a.key}>
                  <td><b>{a.label}</b><div className="muted" style={{ fontSize: 12 }}>{a.desc}</div></td>
                  <td><Check size={16} aria-label="Boleh" /></td>
                  <td><span className="muted">sesuai pilihan</span></td>
                  <td>{a.key === 'absen' || a.key === 'laporan' ? <span className="ya"><Check size={16} aria-label="Boleh" /> <small>ruangnya saja</small></span> : <Minus size={16} className="tidak" aria-label="Tidak boleh" />}</td>
                </tr>
              ))}
              <tr>
                <td><b>Pengaturan</b><div className="muted" style={{ fontSize: 12 }}>Kelola akun dan hak akses</div></td>
                <td><Check size={16} aria-label="Boleh" /></td>
                <td><Minus size={16} className="tidak" aria-label="Tidak boleh" /></td>
                <td><Minus size={16} className="tidak" aria-label="Tidak boleh" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="panel-body"><p className="muted">Pengaturan hanya untuk Administrator karena yang bisa mengelola akun bisa memberi dirinya akses penuh. Staf dengan akses Absensi atau Laporan melihat semua ruang, sedangkan petugas ruang hanya ruangnya sendiri. Untuk staf, menu Persyaratan ujian bisa dibatasi lagi per sub menu dan per tingkat kelas siswa (atur di Edit akun).</p></div>
      </section>

      <AkunModal rows={rows} ruangBebas={ruangBebas} infoTingkat={infoTingkat} />
    </div>
  );
}
