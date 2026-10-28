'use server';
import { revalidatePath } from 'next/cache';
import { bolehKelolaData, requireAkses, type Me } from '@/lib/auth';
import { batasSub, bisaSub, bolehSiswa } from '@/lib/akses';
import { JENIS_PERSYARATAN } from '@/lib/jenis-persyaratan';
import { audit } from '@/lib/audit';
import { adminDb } from '@/lib/supabase/admin';
import { bacaFile, bacaSemuaSheet, chunk } from '@/lib/siswa-import';
import { validasiAbsen10, validasiAbsenSemen, validasiDaftarNama, validasiTaftisy, validasiJumlah, validasiAdministrasi } from '@/lib/persyaratan-import';
import { KODE_ABSEN_10, KODE_ABSEN_SEMEN, KODE_ADMINISTRASI, KODE_LENGKAP_LANGSUNG, KODE_SYAHRIYAH, KODE_TAFTISY, KODE_TASMI, KODE_TATHBIQ, CFG_JUMLAH, type CfgJumlah } from '@/lib/persyaratan';
import type { Pratinjau } from '@/lib/siswa-types';
import { ringkasTaftisy } from '@/lib/taftisy';
import { ringkasAdministrasi } from '@/lib/administrasi';
import { fetchAll, gagal, sukses, type FormState } from '@/lib/util';

const MAKS_BARIS = 5000;
const PESAN_BELUM_TAFTISY = 'Tabel taftisy belum ada di database. Jalankan supabase/migration_taftisy.sql di Supabase SQL Editor.';
const salahTabelTaftisy = (m: string) => /persyaratan_taftisy|schema cache|does not exist/i.test(m);
const PESAN_BELUM_ADMIN = 'Tabel administrasi belum ada di database. Jalankan supabase/migration_administrasi.sql di Supabase SQL Editor.';
const salahTabelAdmin = (m: string) => /persyaratan_administrasi|schema cache|does not exist/i.test(m);
const PESAN_BELUM_MIGRASI = 'Tabel persyaratan belum lengkap di database. Jalankan supabase/migration_persyaratan.sql di Supabase SQL Editor.';

async function idJenis(db: ReturnType<typeof adminDb>, kode: string): Promise<number | null> {
  const { data, error } = await db.from('persyaratan_jenis').select('id').eq('kode', kode).maybeSingle();
  return error || !data ? null : (data.id as number);
}

// Upload, hapus data, dan target minimal mengganti data semua siswa, jadi hanya untuk akun yang punya Dashboard semua tingkat.
const PESAN_TANPA_KELOLA = 'Upload, hapus data, dan target minimal hanya untuk akun dengan akses Dashboard semua tingkat kelas.';
async function wajibKelola(): Promise<{ me: Me } | { pesan: string }> {
  const me = await requireAkses('persyaratan');
  return bolehKelolaData(me) ? { me } : { pesan: PESAN_TANPA_KELOLA };
}

// Aksi per siswa (tandai lengkap, ceklis): harus punya sub menu jenis itu DAN siswanya termasuk tingkat kelas yang diizinkan.
async function wajibSiswa(kode: string, siswaId: number): Promise<{ me: Me } | { pesan: string }> {
  const me = await requireAkses('persyaratan');
  const slug = JENIS_PERSYARATAN.find((j) => j.kode === kode)?.slug;
  if (!slug || !bisaSub(me, slug)) return { pesan: 'Anda tidak punya akses ke persyaratan ini' };
  if (batasSub(me, slug) !== '*') {
    const { data } = await adminDb().from('siswa').select('kelas').eq('id', siswaId).maybeSingle();
    if (!data || !bolehSiswa(me, slug, data.kelas)) return { pesan: 'Siswa ini di luar tingkat kelas yang boleh Anda akses' };
  }
  return { me };
}

// ---------- Upload Absen 10% (TU, di Dashboard persyaratan) ----------
export async function pratinjauAbsen10(fd: FormData): Promise<Pratinjau> {
  const k = await wajibKelola();
  if ('pesan' in k) return { ok: false, msg: k.pesan };
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return { ok: false, msg: 'Pilih file Excel terlebih dahulu' };
  const db = adminDb();
  const jid = await idJenis(db, KODE_ABSEN_10);
  if (jid === null) return { ok: false, msg: PESAN_BELUM_MIGRASI };
  try {
    const { pratinjau, valid, ringkasan } = await validasiAbsen10(await bacaFile(file), db, jid);
    if (!pratinjau.length) return { ok: false, msg: 'File tidak berisi data' };
    if (pratinjau.length > MAKS_BARIS) return { ok: false, msg: `Maksimal ${MAKS_BARIS} baris per upload (file ini ${pratinjau.length})` };
    return { ok: true, namaFile: file.name, total: pratinjau.length, bisaDiimpor: valid.length, ringkasan, rows: pratinjau };
  } catch (e: any) {
    return { ok: false, msg: e?.message ?? 'File tidak bisa dibaca' };
  }
}

// File dibaca dan divalidasi ulang di server. Baris valid disimpan (status lengkap siswa yang sudah ada tidak berubah),
// siswa yang tidak ada lagi di file dihapus dari daftar, baris error dilewati.
export async function importAbsen10(fd: FormData): Promise<FormState> {
  const k = await wajibKelola();
  if ('pesan' in k) return gagal(k.pesan);
  const me = k.me;
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return gagal('File tidak ditemukan, pilih ulang file');
  const db = adminDb();
  const jid = await idJenis(db, KODE_ABSEN_10);
  if (jid === null) return gagal(PESAN_BELUM_MIGRASI);

  let hasil: Awaited<ReturnType<typeof validasiAbsen10>>;
  try { hasil = await validasiAbsen10(await bacaFile(file), db, jid); } catch (e: any) { return gagal(e?.message ?? 'File tidak bisa dibaca'); }
  const { valid, pratinjau, hapusId } = hasil;
  if (!valid.length) return gagal('Tidak ada baris valid untuk diimpor');

  const sekarang = new Date().toISOString();
  for (const part of chunk(valid, 500)) {
    const rows = part.map((x) => ({
      siswa_id: x.siswa_id, jenis_id: jid,
      alasan: `Alpha ${x.persen}% dari hari aktif`,
      detail: { persentase_alpha: x.persen },
      updated_at: sekarang,
    })); // kolom lengkap sengaja tidak dikirim: siswa yang sudah ada tetap pada status-nya
    const { error } = await db.from('persyaratan_terjaring').upsert(rows, { onConflict: 'siswa_id,jenis_id' });
    if (error) return gagal(/lengkap/i.test(error.message) ? PESAN_BELUM_MIGRASI : error.message);
  }
  for (const part of chunk(hapusId, 300)) {
    const { error } = await db.from('persyaratan_terjaring').delete().eq('jenis_id', jid).in('siswa_id', part);
    if (error) return gagal(error.message);
  }
  await db.from('persyaratan_jenis').update({ data_terakhir: sekarang }).eq('id', jid);
  await audit(me.id, 'upload_absen10', { file: file.name, disimpan: valid.length, dihapus: hapusId.length });

  revalidatePath('/', 'layout');
  const dilewati = pratinjau.filter((x) => x.status === 'error').length;
  const catatan = [dilewati ? `${dilewati} baris error dilewati` : '', hapusId.length ? `${hapusId.length} siswa dihapus dari daftar` : ''].filter(Boolean).join(', ');
  return sukses(`Absen 10%: ${valid.length} siswa terjaring disimpan${catatan ? `, ${catatan}` : ''}`, !!catatan);
}

