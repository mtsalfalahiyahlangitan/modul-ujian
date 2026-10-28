'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAkses, type Me } from '@/lib/auth';
import { lihatSemuaRuang } from '@/lib/akses';
import { adminDb } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { terapkanJadwal } from '@/lib/schedule';
import { cekDatang, cekPulang } from '@/lib/aturan';
import { fail, ok, num, str, tanggalHariIni, fetchAll, fmtJam } from '@/lib/util';
import type { ScanResult } from '@/lib/scan-types';

const GAP_DETIK = 10; // tap kedua dalam 10 detik dianggap tap ganda, bukan pulang

type C = { me: Me; db: ReturnType<typeof adminDb>; today: string; now: Date; admin: boolean; ruangId: number };
type Hasil = { ok: boolean; msg: string; kind: ScanResult['kind'] };
const err = (msg: string): Hasil => ({ ok: false, msg, kind: 'error' });

async function konteks(fd: FormData): Promise<C | null> {
  const me = await requireAkses('absen');
  // Petugas SELALU dikunci ke ruang akunnya, apa pun yang dikirim form
  const ruangId = me.role === 'petugas' ? me.ruang_id : num(fd.get('ruang_id'));
  if (!ruangId) return null;
  return { me, db: adminDb(), today: tanggalHariIni(), now: new Date(), admin: lihatSemuaRuang(me), ruangId };
}

async function muatGelombang(c: C) {
  const { data } = await c.db.from('gelombang').select('*');
  const { gels, jadwal } = terapkanJadwal(data ?? [], c.now);
  return { gelMap: new Map<number, any>(gels.map((g: any) => [g.id, g])), jadwal };
}

async function absenHariIni(c: C, siswaId: number, gelId: number) {
  const { data } = await c.db.from('absensi').select('*').eq('siswa_id', siswaId).eq('gelombang_id', gelId).eq('tanggal_ujian', c.today).maybeSingle();
  return data;
}

// id siswa yang ikut gelombang tertentu di ruang ini
async function siswaDiGelombang(c: C, gelId: number) {
  const rows = await fetchAll((a, b) =>
    c.db.from('siswa_gelombang').select('siswa_id, siswa!inner(ruang_id)')
      .eq('gelombang_id', gelId).eq('siswa.ruang_id', c.ruangId).order('siswa_id').range(a, b));
  return rows.map((r) => ({ id: r.siswa_id as number }));
}

// Siswa bisa punya beberapa gelombang (mis. 1 & 3). Pilih yang sesuai untuk tap saat ini:
//  1) sedang hadir di gelombang yang masih berjalan -> tap pulang
//  2) gelombang yang saat ini boleh dimasuki -> tap masuk
//  3) hadir tapi lupa tap pulang di gelombang yang sudah selesai -> catat pulang
//  4) selain itu -> tolak dengan alasan gelombang terdekat yang belum selesai
function pilihGelombang(c: C, cands: any[], absBy: Map<number, any>, jadwal: any): { g?: any; h?: Hasil } {
  const aktif = cands.filter((g) => g.status !== 'dibatalkan');
  const belum = aktif.filter((g) => !absBy.get(g.id)?.waktu_pulang);
  if (!aktif.length) return { h: err('Semua gelombang siswa ini dibatalkan') };
  if (!belum.length) return { h: { ok: true, kind: 'info', msg: `Sudah masuk & pulang di semua gelombangnya (${aktif.map((g) => g.nama_gelombang).join(', ')})` } };
  const hadir = (g: any) => absBy.get(g.id)?.status_kehadiran === 'hadir';
  let g = belum.find((x) => hadir(x) && x.status !== 'selesai')
    ?? belum.find((x) => !hadir(x) && !cekDatang(x, jadwal[x.id], c.now, false))
    ?? belum.find((x) => hadir(x));
  if (!g && c.admin) g = belum[0]; // admin boleh override
  if (g) return { g };
  const target = belum.find((x) => x.status !== 'selesai') ?? belum[0];
  return { h: err(cekDatang(target, jadwal[target.id], c.now, false) ?? 'Tidak ada gelombang yang bisa diproses') };
}

