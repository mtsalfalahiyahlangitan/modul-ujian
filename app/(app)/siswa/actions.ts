'use server';
import { revalidatePath } from 'next/cache';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { bacaFile, validasiSiswa, validasiRuang } from '@/lib/siswa-import';
import type { Pratinjau } from '@/lib/siswa-types';
import { parseGelombang } from '@/lib/gelombang-input';
import { fail, ok, gagal, sukses, num, str, fetchAll, type FormState } from '@/lib/util';
import { filterSiswa } from '@/lib/siswa-filter';

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Ganti seluruh gelombang milik sekumpulan siswa dengan daftar baru
async function setGelombang(db: ReturnType<typeof adminDb>, peta: Map<number, number[]>) {
  const siswaIds = [...peta.keys()];
  for (const part of chunk(siswaIds, 300)) {
    const { error } = await db.from('siswa_gelombang').delete().in('siswa_id', part);
    if (error) return error.message;
  }
  const pairs = siswaIds.flatMap((sid) => (peta.get(sid) ?? []).map((gid) => ({ siswa_id: sid, gelombang_id: gid })));
  for (const part of chunk(pairs, 500)) {
    const { error } = await db.from('siswa_gelombang').insert(part);
    if (error) return error.message;
  }
  return null;
}

export async function simpanSiswa(fd: FormData): Promise<FormState> {
  await requireAkses('siswa');
  const id = num(fd.get('id'));
  const db = adminDb();
  const { data: gels } = await db.from('gelombang').select('id,urutan,nama_gelombang');
  const pg = parseGelombang(str(fd.get('gelombang')), gels ?? []);
  if (pg.error) return gagal(`Gelombang tidak valid: ${pg.error}. Contoh isian: 1&3`);

  const row = {
    no_induk: str(fd.get('no_induk')), nama: str(fd.get('nama')),
    asrama: str(fd.get('asrama')), kamar: str(fd.get('kamar')) || null, kelas: str(fd.get('kelas')),
    rfid: str(fd.get('rfid')).toUpperCase() || null, // kosong -> NULL (penting untuk unique index)
    ruang_id: num(fd.get('ruang_id')),
    no_ujian: str(fd.get('no_ujian')) || null, no_bangku: str(fd.get('no_bangku')) || null, // kosong -> NULL
  };
  if (row.no_ujian && row.no_ujian.length > 30) return gagal('No. ujian maksimal 30 karakter');
  if (row.no_bangku && row.no_bangku.length > 20) return gagal('No. bangku maksimal 20 karakter');
  if (!row.no_induk || !row.nama || !row.asrama || !row.kelas) return gagal('No. induk, nama, asrama, kelas wajib diisi');

  if (row.no_ujian) { // nomor ujian tidak boleh sama dengan siswa lain (barcode kartu harus mengenali satu siswa)
    let q = db.from('siswa').select('no_induk,nama').eq('no_ujian', row.no_ujian).limit(1);
    if (id) q = q.neq('id', id);
    const { data: dobel } = await q;
    if (dobel?.length) return gagal(`No. ujian ${row.no_ujian} sudah dipakai ${dobel[0].nama} (${dobel[0].no_induk})`);
  }

  const { data, error } = id
    ? await db.from('siswa').update(row).eq('id', id).select('id').single()
    : await db.from('siswa').insert(row).select('id').single();
  if (error) return gagal(error.code === '23505'
    ? (/rfid/i.test(error.message) ? 'RFID sudah dipakai siswa lain' : 'No. induk sudah terdaftar')
    : /no_ujian|no_bangku/i.test(error.message) ? 'Kolom nomor ujian/bangku belum ada di database. Jalankan supabase/migration_kartu_ujian.sql di Supabase SQL Editor.'
    : error.message);

  const e2 = await setGelombang(db, new Map([[data!.id, pg.ids]]));
  revalidatePath('/', 'layout');
  if (e2) return sukses(`Siswa tersimpan, tapi gelombang gagal disimpan: ${e2}. Buka Edit untuk mencoba lagi.`, true);
  return sukses('Siswa tersimpan');
}