// ---------- Upload Absen Semen (TU, di Dashboard persyaratan) ----------
export async function pratinjauAbsenSemen(fd: FormData): Promise<Pratinjau> {
  const k = await wajibKelola();
  if ('pesan' in k) return { ok: false, msg: k.pesan };
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return { ok: false, msg: 'Pilih file Excel terlebih dahulu' };
  const db = adminDb();
  const jid = await idJenis(db, KODE_ABSEN_SEMEN);
  if (jid === null) return { ok: false, msg: PESAN_BELUM_MIGRASI };
  try {
    const { pratinjau, valid, ringkasan } = await validasiAbsenSemen(await bacaFile(file), db, jid);
    if (!pratinjau.length) return { ok: false, msg: 'File tidak berisi data' };
    if (pratinjau.length > MAKS_BARIS) return { ok: false, msg: `Maksimal ${MAKS_BARIS} baris per upload (file ini ${pratinjau.length})` };
    return { ok: true, namaFile: file.name, total: pratinjau.length, bisaDiimpor: valid.length, ringkasan, rows: pratinjau };
  } catch (e: any) {
    return { ok: false, msg: e?.message ?? 'File tidak bisa dibaca' };
  }
}

// Sama seperti Absen 10%: baris valid disimpan (status lengkap yang sudah ada tidak berubah),
// siswa yang tidak ada lagi di file dihapus dari daftar, baris error dilewati.
export async function importAbsenSemen(fd: FormData): Promise<FormState> {
  const k = await wajibKelola();
  if ('pesan' in k) return gagal(k.pesan);
  const me = k.me;
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return gagal('File tidak ditemukan, pilih ulang file');
  const db = adminDb();
  const jid = await idJenis(db, KODE_ABSEN_SEMEN);
  if (jid === null) return gagal(PESAN_BELUM_MIGRASI);

  let hasil: Awaited<ReturnType<typeof validasiAbsenSemen>>;
  try { hasil = await validasiAbsenSemen(await bacaFile(file), db, jid); } catch (e: any) { return gagal(e?.message ?? 'File tidak bisa dibaca'); }
  const { valid, pratinjau, hapusId } = hasil;
  if (!valid.length) return gagal('Tidak ada baris valid untuk diimpor');

  const sekarang = new Date().toISOString();
  for (const part of chunk(valid, 500)) {
    const rows = part.map((x) => ({
      siswa_id: x.siswa_id, jenis_id: jid,
      alasan: x.alpha > 0 ? `Tidak hadir tanpa udzur ${x.alpha} hari` : 'Tidak hadir (sakit/izin)',
      detail: { sakit: x.sakit, izin: x.izin, alpha: x.alpha },
      updated_at: sekarang,
    })); // kolom lengkap sengaja tidak dikirim: siswa yang sudah ada tetap pada status-nya
    const { error } = await db.from('persyaratan_terjaring').upsert(rows, { onConflict: 'siswa_id,jenis_id' });
    if (error) return gagal(/lengkap/i.test(error.message) ? PESAN_BELUM_MIGRASI : error.message);
  }
  for (const part of chunk(hapusId, 300)) {
    const { error } = await db.from('persyaratan_terjaring').delete().eq('jenis_id', jid).in('siswa_id', part);
    if (error) return gagal(error.message);
  }
  await db.from('persyaratan_jenis').update({ data_terakhir: sekarang }).eq('id', jid);
  await audit(me.id, 'upload_absen_semen', { file: file.name, disimpan: valid.length, dihapus: hapusId.length });

  revalidatePath('/', 'layout');
  const dilewati = pratinjau.filter((x) => x.status === 'error').length;
  const catatan = [dilewati ? `${dilewati} baris error dilewati` : '', hapusId.length ? `${hapusId.length} siswa dihapus dari daftar` : ''].filter(Boolean).join(', ');
  return sukses(`Absen Semen: ${valid.length} siswa terjaring disimpan${catatan ? `, ${catatan}` : ''}`, !!catatan);
}

// ---------- Upload daftar nama saja (Tasmi', dst; TU, di Dashboard persyaratan) ----------
async function pratinjauDaftar(kode: string, fd: FormData): Promise<Pratinjau> {
  const k = await wajibKelola();
  if ('pesan' in k) return { ok: false, msg: k.pesan };
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return { ok: false, msg: 'Pilih file Excel terlebih dahulu' };
  const db = adminDb();
  const jid = await idJenis(db, kode);
  if (jid === null) return { ok: false, msg: PESAN_BELUM_MIGRASI };
  try {
    const { pratinjau, valid, ringkasan } = await validasiDaftarNama(await bacaFile(file), db, jid);
    if (!pratinjau.length) return { ok: false, msg: 'File tidak berisi data' };
    if (pratinjau.length > MAKS_BARIS) return { ok: false, msg: `Maksimal ${MAKS_BARIS} baris per upload (file ini ${pratinjau.length})` };
    return { ok: true, namaFile: file.name, total: pratinjau.length, bisaDiimpor: valid.length, ringkasan, rows: pratinjau };
  } catch (e: any) {
    return { ok: false, msg: e?.message ?? 'File tidak bisa dibaca' };
  }
}