// ---------- inti pencatatan ----------
async function catatMasuk(c: C, s: any, g: any, jd: any, status: 'hadir' | 'tidak_hadir', ket: string | null): Promise<Hasil> {
  const ex = await absenHariIni(c, s.id, g.id);
  if (ex?.waktu_pulang) return err('Sudah tercatat pulang');
  if (ex?.status_kehadiran === 'hadir' && status === 'hadir') return { ok: true, kind: 'info', msg: `Sudah masuk (${fmtJam(ex.waktu_datang)})` };
  if (status === 'hadir') {
    const e = cekDatang(g, jd, c.now, c.admin);
    if (e) return err(e);
  } else if (!c.admin && !['berlangsung', 'selesai'].includes(g.status)) {
    return err(`${g.nama_gelombang} belum berlangsung`);
  }
  const now = c.now.toISOString(); // timestamp dari server
  const { error } = await c.db.from('absensi').upsert({
    siswa_id: s.id, gelombang_id: g.id, tanggal_ujian: c.today,
    status_kehadiran: status, waktu_datang: status === 'hadir' ? now : null, waktu_pulang: null,
    keterangan: ket, petugas_id: c.me.id, updated_at: now,
  }, { onConflict: 'siswa_id,gelombang_id,tanggal_ujian' });
  if (error) return err(error.message);
  await audit(c.me.id, status === 'hadir' ? 'absen_masuk' : 'tidak_hadir', { siswa_id: s.id, gelombang_id: g.id });
  return status === 'hadir'
    ? { ok: true, kind: 'masuk', msg: `${fmtJam(now)}${c.admin && cekDatang(g, jd, c.now, false) ? ' (override admin)' : ''}` }
    : { ok: true, kind: 'info', msg: 'Ditandai tidak hadir' };
}

async function catatPulang(c: C, s: any, g: any, jd: any): Promise<Hasil> {
  const ex = await absenHariIni(c, s.id, g.id);
  if (!ex || ex.status_kehadiran !== 'hadir') return err('Belum absen masuk');
  if (ex.waktu_pulang) return { ok: true, kind: 'info', msg: `Sudah pulang (${fmtJam(ex.waktu_pulang)})` };
  if (ex.waktu_datang && c.now.getTime() - new Date(ex.waktu_datang).getTime() < GAP_DETIK * 1000)
    return { ok: true, kind: 'info', msg: `Tap ganda diabaikan (masuk ${fmtJam(ex.waktu_datang, true)})` };
  const e = cekPulang(g, jd, c.now, c.admin);
  if (e) return err(e);
  const now = c.now.toISOString();
  const { data } = await c.db.from('absensi').update({ waktu_pulang: now, updated_at: now, petugas_id: c.me.id })
    .eq('id', ex.id).is('waktu_pulang', null).select('id');
  if (!data?.length) return err('Gagal mencatat pulang, coba lagi');
  await audit(c.me.id, 'absen_pulang', { siswa_id: s.id, gelombang_id: g.id });
  return { ok: true, kind: 'pulang', msg: `${fmtJam(now)}${c.admin && cekPulang(g, jd, c.now, false) ? ' (override admin)' : ''}` };
}

