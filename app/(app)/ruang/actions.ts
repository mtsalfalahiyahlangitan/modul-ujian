'use server';
import { revalidatePath } from 'next/cache';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { fail, ok, gagal, sukses, num, str, type FormState } from '@/lib/util';
import { randomInt } from 'node:crypto';
import ExcelJS from 'exceljs';
import { bangunRuang, cekPola, usernameDariPola, namaDariPola, PENANDA_USERNAME, POLA_USERNAME } from '@/lib/ruang-gen';

export async function simpanRuang(fd: FormData): Promise<FormState> {
  await requireAkses('ruang');
  const id = num(fd.get('id'));
  const row = { kode_ruang: str(fd.get('kode_ruang')), nama_ruang: str(fd.get('nama_ruang')) };
  if (!row.kode_ruang || !row.nama_ruang) return gagal('Kode dan nama ruang wajib diisi');
  const db = adminDb();
  const { error } = id ? await db.from('ruang').update(row).eq('id', id) : await db.from('ruang').insert(row);
  if (error) return gagal(error.code === '23505' ? 'Kode ruang sudah dipakai' : error.message);
  revalidatePath('/', 'layout');
  return sukses('Ruang tersimpan');
}

export async function hapusRuang(fd: FormData) {
  await requireAkses('ruang');
  const { error } = await adminDb().from('ruang').delete().eq('id', num(fd.get('id')));
  if (error) fail('/ruang', error.code === '23503' ? 'Hapus akun petugas ruang ini terlebih dahulu' : error.message);
  ok('/ruang', 'Ruang dihapus');
}

export async function buatPetugas(fd: FormData): Promise<FormState> {
  await requireAkses('ruang');
  const ruang_id = num(fd.get('ruang_id'));
  const username = str(fd.get('username')).toLowerCase();
  const nama = str(fd.get('nama'));
  const password = str(fd.get('password'));
  if (!ruang_id || !username || !nama) return gagal('Ruang, username, dan nama wajib diisi');
  if (!/^[a-z0-9._-]+$/.test(username)) return gagal('Username hanya boleh huruf kecil, angka, titik, strip, underscore');
  if (password.length < 6) return gagal('Password minimal 6 karakter');

  const db = adminDb();
  const { data: ada } = await db.from('users').select('id').eq('ruang_id', ruang_id).eq('role', 'petugas').maybeSingle();
  if (ada) return gagal('Ruang ini sudah punya akun petugas');

  const { data: created, error } = await db.auth.admin.createUser({
    email: `${username}@absensi.local`, password, email_confirm: true,
  });
  if (error || !created.user) return gagal(error?.message ?? 'Gagal membuat akun');
  const { error: e2 } = await db.from('users').insert({ id: created.user.id, username, nama, role: 'petugas', ruang_id });
  if (e2) {
    await db.auth.admin.deleteUser(created.user.id);
    return gagal(e2.code === '23505' ? 'Username atau ruang sudah dipakai' : e2.message);
  }
  revalidatePath('/', 'layout');
  return sukses(`Akun petugas ${username} dibuat`);
}

// Akun yang dikelola dari halaman Ruang hanya akun petugas ruang; akun lain diatur di Pengaturan oleh Administrator.
async function pastikanPetugas(userId: string) {
  const { data } = await adminDb().from('users').select('role').eq('id', userId).maybeSingle();
  return data?.role === 'petugas';
}

export async function gantiPassword(fd: FormData) {
  await requireAkses('ruang');
  const password = str(fd.get('password'));
  if (password.length < 6) fail('/ruang', 'Password minimal 6 karakter');
  if (!(await pastikanPetugas(str(fd.get('user_id'))))) fail('/ruang', 'Hanya akun petugas yang bisa diubah dari sini');
  const { error } = await adminDb().auth.admin.updateUserById(str(fd.get('user_id')), { password });
  if (error) fail('/ruang', error.message);
  ok('/ruang', 'Password diganti');
}

export async function hapusPetugas(fd: FormData) {
  await requireAkses('ruang');
  if (!(await pastikanPetugas(str(fd.get('user_id'))))) fail('/ruang', 'Hanya akun petugas yang bisa dihapus dari sini');
  const { error } = await adminDb().auth.admin.deleteUser(str(fd.get('user_id')));
  if (error) fail('/ruang', error.message);
  ok('/ruang', 'Akun petugas dihapus');
}