// Baris valid disimpan (status lengkap yang sudah ada tidak berubah), siswa yang tidak ada lagi di file
// dihapus dari daftar, baris error dilewati.
async function importDaftar(kode: string, nama: string, alasan: string, fd: FormData): Promise<FormState> {
  const k = await wajibKelola();
  if ('pesan' in k) return gagal(k.pesan);
  const me = k.me;
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return gagal('File tidak ditemukan, pilih ulang file');
  const db = adminDb();
  const jid = await idJenis(db, kode);
  if (jid === null) return gagal(PESAN_BELUM_MIGRASI);

  let hasil: Awaited<ReturnType<typeof validasiDaftarNama>>;
  try { hasil = await validasiDaftarNama(await bacaFile(file), db, jid); } catch (e: any) { return gagal(e?.message ?? 'File tidak bisa dibaca'); }
  const { valid, pratinjau, hapusId } = hasil;
  if (!valid.length) return gagal('Tidak ada baris valid untuk diimpor');

  const sekarang = new Date().toISOString();
  for (const part of chunk(valid, 500)) {
    const rows = part.map((x) => ({ siswa_id: x.siswa_id, jenis_id: jid, alasan, detail: null, updated_at: sekarang }));
    const { error } = await db.from('persyaratan_terjaring').upsert(rows, { onConflict: 'siswa_id,jenis_id' });
    if (error) return gagal(/lengkap/i.test(error.message) ? PESAN_BELUM_MIGRASI : error.message);
  }
  for (const part of chunk(hapusId, 300)) {
    const { error } = await db.from('persyaratan_terjaring').delete().eq('jenis_id', jid).in('siswa_id', part);
    if (error) return gagal(error.message);
  }
  await db.from('persyaratan_jenis').update({ data_terakhir: sekarang }).eq('id', jid);
  await audit(me.id, `upload_${kode}`, { file: file.name, disimpan: valid.length, dihapus: hapusId.length });

  revalidatePath('/', 'layout');
  const dilewati = pratinjau.filter((x) => x.status === 'error').length;
  const catatan = [dilewati ? `${dilewati} baris error dilewati` : '', hapusId.length ? `${hapusId.length} siswa dihapus dari daftar` : ''].filter(Boolean).join(', ');
  return sukses(`${nama}: ${valid.length} siswa terjaring disimpan${catatan ? `, ${catatan}` : ''}`, !!catatan);
}

export async function pratinjauTasmi(fd: FormData): Promise<Pratinjau> { return pratinjauDaftar(KODE_TASMI, fd); }
export async function importTasmi(fd: FormData): Promise<FormState> { return importDaftar(KODE_TASMI, "Tasmi'", "Terjaring Tasmi'", fd); }

// ---------- Verifikasi pengampu: tandai lengkap / batalkan (semua jenis yang bisa diupload) ----------
export async function setLengkapJenis(kode: string, siswaId: number, lengkap: boolean): Promise<FormState> {
  if (!KODE_LENGKAP_LANGSUNG.has(kode)) return gagal('Jenis persyaratan tidak valid');
  if (!Number.isInteger(siswaId)) return gagal('Siswa tidak valid');
  const w = await wajibSiswa(kode, siswaId);
  if ('pesan' in w) return gagal(w.pesan);
  const me = w.me;
  const db = adminDb();
  const jid = await idJenis(db, kode);
  if (jid === null) return gagal(PESAN_BELUM_MIGRASI);
  const { data, error } = await db.from('persyaratan_terjaring')
    .update({ lengkap, lengkap_at: lengkap ? new Date().toISOString() : null, lengkap_oleh: lengkap ? me.id : null })
    .eq('jenis_id', jid).eq('siswa_id', siswaId).select('id');
  if (error) return gagal(error.message);
  if (!data?.length) return gagal('Siswa tidak ada di daftar (mungkin daftar baru saja diperbarui TU). Muat ulang halaman.');
  await audit(me.id, lengkap ? `${kode}_lengkap` : `${kode}_batal_lengkap`, { siswa_id: siswaId });
  revalidatePath('/', 'layout');
  return sukses(lengkap ? 'Ditandai lengkap' : 'Status lengkap dibatalkan');
}

export async function setLengkapAbsen10(siswaId: number, lengkap: boolean): Promise<FormState> {
  return setLengkapJenis(KODE_ABSEN_10, siswaId, lengkap);
}

// ---------- Taftisy: upload TU (satu sheet per tingkat, pelajaran dinamis) ----------
export async function pratinjauTaftisy(fd: FormData): Promise<Pratinjau> {
  const k = await wajibKelola();
  if ('pesan' in k) return { ok: false, msg: k.pesan };
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return { ok: false, msg: 'Pilih file Excel terlebih dahulu' };
  const db = adminDb();
  const jid = await idJenis(db, KODE_TAFTISY);
  if (jid === null) return { ok: false, msg: PESAN_BELUM_MIGRASI };
  try {
    const { pratinjau, valid, ringkasan } = await validasiTaftisy(await bacaSemuaSheet(file), db, jid);
    if (!pratinjau.length) return { ok: false, msg: 'File tidak berisi data' };
    if (pratinjau.length > MAKS_BARIS) return { ok: false, msg: `Maksimal ${MAKS_BARIS} baris per upload (file ini ${pratinjau.length})` };
    return { ok: true, namaFile: file.name, total: pratinjau.length, bisaDiimpor: valid.length, ringkasan, rows: pratinjau };
  } catch (e: any) {
    return { ok: false, msg: e?.message ?? 'File tidak bisa dibaca' };
  }
}