export async function hapusSiswa(fd: FormData) {
  await requireAkses('siswa');
  const { error } = await adminDb().from('siswa').delete().eq('id', num(fd.get('id')));
  if (error) fail('/siswa', error.message);
  ok('/siswa', 'Siswa dihapus');
}

// ---------- Upload Excel: pratinjau dulu, baru import ----------
const MAKS_BARIS = 5000;

async function buatPratinjau(fd: FormData, validasi: typeof validasiSiswa | typeof validasiRuang): Promise<Pratinjau> {
  await requireAkses('siswa');
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return { ok: false, msg: 'Pilih file Excel terlebih dahulu' };
  try {
    const { pratinjau, valid, ringkasan } = await validasi(await bacaFile(file), adminDb());
    if (!pratinjau.length) return { ok: false, msg: 'File tidak berisi data' };
    if (pratinjau.length > MAKS_BARIS) return { ok: false, msg: `Maksimal ${MAKS_BARIS} baris per upload (file ini ${pratinjau.length})` };
    return { ok: true, namaFile: file.name, total: pratinjau.length, bisaDiimpor: valid.length, ringkasan, rows: pratinjau };
  } catch (e: any) {
    return { ok: false, msg: e?.message ?? 'File tidak bisa dibaca' };
  }
}

export async function pratinjauSiswa(fd: FormData) { return buatPratinjau(fd, validasiSiswa); }
export async function pratinjauRuang(fd: FormData) { return buatPratinjau(fd, validasiRuang); }

// File dibaca dan divalidasi ulang di server; hanya baris valid yang disimpan, baris error dilewati.
// Ruang & gelombang siswa TIDAK diubah oleh upload data siswa.
export async function importSiswaExcel(fd: FormData): Promise<FormState> {
  await requireAkses('siswa');
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return gagal('File tidak ditemukan, pilih ulang file');
  const db = adminDb();
  let hasil: Awaited<ReturnType<typeof validasiSiswa>>;
  try { hasil = await validasiSiswa(await bacaFile(file), db); } catch (e: any) { return gagal(e?.message ?? 'File tidak bisa dibaca'); }
  const { valid, pratinjau } = hasil;
  if (!valid.length) return gagal('Tidak ada baris valid untuk diimpor');

  // Baris tanpa RFID diproses terpisah agar tidak menghapus RFID yang sudah terdaftar
  for (const g of [valid.filter((x) => x.rfid), valid.filter((x) => !x.rfid)]) {
    for (const part of chunk(g, 500)) {
      const rows = part.map((x) => ({
        no_induk: x.no_induk, nama: x.nama, asrama: x.asrama, kamar: x.kamar || null, kelas: x.kelas,
        ...(x.rfid ? { rfid: x.rfid } : {}),
      }));
      const { error } = await db.from('siswa').upsert(rows, { onConflict: 'no_induk' });
      if (error) return gagal(error.code === '23505' && /rfid/i.test(error.message)
        ? 'Import terhenti: ada RFID yang baru saja dipakai siswa lain. Unggah ulang untuk melihat pratinjau terbaru.'
        : /kamar/i.test(error.message) ? 'Kolom "kamar" belum ada di database. Jalankan supabase/migration_kamar.sql di Supabase SQL Editor.' : error.message);
    }
  }
  revalidatePath('/', 'layout');
  const dilewati = pratinjau.length - valid.length;
  return sukses(`${valid.length} siswa berhasil disimpan${dilewati ? `, ${dilewati} baris error dilewati` : ''}`, dilewati > 0);
}

