'use server';
import { revalidatePath } from 'next/cache';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { fail, ok, gagal, sukses, num, str, fromInputDateTime, type FormState } from '@/lib/util';

export async function simpanGelombang(fd: FormData): Promise<FormState> {
  await requireAkses('gelombang');
  const id = num(fd.get('id'));
  const row = {
    urutan: num(fd.get('urutan')),
    nama_gelombang: str(fd.get('nama_gelombang')),
    durasi_ujian: num(fd.get('durasi_ujian')),
    durasi_jeda: num(fd.get('durasi_jeda')) ?? 0,
    batas_masuk_menit: num(fd.get('batas_masuk_menit')),      // kosong = sampai gelombang berakhir
    buka_pulang_menit: num(fd.get('buka_pulang_menit')) ?? 0, // menit sebelum berakhir
    waktu_mulai_rencana: fromInputDateTime(str(fd.get('waktu_mulai_rencana'))),
  };
  if (!row.urutan || !row.nama_gelombang || !row.durasi_ujian) return gagal('Urutan, nama, dan durasi ujian wajib diisi');
  const db = adminDb();
  const { error } = id ? await db.from('gelombang').update(row).eq('id', id) : await db.from('gelombang').insert(row);
  if (error) return gagal(error.code === '23505' ? 'Urutan atau nama gelombang sudah dipakai' : error.message);
  revalidatePath('/', 'layout');
  return sukses('Gelombang tersimpan');
}

export async function hapusGelombang(fd: FormData) {
  await requireAkses('gelombang');
  const { error } = await adminDb().from('gelombang').delete().eq('id', num(fd.get('id')));
  if (error) fail('/gelombang', error.message);
  ok('/gelombang', 'Gelombang dihapus');
}

// aksi: mulai | selesai | batal | reset
const PESAN: Record<string, string> = {
  mulai: 'Gelombang dimulai sekarang',
  selesai: 'Gelombang ditandai selesai',
  batal: 'Gelombang dibatalkan',
  reset: 'Gelombang dikembalikan mengikuti jadwal otomatis',
};
export async function ubahStatus(fd: FormData) {
  const me = await requireAkses('gelombang');
  const id = num(fd.get('id'));
  const aksi = str(fd.get('aksi'));
  if (!id || !(aksi in PESAN)) fail('/gelombang', 'Aksi tidak dikenali');
  const patch: any =
    aksi === 'mulai' ? { status: 'berlangsung', waktu_mulai_efektif: new Date().toISOString() }
    : aksi === 'selesai' ? { status: 'selesai' }
    : aksi === 'batal' ? { status: 'dibatalkan' }
    : { status: 'belum_mulai', waktu_mulai_efektif: null };
  const { data, error } = await adminDb().from('gelombang').update(patch).eq('id', id).select('id');
  if (error) fail('/gelombang', error.message);
  if (!data?.length) fail('/gelombang', 'Gelombang tidak ditemukan');
  await audit(me.id, `gelombang_${aksi}`, { gelombang_id: id });
  ok('/gelombang', PESAN[aksi]);
}