export async function importTaftisy(fd: FormData): Promise<FormState> {
  const k = await wajibKelola();
  if ('pesan' in k) return gagal(k.pesan);
  const me = k.me;
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return gagal('File tidak ditemukan, pilih ulang file');
  const db = adminDb();
  const jid = await idJenis(db, KODE_TAFTISY);
  if (jid === null) return gagal(PESAN_BELUM_MIGRASI);

  let hasil: Awaited<ReturnType<typeof validasiTaftisy>>;
  try { hasil = await validasiTaftisy(await bacaSemuaSheet(file), db, jid); } catch (e: any) { return gagal(e?.message ?? 'File tidak bisa dibaca'); }
  const { valid, pratinjau, hapusId } = hasil;
  if (!valid.length) return gagal('Tidak ada siswa terjaring (belum lengkap) di file ini');

  let lama: any[], terjaringLama: any[];
  try {
    lama = await fetchAll((from, to) => db.from('persyaratan_taftisy').select('id,siswa_id,pelajaran,ceklis,diubah').eq('jenis_id', jid).order('id').range(from, to));
    terjaringLama = await fetchAll((from, to) => db.from('persyaratan_terjaring').select('siswa_id,lengkap,lengkap_at,lengkap_oleh').eq('jenis_id', jid).order('siswa_id').range(from, to));
  } catch (e: any) { return gagal(salahTabelTaftisy(e?.message ?? '') ? PESAN_BELUM_TAFTISY : e?.message ?? 'Gagal membaca data'); }
  const itemLama = new Map<string, { id: number; ceklis: boolean; diubah: boolean }>(lama.map((x) => [`${x.siswa_id}|${x.pelajaran}`, x]));
  const siswaLama = new Map<number, { lengkap: boolean; lengkap_at: string | null; lengkap_oleh: string | null }>(terjaringLama.map((x) => [x.siswa_id, x]));

  const sekarang = new Date().toISOString();
  const itemRows: any[] = [];
  const terjaringRows: any[] = [];
  const pakai = new Set<number>(); // id item lama yang masih dipakai; sisanya (pelajaran yang hilang dari file) dihapus
  for (const v of valid) {
    const akhir: { pelajaran: string; urutan: number; ceklis: boolean }[] = [];
    for (const p of v.pelajaran) {
      const e = itemLama.get(`${v.siswa_id}|${p.nama}`);
      if (e) pakai.add(e.id);
      const dipertahankan = !!e && e.diubah && e.ceklis !== p.x; // pengampu mengubah ceklis berbeda dari file
      const ceklis = dipertahankan ? e!.ceklis : p.x;
      akhir.push({ pelajaran: p.nama, urutan: p.urutan, ceklis });
      itemRows.push({ siswa_id: v.siswa_id, jenis_id: jid, pelajaran: p.nama, urutan: p.urutan, dari_file: p.x, ceklis, diubah: dipertahankan, updated_at: sekarang });
    }
    const r = ringkasTaftisy(v.tingkat, akhir);
    const prev = siswaLama.get(v.siswa_id);
    const tetap = r.lengkap && !!prev?.lengkap;
    terjaringRows.push({
      siswa_id: v.siswa_id, jenis_id: jid, alasan: r.alasan, detail: r.detail, updated_at: sekarang,
      lengkap: r.lengkap, lengkap_at: r.lengkap ? (tetap ? prev!.lengkap_at : sekarang) : null, lengkap_oleh: tetap ? prev!.lengkap_oleh : null,
    });
  }

  for (const part of chunk(itemRows, 500)) {
    const { error } = await db.from('persyaratan_taftisy').upsert(part, { onConflict: 'siswa_id,jenis_id,pelajaran' });
    if (error) return gagal(salahTabelTaftisy(error.message) ? PESAN_BELUM_TAFTISY : error.message);
  }
  for (const part of chunk(terjaringRows, 500)) {
    const { error } = await db.from('persyaratan_terjaring').upsert(part, { onConflict: 'siswa_id,jenis_id' });
    if (error) return gagal(/lengkap/i.test(error.message) ? PESAN_BELUM_MIGRASI : error.message);
  }
  const siswaDiFile = new Set(valid.map((v) => v.siswa_id));
  const usang = lama.filter((x) => siswaDiFile.has(x.siswa_id) && !pakai.has(x.id)).map((x) => x.id as number);
  for (const part of chunk(usang, 300)) {
    const { error } = await db.from('persyaratan_taftisy').delete().in('id', part);
    if (error) return gagal(error.message);
  }
  for (const part of chunk(hapusId, 300)) {
    const a = await db.from('persyaratan_taftisy').delete().eq('jenis_id', jid).in('siswa_id', part);
    if (a.error) return gagal(a.error.message);
    const b = await db.from('persyaratan_terjaring').delete().eq('jenis_id', jid).in('siswa_id', part);
    if (b.error) return gagal(b.error.message);
  }
  await db.from('persyaratan_jenis').update({ data_terakhir: sekarang }).eq('id', jid);
  await audit(me.id, 'upload_taftisy', { file: file.name, disimpan: valid.length, dihapus: hapusId.length });

  revalidatePath('/', 'layout');
  const dilewati = pratinjau.filter((x) => x.status === 'error').length;
  const catatan = [dilewati ? `${dilewati} baris error dilewati` : '', hapusId.length ? `${hapusId.length} siswa dihapus dari daftar` : ''].filter(Boolean).join(', ');
  return sukses(`Taftisy: ${valid.length} siswa terjaring disimpan${catatan ? `, ${catatan}` : ''}`, !!catatan);
}