export async function importRuangExcel(fd: FormData): Promise<FormState> {
  await requireAkses('siswa');
  const file = fd.get('file') as File | null;
  if (!file || file.size === 0) return gagal('File tidak ditemukan, pilih ulang file');
  const db = adminDb();
  let hasil: Awaited<ReturnType<typeof validasiRuang>>;
  try { hasil = await validasiRuang(await bacaFile(file), db); } catch (e: any) { return gagal(e?.message ?? 'File tidak bisa dibaca'); }
  const { valid, pratinjau } = hasil;
  if (!valid.length) return gagal('Tidak ada baris yang perlu diperbarui');

  // Ruang: satu update per ruang (bukan per siswa). Kolom ruang kosong = tidak diubah.
  const perRuang = new Map<number, number[]>();
  valid.forEach((x) => { if (x.ruang_id != null) perRuang.set(x.ruang_id, [...(perRuang.get(x.ruang_id) ?? []), x.id]); });
  for (const [ruangId, ids] of perRuang) {
    for (const part of chunk(ids, 300)) {
      const { error } = await db.from('siswa').update({ ruang_id: ruangId }).in('id', part);
      if (error) return gagal(error.message);
    }
  }
  // Gelombang: ganti seluruh gelombang siswa yang kolomnya diisi. Kosong = tidak diubah.
  const petaGel = new Map<number, number[]>();
  valid.forEach((x) => { if (x.gelombang_ids) petaGel.set(x.id, x.gelombang_ids); });
  const e2 = petaGel.size ? await setGelombang(db, petaGel) : null;
  // No. ujian & no. bangku: nilainya beda tiap siswa, jadi satu update per siswa (sekelompok kecil sekaligus). Kosong = tidak diubah.
  // Saat menukar nomor antar siswa tidak ada bentrok karena nomor ujian tidak dibuat unik di database (kedobelan sudah dicek di pratinjau).
  const nomor = valid.filter((x) => x.no_ujian || x.no_bangku);
  for (const grup of chunk(nomor, 25)) {
    const hasil = await Promise.all(grup.map((x) => db.from('siswa').update({
      ...(x.no_ujian ? { no_ujian: x.no_ujian } : {}), ...(x.no_bangku ? { no_bangku: x.no_bangku } : {}),
    }).eq('id', x.id)));
    const gagalNomor = hasil.find((h) => h.error);
    if (gagalNomor?.error) return gagal(/no_ujian|no_bangku/i.test(gagalNomor.error.message)
      ? 'Kolom nomor ujian/bangku belum ada di database. Jalankan supabase/migration_kartu_ujian.sql di Supabase SQL Editor.' : gagalNomor.error.message);
  }
  revalidatePath('/', 'layout');
  if (e2) return sukses(`Ruang tersimpan, tapi gelombang gagal disimpan: ${e2}`, true);
  const dilewati = pratinjau.filter((x) => x.status === 'error').length;
  return sukses(`Ruang & gelombang ${valid.length} siswa diperbarui${dilewati ? `, ${dilewati} baris error dilewati` : ''}`, dilewati > 0);
}

// ---------- Hapus massal ----------
// ids = pilihan manual. semua=1 = semua siswa hasil filter (termasuk yang tidak tampil di halaman).
export async function hapusSiswaMassal(fd: FormData): Promise<FormState> {
  await requireAkses('siswa');
  const db = adminDb();
  let ids: number[] = [];
  if (str(fd.get('semua')) === '1') {
    const sp = Object.fromEntries(['q', 'kelas', 'asrama', 'ruang', 'gel'].map((k) => [k, str(fd.get(k)) || undefined]));
    const rows = await fetchAll((a, b) =>
      filterSiswa(db.from('siswa').select(sp.gel ? 'id, sg:siswa_gelombang!inner(gelombang_id)' : 'id'), sp).order('id').range(a, b));
    ids = rows.map((r: any) => r.id as number);
  } else {
    try { ids = (JSON.parse(str(fd.get('ids'))) as unknown[]).map(Number).filter((n) => Number.isInteger(n)); } catch { /* ids kosong */ }
  }
  if (!ids.length) return gagal('Tidak ada siswa yang dipilih');
  for (const part of chunk(ids, 200)) {
    const { error } = await db.from('siswa').delete().in('id', part);
    if (error) return gagal(error.message);
  }
  revalidatePath('/', 'layout');
  return sukses(`${ids.length} siswa dihapus`);
}
