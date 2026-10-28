import { headers } from 'next/headers';
import { CircleAlert, Link2, Pencil, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { fetchAll } from '@/lib/util';
import { bandingKelas } from '@/lib/persyaratan-cetak';
import { kodeAkses } from '@/lib/wali';
import Flash from '@/components/Flash';
import PageHeader from '@/components/PageHeader';
import OpenModal from '@/components/OpenModal';
import ConfirmSubmit from '@/components/ConfirmSubmit';
import { hapusWali } from './actions';
import SalinLink from './SalinLink';
import WaliModal, { type OpsiKelas, type WaliRow } from './WaliModal';

export default async function WaliKelasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = adminDb();
  const [, waliR, siswa, h] = await Promise.all([
    requireAkses('wali'),
    db.from('wali_kelas').select('id,nama,kelas').order('nama'),
    fetchAll((from, to) => db.from('siswa').select('kelas').order('id').range(from, to)),
    headers(),
  ]);

  if (waliR.error) {
    return (
      <div>
        <PageHeader title="Wali kelas" />
        <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>
          Tabel wali kelas belum ada. Jalankan <code>supabase/migration_wali_kelas.sql</code> di Supabase SQL Editor, lalu muat ulang halaman.
        </span></div>
      </div>
    );
  }

  const hitung = new Map<string, number>();
  siswa.forEach((s: any) => { const k = String(s.kelas ?? '').trim(); if (k) hitung.set(k, (hitung.get(k) ?? 0) + 1); });
  const opsi: OpsiKelas[] = [...hitung.entries()].map(([kelas, jumlah]) => ({ kelas, jumlah })).sort((a, b) => bandingKelas(a.kelas, b.kelas));
  const rows = (waliR.data ?? []) as WaliRow[];

  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const url = `${proto}://${host}/wali`;
  const adaKode = !!kodeAkses();

  return (
    <div>
      <PageHeader title="Wali kelas" desc="Daftar wali kelas dan kelas yang diampu. Wali kelas membuka link di bawah dari HP, memilih namanya, lalu melihat siswa di kelasnya beserta persyaratan yang menjaringnya.">
        <OpenModal name="wali" className="btn btn-primary"><Plus size={16} />Tambah wali kelas</OpenModal>
      </PageHeader>
      <Flash sp={sp} />

      <section className="panel">
        <div className="panel-head"><h2><Link2 size={16} />Link untuk wali kelas</h2></div>
        <div className="panel-body">
          <SalinLink url={url} />
          {adaKode
            ? <p className="alert alert-ok" style={{ marginTop: 12, marginBottom: 0 }}><ShieldCheck size={18} /><span>Kode akses aktif. Wali kelas diminta memasukkan kode sekali di tiap perangkat. Bagikan kode lewat jalur terpisah dari link.</span></p>
            : <p className="alert alert-warn" style={{ marginTop: 12, marginBottom: 0 }}><ShieldAlert size={18} /><span>Halaman ini terbuka tanpa login dan tanpa kode: siapa pun yang memegang link bisa melihat nama dan data persyaratan siswa. Untuk menambah pengaman, isi <code>WALI_KODE_AKSES</code> di environment aplikasi.</span></p>}
        </div>
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nama wali kelas</th><th>Kelas</th><th className="num">Siswa</th><th>Aksi</th></tr></thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td>{w.nama}</td>
                  <td><div className="chips">{w.kelas.slice().sort(bandingKelas).map((k) => <span key={k} className="badge badge-gray">{k}</span>)}</div></td>
                  <td className="num">{w.kelas.reduce((n, k) => n + (hitung.get(k) ?? 0), 0)}</td>
                  <td>
                    <div className="actions">
                      <OpenModal name="wali" id={w.id} className="btn btn-sm"><Pencil size={14} />Edit</OpenModal>
                      <form action={hapusWali} className="inline-form">
                        <input type="hidden" name="id" value={w.id} />
                        <ConfirmSubmit judul="Hapus wali kelas" tombol="Hapus" message={`Hapus ${w.nama} dari daftar wali kelas?`}><Trash2 size={14} />Hapus</ConfirmSubmit>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4} className="empty">Belum ada wali kelas. Klik Tambah wali kelas untuk membuat yang pertama.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <WaliModal rows={rows} opsi={opsi} />
    </div>
  );
}