// ---------- Taftisy: pengampu menyimpan perubahan ceklis satu siswa (setelah konfirmasi) ----------
// perubahan = pelajaran yang diceklis / dibatalkan. Status siswa (lengkap) dihitung ulang dari semua pelajarannya.
export async function simpanCeklisTaftisy(siswaId: number, perubahan: { itemId: number; ceklis: boolean }[]): Promise<FormState & { lengkap?: boolean }> {
  if (!Number.isInteger(siswaId)) return gagal('Siswa tidak valid');
  const w = await wajibSiswa(KODE_TAFTISY, siswaId);
  if ('pesan' in w) return gagal(w.pesan);
  const me = w.me;
  if (!Array.isArray(perubahan) || !perubahan.length) return gagal('Tidak ada perubahan untuk disimpan');
  if (perubahan.length > 60 || perubahan.some((p) => !Number.isInteger(p?.itemId) || typeof p.ceklis !== 'boolean')) return gagal('Data perubahan tidak valid');
  const db = adminDb();
  const jid = await idJenis(db, KODE_TAFTISY);
  if (jid === null) return gagal(PESAN_BELUM_MIGRASI);

  const { data: items, error: e1 } = await db.from('persyaratan_taftisy').select('id,pelajaran,urutan,dari_file,ceklis').eq('jenis_id', jid).eq('siswa_id', siswaId);
  if (e1) return gagal(salahTabelTaftisy(e1.message) ? PESAN_BELUM_TAFTISY : e1.message);
  const peta = new Map<number, any>((items ?? []).map((x: any) => [x.id as number, x]));
  if (perubahan.some((p) => !peta.has(p.itemId))) return gagal('Pelajaran tidak ditemukan (mungkin data baru saja diperbarui TU). Muat ulang halaman.');

  const sekarang = new Date().toISOString();
  const diubah = [...new Map(perubahan.map((p) => [p.itemId, p])).values()].filter((p) => peta.get(p.itemId).ceklis !== p.ceklis);
  if (!diubah.length) return gagal('Tidak ada perubahan untuk disimpan');
  const hasilUpdate = await Promise.all(diubah.map((p) => db.from('persyaratan_taftisy').update({
    ceklis: p.ceklis, diubah: p.ceklis !== peta.get(p.itemId).dari_file, ceklis_at: sekarang, ceklis_oleh: me.id, updated_at: sekarang,
  }).eq('id', p.itemId)));
  const gagalUpdate = hasilUpdate.find((r) => r.error);
  if (gagalUpdate?.error) return gagal(gagalUpdate.error.message);
  diubah.forEach((p) => { peta.get(p.itemId).ceklis = p.ceklis; });

  const { data: tj } = await db.from('persyaratan_terjaring').select('detail,lengkap,lengkap_at,lengkap_oleh').eq('jenis_id', jid).eq('siswa_id', siswaId).maybeSingle();
  if (!tj) return gagal('Siswa tidak ada di daftar Taftisy. Muat ulang halaman.');
  const r = ringkasTaftisy(String((tj.detail as any)?.tingkat ?? ''), [...peta.values()]);
  const tetap = r.lengkap && tj.lengkap;
  const { error: e4 } = await db.from('persyaratan_terjaring').update({
    alasan: r.alasan, detail: r.detail, updated_at: sekarang, lengkap: r.lengkap,
    lengkap_at: r.lengkap ? (tetap ? tj.lengkap_at : sekarang) : null, lengkap_oleh: r.lengkap ? (tetap ? tj.lengkap_oleh : me.id) : null,
  }).eq('jenis_id', jid).eq('siswa_id', siswaId);
  if (e4) return gagal(e4.message);

  await audit(me.id, 'taftisy_simpan', {
    siswa_id: siswaId,
    dilengkapi: diubah.filter((p) => p.ceklis).map((p) => peta.get(p.itemId).pelajaran),
    dibatalkan: diubah.filter((p) => !p.ceklis).map((p) => peta.get(p.itemId).pelajaran),
  });
  revalidatePath('/', 'layout');
  return { ...sukses(r.lengkap ? 'Tersimpan. Semua pelajaran lengkap, status siswa: Lengkap' : `Tersimpan. ${r.belum.length} pelajaran masih belum lengkap`), lengkap: r.lengkap };
}

// ---------- Jenis "jumlah vs target" (Tathbiq, Syahriyah): target minimal (Dashboard) + upload jumlah (TU) ----------
const pesanBelumJumlah = (cfg: CfgJumlah) => `Data ${cfg.nama} belum lengkap di database. Jalankan supabase/migration_${cfg.kode}.sql di Supabase SQL Editor.`;
const salahJumlah = (cfg: CfgJumlah, m: string) => new RegExp(`${cfg.tabel}|target_minimal|schema cache|does not exist`, 'i').test(m);

async function jenisJumlah(db: ReturnType<typeof adminDb>, cfg: CfgJumlah): Promise<{ id: number; target: number | null } | { error: string }> {
  const { data, error } = await db.from('persyaratan_jenis').select('id,target_minimal').eq('kode', cfg.kode).maybeSingle();
  if (error) return { error: salahJumlah(cfg, error.message) ? pesanBelumJumlah(cfg) : error.message };
  if (!data) return { error: PESAN_BELUM_MIGRASI };
  return { id: data.id as number, target: (data.target_minimal as number | null) ?? null };
}

// Daftar terjaring = siswa dengan jumlah < target. Siswa yang masih terjaring tetap memakai status lengkap-nya.
async function hitungUlangJumlah(db: ReturnType<typeof adminDb>, cfg: CfgJumlah, jid: number, target: number): Promise<number> {
  const sekarang = new Date().toISOString();
  const data = await fetchAll((from, to) => db.from(cfg.tabel).select('siswa_id,jumlah').order('siswa_id').range(from, to));
  const kurang = data.filter((x) => (x.jumlah as number) < target);
  const ada = await fetchAll((from, to) => db.from('persyaratan_terjaring').select('siswa_id').eq('jenis_id', jid).order('siswa_id').range(from, to));
  for (const part of chunk(kurang, 500)) {
    const rows = part.map((x) => ({
      siswa_id: x.siswa_id, jenis_id: jid, alasan: cfg.alasan(x.jumlah as number, target),
      detail: { [cfg.kunci]: x.jumlah, target_minimal: target, kekurangan: target - (x.jumlah as number) }, updated_at: sekarang,
    })); // kolom lengkap tidak dikirim: siswa yang sudah ada tetap pada status-nya
    const { error } = await db.from('persyaratan_terjaring').upsert(rows, { onConflict: 'siswa_id,jenis_id' });
    if (error) throw new Error(/lengkap/i.test(error.message) ? PESAN_BELUM_MIGRASI : error.message);
  }
  const tetap = new Set<number>(kurang.map((x) => x.siswa_id as number));
  const hapus = ada.map((x) => x.siswa_id as number).filter((id) => !tetap.has(id));
  for (const part of chunk(hapus, 300)) {
    const { error } = await db.from('persyaratan_terjaring').delete().eq('jenis_id', jid).in('siswa_id', part);
    if (error) throw new Error(error.message);
  }
  return kurang.length;
}

export async function simpanTargetJumlah(kode: string, target: number): Promise<FormState> {
  const k = await wajibKelola();
  if ('pesan' in k) return gagal(k.pesan);
  const me = k.me;
  const cfg = CFG_JUMLAH[kode];
  if (!cfg) return gagal('Jenis persyaratan tidak valid');
  if (!Number.isInteger(target) || target < 1 || target > 99) return gagal('Target minimal harus bilangan bulat 1 sampai 99');
  const db = adminDb();
  const j = await jenisJumlah(db, cfg);
  if ('error' in j) return gagal(j.error);
  const { error } = await db.from('persyaratan_jenis').update({ target_minimal: target }).eq('id', j.id);
  if (error) return gagal(salahJumlah(cfg, error.message) ? pesanBelumJumlah(cfg) : error.message);
  let jumlah: number | null = null;
  try {
    const { count } = await db.from(cfg.tabel).select('siswa_id', { count: 'exact', head: true });
    if (count) jumlah = await hitungUlangJumlah(db, cfg, j.id, target);
  } catch (e: any) { return gagal(e?.message ?? 'Gagal menghitung ulang daftar terjaring'); }
  await audit(me.id, `${cfg.kode}_target`, { target, sebelumnya: j.target, terjaring: jumlah });
  revalidatePath('/', 'layout');
  return sukses(jumlah === null ? `Target minimal disimpan: ${target} ${cfg.satuan}` : `Target minimal ${target} ${cfg.satuan} disimpan, ${jumlah} siswa terjaring`);
}