// ---------- SCAN: tap 1x = masuk, tap 2x = pulang ----------
export async function scanAbsen(_prev: ScanResult | null, fd: FormData): Promise<ScanResult> {
  const t = Date.now();
  const res = (h: Hasil): ScanResult => ({ ...h, t });
  const kode = str(fd.get('kode'));
  if (!kode) return res(err('Kode kosong'));
  const c = await konteks(fd);
  if (!c) return res(err('Ruang tidak valid'));

  // Cari siswa: no. induk dulu, lalu UID RFID
  const sel = 'id,nama,no_induk,ruang_id,ruang(kode_ruang),siswa_gelombang(gelombang_id)';
  let s: any = (await c.db.from('siswa').select(sel).eq('no_induk', kode).maybeSingle()).data;
  if (!s) s = (await c.db.from('siswa').select(sel).eq('rfid', kode.toUpperCase()).maybeSingle()).data;
  if (!s) return res(err(`Kode "${kode}" tidak dikenal`));

  if (s.ruang_id !== c.ruangId) {
    return res(err(c.admin ? `${s.nama} terdaftar di ruang ${s.ruang?.kode_ruang ?? '-'}, bukan ruang ini` : 'Siswa tidak terdaftar di ruang ini'));
  }
  const gelIds: number[] = (s.siswa_gelombang ?? []).map((x: any) => x.gelombang_id);
  if (!gelIds.length) return res(err(`${s.nama} belum punya gelombang`));

  const { gelMap, jadwal } = await muatGelombang(c);
  const cands = gelIds.map((id) => gelMap.get(id)).filter(Boolean).sort((x, y) => x.urutan - y.urutan);
  const { data: absRows } = await c.db.from('absensi').select('*').eq('siswa_id', s.id).eq('tanggal_ujian', c.today).in('gelombang_id', gelIds);
  const absBy = new Map<number, any>((absRows ?? []).map((x: any) => [x.gelombang_id, x]));

  const pil = pilihGelombang(c, cands, absBy, jadwal);
  if (!pil.g) return res({ ...pil.h!, msg: `${s.nama} (${s.no_induk}): ${pil.h!.msg}` });
  const g = pil.g;
  const jd = jadwal[g.id];
  const ex = absBy.get(g.id);

  let h: Hasil;
  if (!ex || ex.status_kehadiran === 'tidak_hadir') h = await catatMasuk(c, s, g, jd, 'hadir', null);
  else if (!ex.waktu_pulang) h = await catatPulang(c, s, g, jd);
  else h = { ok: true, kind: 'info', msg: `Sudah masuk (${fmtJam(ex.waktu_datang)}) & pulang (${fmtJam(ex.waktu_pulang)})` };

  revalidatePath('/absen');
  return res({ ...h, msg: `${s.nama} (${s.no_induk}), ${g.nama_gelombang}: ${h.msg}` });
}

// ---------- tombol per siswa: hadir | tidak_hadir | pulang | batal ----------
export async function aksiSiswa(fd: FormData) {
  const c = await konteks(fd);
  const gelFilter = num(fd.get('gel'));
  const base = '/absen';
  if (!c) fail(base, 'Ruang tidak valid');
  const back = `${base}?ruang=${c!.ruangId}${gelFilter ? `&gel=${gelFilter}` : ''}`;

  const sid = num(fd.get('siswa_id'));
  const gid = num(fd.get('gel_id'));
  if (!sid || !gid) fail(back, 'Data tidak lengkap');
  const { data: s } = await c!.db.from('siswa').select('*').eq('id', sid).eq('ruang_id', c!.ruangId).maybeSingle();
  const { data: tautan } = await c!.db.from('siswa_gelombang').select('gelombang_id').eq('siswa_id', sid).eq('gelombang_id', gid).maybeSingle();
  if (!s || !tautan) fail(back, 'Siswa tidak terdaftar di ruang/gelombang ini');
  const { gelMap, jadwal } = await muatGelombang(c!);
  const g = gelMap.get(gid as number);
  if (!g) fail(back, 'Gelombang tidak ditemukan');
  const jd = jadwal[g.id];
  const aksi = str(fd.get('aksi'));

  let h: Hasil;
  if (aksi === 'hadir') h = await catatMasuk(c!, s, g, jd, 'hadir', str(fd.get('keterangan')) || null);
  else if (aksi === 'tidak_hadir') h = await catatMasuk(c!, s, g, jd, 'tidak_hadir', str(fd.get('keterangan')) || null);
  else if (aksi === 'pulang') h = await catatPulang(c!, s, g, jd);
  else if (aksi === 'batal') {
    const ex = await absenHariIni(c!, s.id, g.id);
    if (ex?.waktu_pulang && !c!.admin) h = err('Siswa sudah pulang; hanya admin yang bisa membatalkan');
    else {
      await c!.db.from('absensi').delete().eq('siswa_id', s.id).eq('gelombang_id', g.id).eq('tanggal_ujian', c!.today);
      await audit(c!.me.id, 'batal_absen', { siswa_id: s.id, gelombang_id: g.id });
      h = { ok: true, kind: 'info', msg: 'Dibatalkan' };
    }
  } else h = err('Aksi tidak dikenal');

  if (!h.ok) fail(back, `${s.nama}: ${h.msg}`);
  redirect(back);
}