// ---------- Massal ----------
const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// Buat banyak ruang sekaligus dari pola: awalan + nomor berurutan. Kode yang sudah ada dilewati.
export async function buatRuangMassal(fd: FormData): Promise<FormState> {
  await requireAkses('ruang');
  const pola = {
    prefix: str(fd.get('prefix')), mulai: Number(str(fd.get('mulai')) || 1), jumlah: Number(str(fd.get('jumlah'))),
    digit: Number(str(fd.get('digit')) || 0), pola: str(fd.get('pola')) || 'Ruang {no}',
  };
  const e = cekPola(pola);
  if (e) return gagal(e);
  const daftar = bangunRuang(pola);
  const db = adminDb();
  const { data: ada, error } = await db.from('ruang').select('kode_ruang').in('kode_ruang', daftar.map((r) => r.kode_ruang));
  if (error) return gagal(error.message);
  const sudah = new Set((ada ?? []).map((r: any) => String(r.kode_ruang).toLowerCase()));
  const baru = daftar.filter((r) => !sudah.has(r.kode_ruang.toLowerCase()));
  if (!baru.length) return gagal('Semua kode ruang itu sudah ada');
  for (const part of chunk(baru, 200)) {
    const { error: e2 } = await db.from('ruang').insert(part);
    if (e2) return gagal(e2.code === '23505' ? 'Ada kode ruang yang sudah dipakai' : e2.message);
  }
  revalidatePath('/', 'layout');
  const lewat = daftar.length - baru.length;
  return sukses(`${baru.length} ruang dibuat${lewat ? `, ${lewat} dilewati karena kodenya sudah ada` : ''}`, lewat > 0);
}

// Hapus banyak ruang. Akun petugas ruang tersebut ikut dihapus; siswa di ruang itu menjadi "belum ditentukan".
export async function hapusRuangMassal(fd: FormData): Promise<FormState> {
  await requireAkses('ruang');
  let ids: number[] = [];
  try { ids = (JSON.parse(str(fd.get('ids'))) as unknown[]).map(Number).filter((n) => Number.isInteger(n)); } catch { /* kosong */ }
  if (!ids.length) return gagal('Tidak ada ruang yang dipilih');
  const db = adminDb();

  const { data: petugas, error } = await db.from('users').select('id').eq('role', 'petugas').in('ruang_id', ids);
  if (error) return gagal(error.message);
  for (const p of petugas ?? []) {
    const { error: e1 } = await db.auth.admin.deleteUser(p.id);
    if (e1) return gagal(`Gagal menghapus akun petugas: ${e1.message}`);
  }
  for (const part of chunk(ids, 200)) {
    const { error: e2 } = await db.from('ruang').delete().in('id', part);
    if (e2) return gagal(e2.message);
  }
  revalidatePath('/', 'layout');
  const np = petugas?.length ?? 0;
  return sukses(`${ids.length} ruang dihapus${np ? `, ${np} akun petugas ikut dihapus` : ''}`);
}

// ---------- Akun petugas massal ----------
export type AkunBaru = { kode_ruang: string; nama: string; username: string; password: string };
export type HasilPetugasMassal = { ok: boolean; msg: string; warn?: boolean; akun?: AkunBaru[]; dilewati?: string[]; xlsx?: string };

const HURUF = 'abcdefghjkmnpqrstuvwxyz23456789'; // tanpa i, l, o, 0, 1 agar mudah dibaca
const sandiAcak = (n = 8) => Array.from({ length: n }, () => HURUF[randomInt(HURUF.length)]).join('');