async function pratinjauJumlah(cfg: CfgJumlah, fd: FormData): Promise<Pratinjau> {
  const k = await wajibKelola();
  if ('pesan' in k) return { ok: false, msg: k.pesan };
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return { ok: false, msg: 'Pilih file Excel terlebih dahulu' };
  const db = adminDb();
  const j = await jenisJumlah(db, cfg);
  if ('error' in j) return { ok: false, msg: j.error };
  if (!j.target) return { ok: false, msg: `Isi dulu target minimal ${cfg.satuan} di baris ${cfg.nama}, lalu simpan, sebelum mengunggah data` };
  try {
    const { pratinjau, valid, ringkasan } = await validasiJumlah(cfg, await bacaFile(file), db, j.target);
    if (!pratinjau.length) return { ok: false, msg: 'File tidak berisi data' };
    if (pratinjau.length > MAKS_BARIS) return { ok: false, msg: `Maksimal ${MAKS_BARIS} baris per upload (file ini ${pratinjau.length})` };
    return { ok: true, namaFile: file.name, total: pratinjau.length, bisaDiimpor: valid.length, ringkasan, rows: pratinjau };
  } catch (e: any) {
    return { ok: false, msg: salahJumlah(cfg, e?.message ?? '') ? pesanBelumJumlah(cfg) : e?.message ?? 'File tidak bisa dibaca' };
  }
}

async function importJumlah(cfg: CfgJumlah, fd: FormData): Promise<FormState> {
  const k = await wajibKelola();
  if ('pesan' in k) return gagal(k.pesan);
  const me = k.me;
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return gagal('File tidak ditemukan, pilih ulang file');
  const db = adminDb();
  const j = await jenisJumlah(db, cfg);
  if ('error' in j) return gagal(j.error);
  if (!j.target) return gagal(`Isi dulu target minimal ${cfg.satuan} di baris ${cfg.nama} sebelum mengunggah data`);

  let hasil: Awaited<ReturnType<typeof validasiJumlah>>;
  try { hasil = await validasiJumlah(cfg, await bacaFile(file), db, j.target); } catch (e: any) { return gagal(salahJumlah(cfg, e?.message ?? '') ? pesanBelumJumlah(cfg) : e?.message ?? 'File tidak bisa dibaca'); }
  const { valid, pratinjau, hapusId } = hasil;
  if (!valid.length) return gagal('Tidak ada baris valid untuk diimpor');

  const sekarang = new Date().toISOString();
  for (const part of chunk(valid, 500)) {
    const { error } = await db.from(cfg.tabel).upsert(part.map((x) => ({ siswa_id: x.siswa_id, jumlah: x.jumlah, updated_at: sekarang })), { onConflict: 'siswa_id' });
    if (error) return gagal(salahJumlah(cfg, error.message) ? pesanBelumJumlah(cfg) : error.message);
  }
  for (const part of chunk(hapusId, 300)) {
    const { error } = await db.from(cfg.tabel).delete().in('siswa_id', part);
    if (error) return gagal(error.message);
  }
  let terjaring: number;
  try { terjaring = await hitungUlangJumlah(db, cfg, j.id, j.target); } catch (e: any) { return gagal(e?.message ?? 'Gagal menghitung daftar terjaring'); }
  await db.from('persyaratan_jenis').update({ data_terakhir: sekarang }).eq('id', j.id);
  await audit(me.id, `upload_${cfg.kode}`, { file: file.name, disimpan: valid.length, dihapus: hapusId.length, target: j.target, terjaring });

  revalidatePath('/', 'layout');
  const dilewati = pratinjau.filter((x) => x.status === 'error').length;
  const catatan = [dilewati ? `${dilewati} baris error dilewati` : '', hapusId.length ? `${hapusId.length} data siswa dihapus (tidak ada di file)` : ''].filter(Boolean).join(', ');
  return sukses(`${cfg.nama}: ${valid.length} data disimpan, ${terjaring} siswa terjaring (kurang dari ${j.target} ${cfg.satuan})${catatan ? `, ${catatan}` : ''}`, !!catatan);
}

export async function pratinjauTathbiq(fd: FormData): Promise<Pratinjau> { return pratinjauJumlah(CFG_JUMLAH[KODE_TATHBIQ], fd); }
export async function importTathbiq(fd: FormData): Promise<FormState> { return importJumlah(CFG_JUMLAH[KODE_TATHBIQ], fd); }
export async function pratinjauSyahriyah(fd: FormData): Promise<Pratinjau> { return pratinjauJumlah(CFG_JUMLAH[KODE_SYAHRIYAH], fd); }
export async function importSyahriyah(fd: FormData): Promise<FormState> { return importJumlah(CFG_JUMLAH[KODE_SYAHRIYAH], fd); }

// ---------- Administrasi: upload TU (satu sheet; satu siswa boleh beberapa baris dengan keterangan berbeda) ----------
export async function pratinjauAdministrasi(fd: FormData): Promise<Pratinjau> {
  const k = await wajibKelola();
  if ('pesan' in k) return { ok: false, msg: k.pesan };
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return { ok: false, msg: 'Pilih file Excel terlebih dahulu' };
  const db = adminDb();
  const jid = await idJenis(db, KODE_ADMINISTRASI);
  if (jid === null) return { ok: false, msg: PESAN_BELUM_MIGRASI };
  try {
    const { pratinjau, valid, ringkasan } = await validasiAdministrasi(await bacaFile(file), db, jid);
    if (!pratinjau.length) return { ok: false, msg: 'File tidak berisi data' };
    if (pratinjau.length > MAKS_BARIS) return { ok: false, msg: `Maksimal ${MAKS_BARIS} baris per upload (file ini ${pratinjau.length})` };
    return { ok: true, namaFile: file.name, total: pratinjau.length, bisaDiimpor: valid.length, ringkasan, rows: pratinjau };
  } catch (e: any) {
    return { ok: false, msg: e?.message ?? 'File tidak bisa dibaca' };
  }
}