// ---------- massal per gelombang (aturan waktu tetap berlaku) ----------
export async function tandaiSemuaHadir(fd: FormData) {
  const c = await konteks(fd);
  if (!c) fail('/absen', 'Ruang tidak valid');
  const gelId = num(fd.get('gel_id'));
  const back = `/absen?ruang=${c!.ruangId}&gel=${gelId}`;
  const { gelMap, jadwal } = await muatGelombang(c!);
  const g = gelMap.get(gelId as number);
  if (!g) fail(back, 'Gelombang tidak ditemukan');
  const e = cekDatang(g, jadwal[g.id], c!.now, c!.admin);
  if (e) fail(back, e);

  const siswa = await siswaDiGelombang(c!, g.id);
  const ex = await fetchAll((a, b) => c!.db.from('absensi').select('siswa_id').eq('gelombang_id', g.id).eq('tanggal_ujian', c!.today).order('id').range(a, b));
  const sudah = new Set(ex.map((x) => x.siswa_id));
  const now = c!.now.toISOString();
  const rows = siswa.filter((s) => !sudah.has(s.id)).map((s) => ({
    siswa_id: s.id, gelombang_id: g.id, tanggal_ujian: c!.today, status_kehadiran: 'hadir',
    waktu_datang: now, petugas_id: c!.me.id, updated_at: now,
  }));
  if (rows.length) {
    const { error } = await c!.db.from('absensi').upsert(rows, { onConflict: 'siswa_id,gelombang_id,tanggal_ujian', ignoreDuplicates: true });
    if (error) fail(back, error.message);
  }
  await audit(c!.me.id, 'absen_masuk_massal', { ruang_id: c!.ruangId, gelombang_id: g.id, jumlah: rows.length });
  ok(back, `${rows.length} siswa ditandai hadir`);
}

export async function tandaiSemuaPulang(fd: FormData) {
  const c = await konteks(fd);
  if (!c) fail('/absen', 'Ruang tidak valid');
  const gelId = num(fd.get('gel_id'));
  const back = `/absen?ruang=${c!.ruangId}&gel=${gelId}`;
  const { gelMap, jadwal } = await muatGelombang(c!);
  const g = gelMap.get(gelId as number);
  if (!g) fail(back, 'Gelombang tidak ditemukan');
  const e = cekPulang(g, jadwal[g.id], c!.now, c!.admin);
  if (e) fail(back, e);

  const siswa = await siswaDiGelombang(c!, g.id);
  const ids = siswa.map((s) => s.id);
  let n = 0;
  if (ids.length) {
    const now = c!.now.toISOString();
    const { data } = await c!.db.from('absensi').update({ waktu_pulang: now, updated_at: now, petugas_id: c!.me.id })
      .in('siswa_id', ids).eq('gelombang_id', g.id).eq('tanggal_ujian', c!.today)
      .eq('status_kehadiran', 'hadir').is('waktu_pulang', null).select('id');
    n = data?.length ?? 0;
  }
  await audit(c!.me.id, 'absen_pulang_massal', { ruang_id: c!.ruangId, gelombang_id: g.id, jumlah: n });
  ok(back, `${n} siswa ditandai pulang`);
}