// Satu klik untuk banyak ruang: username dari kode ruang, nama dari pola, password acak (atau sama).
// Ruang yang sudah punya petugas atau yang usernamenya sudah dipakai dilewati.
export async function buatPetugasMassal(fd: FormData): Promise<HasilPetugasMassal> {
  await requireAkses('ruang');
  let ids: number[] = [];
  try { ids = (JSON.parse(str(fd.get('ids'))) as unknown[]).map(Number).filter((n) => Number.isInteger(n)); } catch { /* kosong */ }
  if (!ids.length) return { ok: false, msg: 'Pilih minimal satu ruang' };
  const polaUser = str(fd.get('pola_username')).toLowerCase();
  const polaNama = str(fd.get('pola_nama')) || 'Petugas Ruang {no}';
  const sandiSama = str(fd.get('mode')) === 'sama' ? str(fd.get('password')) : null;
  if (!PENANDA_USERNAME.test(polaUser)) return { ok: false, msg: 'Pola username harus memuat {no}, {kode}, atau {urut} agar tiap ruang berbeda. Contoh: ruang{no}' };
  if (!POLA_USERNAME.test(polaUser.replace(/\{(no|kode|urut)\}/g, '0'))) return { ok: false, msg: 'Username hanya boleh huruf kecil, angka, titik, strip, underscore' };
  if (sandiSama !== null && sandiSama.length < 6) return { ok: false, msg: 'Password minimal 6 karakter' };

  const db = adminDb();
  const [ruangR, adaR] = await Promise.all([
    db.from('ruang').select('id,kode_ruang').in('id', ids).order('kode_ruang'),
    db.from('users').select('ruang_id,username'), // tabel kecil: cukup ambil semua untuk cek bentrok username
  ]);
  if (ruangR.error) return { ok: false, msg: ruangR.error.message };
  const sudahPunya = new Set((adaR.data ?? []).filter((u: any) => u.ruang_id != null).map((u: any) => u.ruang_id as number));
  const dipakai = new Set((adaR.data ?? []).map((u: any) => String(u.username)));

  const dilewati: string[] = [];
  const antrean: (AkunBaru & { ruang_id: number })[] = [];
  const urutan = [...(ruangR.data ?? [])].sort((a: any, b: any) => String(a.kode_ruang).localeCompare(String(b.kode_ruang), undefined, { numeric: true }));
  for (const [i, r] of urutan.entries()) {
    const username = usernameDariPola(polaUser, r.kode_ruang, i + 1);
    if (sudahPunya.has(r.id)) { dilewati.push(`${r.kode_ruang} (sudah punya petugas)`); continue; }
    if (!username || username.length > 50 || dipakai.has(username)) { dilewati.push(`${r.kode_ruang} (${username ? `username ${username} sudah dipakai atau tidak valid` : 'kode ruang tidak mengandung angka untuk {no}'})`); continue; }
    dipakai.add(username);
    antrean.push({ ruang_id: r.id, kode_ruang: r.kode_ruang, nama: namaDariPola(polaNama, r.kode_ruang, i + 1).slice(0, 100), username, password: sandiSama ?? sandiAcak() });
  }

  const akun: AkunBaru[] = [];
  for (const grup of chunk(antrean, 5)) { // 5 sekaligus: cukup cepat tanpa membanjiri Supabase Auth
    const hasil = await Promise.all(grup.map(async (a) => {
      const { data: created, error } = await db.auth.admin.createUser({ email: `${a.username}@absensi.local`, password: a.password, email_confirm: true });
      if (error || !created.user) return `${a.kode_ruang} (${error?.message ?? 'gagal membuat akun'})`;
      const { error: e2 } = await db.from('users').insert({ id: created.user.id, username: a.username, nama: a.nama, role: 'petugas', ruang_id: a.ruang_id });
      if (e2) { await db.auth.admin.deleteUser(created.user.id); return `${a.kode_ruang} (${e2.message})`; }
      akun.push({ kode_ruang: a.kode_ruang, nama: a.nama, username: a.username, password: a.password });
      return null;
    }));
    hasil.forEach((h) => h && dilewati.push(h));
  }
  revalidatePath('/', 'layout');
  if (!akun.length) return { ok: false, msg: `Tidak ada akun yang dibuat. ${dilewati.slice(0, 3).join('; ')}`, dilewati };

  akun.sort((a, b) => a.kode_ruang.localeCompare(b.kode_ruang, undefined, { numeric: true }));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Akun petugas', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Ruang', key: 'kode_ruang', width: 12, style: { numFmt: '@' } },
    { header: 'Nama petugas', key: 'nama', width: 28, style: { numFmt: '@' } },
    { header: 'Username', key: 'username', width: 22, style: { numFmt: '@' } },
    { header: 'Password', key: 'password', width: 16, style: { numFmt: '@' } },
  ];
  akun.forEach((a) => ws.addRow(a));
  ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17614A' } }; });
  const xlsx = Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');

  return { ok: true, warn: dilewati.length > 0, msg: `${akun.length} akun petugas dibuat${dilewati.length ? `, ${dilewati.length} dilewati` : ''}`, akun, dilewati, xlsx };
}