export async function importAdministrasi(fd: FormData): Promise<FormState> {
  const k = await wajibKelola();
  if ('pesan' in k) return gagal(k.pesan);
  const me = k.me;
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return gagal('File tidak ditemukan, pilih ulang file');
  const db = adminDb();
  const jid = await idJenis(db, KODE_ADMINISTRASI);
  if (jid === null) return gagal(PESAN_BELUM_MIGRASI);

  let hasil: Awaited<ReturnType<typeof validasiAdministrasi>>;
  try { hasil = await validasiAdministrasi(await bacaFile(file), db, jid); } catch (e: any) { return gagal(e?.message ?? 'File tidak bisa dibaca'); }
  const { valid, pratinjau, hapusId } = hasil;
  if (!valid.length) return gagal('Tidak ada baris valid untuk diimpor');

  let lama: any[], terjaringLama: any[];
  try {
    lama = await fetchAll((from, to) => db.from('persyaratan_administrasi').select('id,siswa_id,kunci,ceklis').eq('jenis_id', jid).order('id').range(from, to));
    terjaringLama = await fetchAll((from, to) => db.from('persyaratan_terjaring').select('siswa_id,lengkap,lengkap_at,lengkap_oleh').eq('jenis_id', jid).order('siswa_id').range(from, to));
  } catch (e: any) { return gagal(salahTabelAdmin(e?.message ?? '') ? PESAN_BELUM_ADMIN : e?.message ?? 'Gagal membaca data'); }
  const itemLama = new Map<string, { id: number; ceklis: boolean }>(lama.map((x) => [`${x.siswa_id}|${x.kunci}`, x]));
  const siswaLama = new Map<number, { lengkap: boolean; lengkap_at: string | null; lengkap_oleh: string | null }>(terjaringLama.map((x) => [x.siswa_id, x]));

  const perSiswa = new Map<number, typeof valid>();
  valid.forEach((v) => { const a = perSiswa.get(v.siswa_id) ?? []; a.push(v); perSiswa.set(v.siswa_id, a); });

  const sekarang = new Date().toISOString();
  const itemRows: any[] = [];
  const terjaringRows: any[] = [];
  const pakai = new Set<number>(); // id catatan lama yang masih ada di file; sisanya (catatan yang hilang dari file) dihapus
  for (const [siswaId, daftar] of perSiswa) {
    const akhir: { keterangan: string; nominal: number | null; urutan: number; ceklis: boolean }[] = [];
    for (const v of daftar) {
      const e = itemLama.get(`${siswaId}|${v.kunci}`);
      if (e) pakai.add(e.id);
      const ceklis = e?.ceklis ?? false; // ceklis pengampu selalu dipertahankan
      akhir.push({ keterangan: v.keterangan, nominal: v.nominal, urutan: v.urutan, ceklis });
      itemRows.push({ siswa_id: siswaId, jenis_id: jid, kunci: v.kunci, keterangan: v.keterangan, nominal: v.nominal, urutan: v.urutan, ceklis, updated_at: sekarang });
    }
    const r = ringkasAdministrasi(akhir);
    const prev = siswaLama.get(siswaId);
    const tetap = r.lengkap && !!prev?.lengkap;
    terjaringRows.push({
      siswa_id: siswaId, jenis_id: jid, alasan: r.alasan, detail: r.detail, updated_at: sekarang,
      lengkap: r.lengkap, lengkap_at: r.lengkap ? (tetap ? prev!.lengkap_at : sekarang) : null, lengkap_oleh: tetap ? prev!.lengkap_oleh : null,
    });
  }

  for (const part of chunk(itemRows, 500)) {
    const { error } = await db.from('persyaratan_administrasi').upsert(part, { onConflict: 'siswa_id,jenis_id,kunci' });
    if (error) return gagal(salahTabelAdmin(error.message) ? PESAN_BELUM_ADMIN : error.message);
  }
  for (const part of chunk(terjaringRows, 500)) {
    const { error } = await db.from('persyaratan_terjaring').upsert(part, { onConflict: 'siswa_id,jenis_id' });
    if (error) return gagal(/lengkap/i.test(error.message) ? PESAN_BELUM_MIGRASI : error.message);
  }
  const usang = lama.filter((x) => perSiswa.has(x.siswa_id) && !pakai.has(x.id)).map((x) => x.id as number);
  for (const part of chunk(usang, 300)) {
    const { error } = await db.from('persyaratan_administrasi').delete().in('id', part);
    if (error) return gagal(error.message);
  }
  for (const part of chunk(hapusId, 300)) {
    const a = await db.from('persyaratan_administrasi').delete().eq('jenis_id', jid).in('siswa_id', part);
    if (a.error) return gagal(a.error.message);
    const b = await db.from('persyaratan_terjaring').delete().eq('jenis_id', jid).in('siswa_id', part);
    if (b.error) return gagal(b.error.message);
  }
  await db.from('persyaratan_jenis').update({ data_terakhir: sekarang }).eq('id', jid);
  await audit(me.id, 'upload_administrasi', { file: file.name, siswa: perSiswa.size, catatan: valid.length, dihapus: hapusId.length });

  revalidatePath('/', 'layout');
  const dilewati = pratinjau.filter((x) => x.status === 'error').length;
  const catatan = [dilewati ? `${dilewati} baris error dilewati` : '', hapusId.length ? `${hapusId.length} siswa dihapus dari daftar` : ''].filter(Boolean).join(', ');
  return sukses(`Administrasi: ${perSiswa.size} siswa terjaring (${valid.length} catatan) disimpan${catatan ? `, ${catatan}` : ''}`, !!catatan);
}

// ---------- Administrasi: pengampu menyimpan perubahan ceklis satu siswa (setelah konfirmasi) ----------
// perubahan = catatan yang diselesaikan / dibatalkan. Status siswa (lengkap) dihitung ulang dari semua catatannya.
export async function simpanCeklisAdministrasi(siswaId: number, perubahan: { itemId: number; ceklis: boolean }[]): Promise<FormState & { lengkap?: boolean }> {
  if (!Number.isInteger(siswaId)) return gagal('Siswa tidak valid');
  const w = await wajibSiswa(KODE_ADMINISTRASI, siswaId);
  if ('pesan' in w) return gagal(w.pesan);
  const me = w.me;
  if (!Array.isArray(perubahan) || !perubahan.length) return gagal('Tidak ada perubahan untuk disimpan');
  if (perubahan.length > 60 || perubahan.some((p) => !Number.isInteger(p?.itemId) || typeof p.ceklis !== 'boolean')) return gagal('Data perubahan tidak valid');
  const db = adminDb();
  const jid = await idJenis(db, KODE_ADMINISTRASI);
  if (jid === null) return gagal(PESAN_BELUM_MIGRASI);

  const { data: items, error: e1 } = await db.from('persyaratan_administrasi').select('id,keterangan,nominal,urutan,ceklis').eq('jenis_id', jid).eq('siswa_id', siswaId);
  if (e1) return gagal(salahTabelAdmin(e1.message) ? PESAN_BELUM_ADMIN : e1.message);
  const peta = new Map<number, any>((items ?? []).map((x: any) => [x.id as number, x]));
  if (perubahan.some((p) => !peta.has(p.itemId))) return gagal('Catatan tidak ditemukan (mungkin data baru saja diperbarui TU). Muat ulang halaman.');

  const sekarang = new Date().toISOString();
  const diubah = [...new Map(perubahan.map((p) => [p.itemId, p])).values()].filter((p) => peta.get(p.itemId).ceklis !== p.ceklis);
  if (!diubah.length) return gagal('Tidak ada perubahan untuk disimpan');
  const hasilUpdate = await Promise.all(diubah.map((p) => db.from('persyaratan_administrasi').update({
    ceklis: p.ceklis, ceklis_at: p.ceklis ? sekarang : null, ceklis_oleh: p.ceklis ? me.id : null, updated_at: sekarang,
  }).eq('id', p.itemId)));
  const gagalUpdate = hasilUpdate.find((r) => r.error);
  if (gagalUpdate?.error) return gagal(gagalUpdate.error.message);
  diubah.forEach((p) => { peta.get(p.itemId).ceklis = p.ceklis; });

  const { data: tj } = await db.from('persyaratan_terjaring').select('lengkap,lengkap_at,lengkap_oleh').eq('jenis_id', jid).eq('siswa_id', siswaId).maybeSingle();
  if (!tj) return gagal('Siswa tidak ada di daftar Administrasi. Muat ulang halaman.');
  const r = ringkasAdministrasi([...peta.values()]);
  const tetap = r.lengkap && tj.lengkap;
  const { error: e4 } = await db.from('persyaratan_terjaring').update({
    alasan: r.alasan, detail: r.detail, updated_at: sekarang, lengkap: r.lengkap,
    lengkap_at: r.lengkap ? (tetap ? tj.lengkap_at : sekarang) : null, lengkap_oleh: r.lengkap ? (tetap ? tj.lengkap_oleh : me.id) : null,
  }).eq('jenis_id', jid).eq('siswa_id', siswaId);
  if (e4) return gagal(e4.message);

  await audit(me.id, 'administrasi_simpan', {
    siswa_id: siswaId,
    diselesaikan: diubah.filter((p) => p.ceklis).map((p) => peta.get(p.itemId).keterangan || '(tanpa keterangan)'),
    dibatalkan: diubah.filter((p) => !p.ceklis).map((p) => peta.get(p.itemId).keterangan || '(tanpa keterangan)'),
  });
  revalidatePath('/', 'layout');
  return { ...sukses(r.lengkap ? 'Tersimpan. Semua catatan selesai, status siswa: Lengkap' : `Tersimpan. ${r.belum.length} catatan masih belum selesai`), lengkap: r.lengkap };
}

// ---------- Hapus data satu jenis persyaratan (untuk memulai ujian berikutnya) ----------
// Menghapus daftar terjaring beserta data mentahnya (ceklis Taftisy, catatan Administrasi, jumlah Tathbiq / Syahriyah),
// lalu mengembalikan jenis ke keadaan "belum diunggah". Target minimal (Tathbiq, Syahriyah) ikut dikosongkan agar harus diisi ulang.
// Data siswa, ruang, dan gelombang tidak disentuh.
export async function hapusDataJenis(kode: string): Promise<FormState> {
  const k = await wajibKelola();
  if ('pesan' in k) return gagal(k.pesan);
  const me = k.me;
  const db = adminDb();
  const { data: j, error: e0 } = await db.from('persyaratan_jenis').select('id,nama').eq('kode', kode).maybeSingle();
  if (e0 || !j) return gagal('Jenis persyaratan tidak ditemukan');

  // Tabel data mentah tiap jenis (bila ada). Tabel yang belum dimigrasi dilewati karena memang belum ada isinya.
  const mentah: { tabel: string; kolom: string; semua: boolean }[] = [];
  if (kode === KODE_TAFTISY) mentah.push({ tabel: 'persyaratan_taftisy', kolom: 'jenis_id', semua: false });
  if (kode === KODE_ADMINISTRASI) mentah.push({ tabel: 'persyaratan_administrasi', kolom: 'jenis_id', semua: false });
  const cfg = CFG_JUMLAH[kode];
  if (cfg) mentah.push({ tabel: cfg.tabel, kolom: 'siswa_id', semua: true });

  const { count: jumlah } = await db.from('persyaratan_terjaring').select('id', { count: 'exact', head: true }).eq('jenis_id', j.id);
  for (const m of mentah) {
    const q = db.from(m.tabel).delete();
    const { error } = await (m.semua ? q.not(m.kolom, 'is', null) : q.eq(m.kolom, j.id));
    if (error && !/schema cache|does not exist/i.test(error.message)) return gagal(error.message);
  }
  const { error: e1 } = await db.from('persyaratan_terjaring').delete().eq('jenis_id', j.id);
  if (e1) return gagal(e1.message);
  const { error: e2 } = await db.from('persyaratan_jenis').update(cfg ? { data_terakhir: null, target_minimal: null } : { data_terakhir: null }).eq('id', j.id);
  if (e2) return gagal(e2.message);

  await audit(me.id, `hapus_${kode}`, { siswa_terjaring: jumlah ?? 0 });
  revalidatePath('/', 'layout');
  return sukses(`Data ${j.nama} dihapus. Siap diunggah ulang untuk ujian berikutnya${cfg ? ` (isi target minimal ${cfg.satuan} lagi)` : ''}`);
}
