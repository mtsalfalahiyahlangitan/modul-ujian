import { bersih, chunk, petaHeader } from './siswa-import';
import { HARI_WAJIB_SEMEN, parseHari, parsePersen, type CfgJumlah } from './persyaratan';
import { fetchAll } from './util';
import { kunciCatatan, parseNominal } from './administrasi';
import type { adminDb } from './supabase/admin';
import type { BarisPratinjau, Ringkasan } from './siswa-types';

type Db = ReturnType<typeof adminDb>;

// =====================================================================
// UPLOAD ABSEN 10% (oleh TU) — dicocokkan dengan No. Induk di data siswa.
// Kolom file: NO, INDUK, NAMA, ASRAMA, KELAS, JUMLAH %   (hanya INDUK dan JUMLAH % yang dipakai)
// File = daftar lengkap siswa terjaring. Siswa yang sudah ada di daftar dan masih ada di file
// tetap memakai status lengkap-nya; siswa yang tidak ada lagi di file dihapus dari daftar.
// =====================================================================
const DEF_ABSEN10 = {
  no_induk: ['induk', 'no induk', 'nis', 'nomor induk', 'noinduk'],
  nama: ['nama', 'nama siswa'],
  asrama: ['asrama'],
  kelas: ['kelas', 'kelas madrasah'],
  persen: ['jumlah %', 'jumlah', 'persen', 'persentase', '%', 'prosentase'],
};
export type BarisAbsen10Valid = { siswa_id: number; no_induk: string; persen: number };

export async function validasiAbsen10(rows: string[][], db: Db, jenisId: number) {
  const idx = petaHeader(rows[0] ?? [], DEF_ABSEN10);
  if (idx.no_induk < 0) throw new Error('Judul kolom "INDUK" (atau "No. Induk" / "NIS") tidak ditemukan di baris pertama');
  if (idx.persen < 0) throw new Error('Judul kolom "JUMLAH %" (atau "Persen") tidak ditemukan di baris pertama');
  const ambil = (r: string[], k: keyof typeof idx) => (idx[k] >= 0 ? bersih(r[idx[k]]) : '');
  const mentah = rows.slice(1).map((r, i) => ({ baris: i + 2, r })).filter(({ r }) => r.some((x) => String(x ?? '').trim()));

  const siswa = new Map<string, { id: number; nama: string; kelas: string; asrama: string }>();
  const noInduk = [...new Set(mentah.map((m) => ambil(m.r, 'no_induk')).filter(Boolean))];
  for (const part of chunk(noInduk, 300)) {
    const { data } = await db.from('siswa').select('id,no_induk,nama,kelas,asrama').in('no_induk', part);
    (data ?? []).forEach((s: any) => siswa.set(s.no_induk, { id: s.id, nama: s.nama, kelas: s.kelas, asrama: s.asrama }));
  }
  const sudahAda = new Set<number>(
    (await fetchAll((from, to) => db.from('persyaratan_terjaring').select('siswa_id').eq('jenis_id', jenisId).range(from, to))).map((x) => x.siswa_id as number),
  );

  const lihat = new Set<string>();
  const ditemukan = new Set<number>();
  const pratinjau: BarisPratinjau[] = [];
  const valid: BarisAbsen10Valid[] = [];
  for (const { baris, r } of mentah) {
    const no_induk = ambil(r, 'no_induk'), rawPersen = ambil(r, 'persen');
    const s = siswa.get(no_induk);
    const pesan: string[] = [];
    if (!no_induk) pesan.push('No. induk kosong');
    else if (!s) pesan.push('No. induk tidak ditemukan di data siswa');
    if (no_induk) { if (lihat.has(no_induk)) pesan.push('No. induk dobel di file'); lihat.add(no_induk); }
    const persen = parsePersen(rawPersen);
    if (persen === null) pesan.push(rawPersen ? `Persentase tidak valid: "${rawPersen}"` : 'Persentase kosong');
    if (s) ditemukan.add(s.id);
    const status = pesan.length ? 'error' : sudahAda.has(s!.id) ? 'perbarui' : 'baru';
    pratinjau.push({
      baris, status, pesan: pesan.join('; '), no_induk,
      nama: s?.nama ?? ambil(r, 'nama'), kelas: s?.kelas ?? ambil(r, 'kelas'), asrama: s?.asrama ?? ambil(r, 'asrama'),
      persen: persen === null ? rawPersen : `${persen}%`,
    });
    if (status !== 'error' && s && persen !== null) valid.push({ siswa_id: s.id, no_induk, persen });
  }

  const hapusId = [...sudahAda].filter((id) => !ditemukan.has(id));
  const def = [
    { status: 'baru', label: 'Baru', cls: 'badge-green' },
    { status: 'perbarui', label: 'Diperbarui', cls: 'badge-blue' },
    { status: 'error', label: 'Error', cls: 'badge-red' },
  ];
  const ringkasan: Ringkasan[] = def
    .map((d) => ({ ...d, jumlah: pratinjau.filter((r) => r.status === d.status).length }))
    .filter((d) => d.jumlah > 0 || d.status === 'error');
  if (hapusId.length) ringkasan.push({ status: 'hapus', label: 'Dihapus dari daftar (tidak ada di file)', cls: 'badge-amber', jumlah: hapusId.length });
  return { pratinjau, valid, ringkasan, hapusId };
}

// =====================================================================
// UPLOAD ABSEN SEMEN (oleh TU) — dicocokkan dengan No. Induk di data siswa.
// Kolom file: INDUK, NAMA, ASRAMA, KELAS, S, I, A   (hanya INDUK, S, I, A yang dipakai)
// S = sakit, I = izin, A = alpha (tidak hadir tanpa udzur). Sel kosong dibaca 0.
// File = daftar lengkap siswa terjaring; aturan simpan/hapus sama seperti Absen 10%.
// =====================================================================
const DEF_SEMEN = {
  no_induk: ['induk', 'no induk', 'nis', 'nomor induk', 'noinduk'],
  nama: ['nama', 'nama siswa'],
  asrama: ['asrama'],
  kelas: ['kelas', 'kelas madrasah'],
  sakit: ['s', 'sakit'],
  izin: ['i', 'izin', 'ijin'],
  alpha: ['a', 'alpha', 'alpa'],
};
export type BarisSemenValid = { siswa_id: number; no_induk: string; sakit: number; izin: number; alpha: number };

export async function validasiAbsenSemen(rows: string[][], db: Db, jenisId: number) {
  const idx = petaHeader(rows[0] ?? [], DEF_SEMEN);
  if (idx.no_induk < 0) throw new Error('Judul kolom \"INDUK\" (atau \"No. Induk\" / \"NIS\") tidak ditemukan di baris pertama');
  if (idx.alpha < 0) throw new Error('Judul kolom \"A\" (alpha) tidak ditemukan di baris pertama');
  const ambil = (r: string[], k: keyof typeof idx) => (idx[k] >= 0 ? bersih(r[idx[k]]) : '');
  const mentah = rows.slice(1).map((r, i) => ({ baris: i + 2, r })).filter(({ r }) => r.some((x) => String(x ?? '').trim()));

  const siswa = new Map<string, { id: number; nama: string; kelas: string; asrama: string }>();
  const noInduk = [...new Set(mentah.map((m) => ambil(m.r, 'no_induk')).filter(Boolean))];
  for (const part of chunk(noInduk, 300)) {
    const { data } = await db.from('siswa').select('id,no_induk,nama,kelas,asrama').in('no_induk', part);
    (data ?? []).forEach((s: any) => siswa.set(s.no_induk, { id: s.id, nama: s.nama, kelas: s.kelas, asrama: s.asrama }));
  }
  const sudahAda = new Set<number>(
    (await fetchAll((from, to) => db.from('persyaratan_terjaring').select('siswa_id').eq('jenis_id', jenisId).range(from, to))).map((x) => x.siswa_id as number),
  );

  const lihat = new Set<string>();
  const ditemukan = new Set<number>();
  const pratinjau: BarisPratinjau[] = [];
  const valid: BarisSemenValid[] = [];
  for (const { baris, r } of mentah) {
    const no_induk = ambil(r, 'no_induk');
    const s = siswa.get(no_induk);
    const pesan: string[] = [];
    if (!no_induk) pesan.push('No. induk kosong');
    else if (!s) pesan.push('No. induk tidak ditemukan di data siswa');
    if (no_induk) { if (lihat.has(no_induk)) pesan.push('No. induk dobel di file'); lihat.add(no_induk); }

    const mentahHari = { sakit: ambil(r, 'sakit'), izin: ambil(r, 'izin'), alpha: ambil(r, 'alpha') };
    const hari = { sakit: parseHari(mentahHari.sakit), izin: parseHari(mentahHari.izin), alpha: parseHari(mentahHari.alpha) };
    (['sakit', 'izin', 'alpha'] as const).forEach((k) => { if (hari[k] === null) pesan.push(`Kolom ${k === 'sakit' ? 'S' : k === 'izin' ? 'I' : 'A'} bukan angka: \"${mentahHari[k]}\"`); });
    const total = (hari.sakit ?? 0) + (hari.izin ?? 0) + (hari.alpha ?? 0);
    if (hari.sakit !== null && hari.izin !== null && hari.alpha !== null) {
      if (total === 0) pesan.push('S, I, dan A kosong (tidak ada ketidakhadiran)');
      else if (total > HARI_WAJIB_SEMEN) pesan.push(`Total S+I+A (${total}) melebihi ${HARI_WAJIB_SEMEN} hari`);
    }
    if (s) ditemukan.add(s.id);
    const status = pesan.length ? 'error' : sudahAda.has(s!.id) ? 'perbarui' : 'baru';
    pratinjau.push({
      baris, status, pesan: pesan.join('; '), no_induk,
      nama: s?.nama ?? ambil(r, 'nama'), kelas: s?.kelas ?? ambil(r, 'kelas'), asrama: s?.asrama ?? ambil(r, 'asrama'),
      sakit: hari.sakit ?? mentahHari.sakit, izin: hari.izin ?? mentahHari.izin, alpha: hari.alpha ?? mentahHari.alpha,
    });
    if (status !== 'error' && s) valid.push({ siswa_id: s.id, no_induk, sakit: hari.sakit!, izin: hari.izin!, alpha: hari.alpha! });
  }

  const hapusId = [...sudahAda].filter((id) => !ditemukan.has(id));
  const def = [
    { status: 'baru', label: 'Baru', cls: 'badge-green' },
    { status: 'perbarui', label: 'Diperbarui', cls: 'badge-blue' },
    { status: 'error', label: 'Error', cls: 'badge-red' },
  ];
  const ringkasan: Ringkasan[] = def
    .map((d) => ({ ...d, jumlah: pratinjau.filter((r) => r.status === d.status).length }))
    .filter((d) => d.jumlah > 0 || d.status === 'error');
  if (hapusId.length) ringkasan.push({ status: 'hapus', label: 'Dihapus dari daftar (tidak ada di file)', cls: 'badge-amber', jumlah: hapusId.length });
  return { pratinjau, valid, ringkasan, hapusId };
}

// =====================================================================
// UPLOAD DAFTAR NAMA SAJA (Tasmi', dst) — hanya kolom INDUK yang dipakai, dicocokkan dengan No. Induk di data siswa.
// File = daftar lengkap siswa terjaring; aturan simpan/hapus sama seperti Absen 10%.
// =====================================================================
const DEF_DAFTAR = {
  no_induk: ['induk', 'no induk', 'nis', 'nomor induk', 'noinduk'],
  nama: ['nama', 'nama siswa'],
  asrama: ['asrama'],
  kelas: ['kelas', 'kelas madrasah'],
};
export type BarisDaftarValid = { siswa_id: number; no_induk: string };

export async function validasiDaftarNama(rows: string[][], db: Db, jenisId: number) {
  const idx = petaHeader(rows[0] ?? [], DEF_DAFTAR);
  if (idx.no_induk < 0) throw new Error('Judul kolom "INDUK" (atau "No. Induk" / "NIS") tidak ditemukan di baris pertama');
  const ambil = (r: string[], k: keyof typeof idx) => (idx[k] >= 0 ? bersih(r[idx[k]]) : '');
  const mentah = rows.slice(1).map((r, i) => ({ baris: i + 2, r })).filter(({ r }) => r.some((x) => String(x ?? '').trim()));

  const siswa = new Map<string, { id: number; nama: string; kelas: string; asrama: string }>();
  const noInduk = [...new Set(mentah.map((m) => ambil(m.r, 'no_induk')).filter(Boolean))];
  for (const part of chunk(noInduk, 300)) {
    const { data } = await db.from('siswa').select('id,no_induk,nama,kelas,asrama').in('no_induk', part);
    (data ?? []).forEach((s: any) => siswa.set(s.no_induk, { id: s.id, nama: s.nama, kelas: s.kelas, asrama: s.asrama }));
  }
  const sudahAda = new Set<number>(
    (await fetchAll((from, to) => db.from('persyaratan_terjaring').select('siswa_id').eq('jenis_id', jenisId).range(from, to))).map((x) => x.siswa_id as number),
  );

  const lihat = new Set<string>();
  const ditemukan = new Set<number>();
  const pratinjau: BarisPratinjau[] = [];
  const valid: BarisDaftarValid[] = [];
  for (const { baris, r } of mentah) {
    const no_induk = ambil(r, 'no_induk');
    const s = siswa.get(no_induk);
    const pesan: string[] = [];
    if (!no_induk) pesan.push('No. induk kosong');
    else if (!s) pesan.push('No. induk tidak ditemukan di data siswa');
    if (no_induk) { if (lihat.has(no_induk)) pesan.push('No. induk dobel di file'); lihat.add(no_induk); }
    if (s) ditemukan.add(s.id);
    const status = pesan.length ? 'error' : sudahAda.has(s!.id) ? 'perbarui' : 'baru';
    pratinjau.push({
      baris, status, pesan: pesan.join('; '), no_induk,
      nama: s?.nama ?? ambil(r, 'nama'), kelas: s?.kelas ?? ambil(r, 'kelas'), asrama: s?.asrama ?? ambil(r, 'asrama'),
    });
    if (status !== 'error' && s) valid.push({ siswa_id: s.id, no_induk });
  }

  const hapusId = [...sudahAda].filter((id) => !ditemukan.has(id));
  const def = [
    { status: 'baru', label: 'Baru', cls: 'badge-green' },
    { status: 'perbarui', label: 'Diperbarui', cls: 'badge-blue' },
    { status: 'error', label: 'Error', cls: 'badge-red' },
  ];
  const ringkasan: Ringkasan[] = def
    .map((d) => ({ ...d, jumlah: pratinjau.filter((r) => r.status === d.status).length }))
    .filter((d) => d.jumlah > 0 || d.status === 'error');
  if (hapusId.length) ringkasan.push({ status: 'hapus', label: 'Dihapus dari daftar (tidak ada di file)', cls: 'badge-amber', jumlah: hapusId.length });
  return { pratinjau, valid, ringkasan, hapusId };
}

// =====================================================================
// UPLOAD TAFTISY (oleh TU) — satu sheet per tingkat, pelajaran = kolom setelah INDUK/NAMA/ASRAMA/KELAS (dinamis).
// Sel "X" = pelajaran lengkap, kosong = belum. Siswa dicocokkan dengan No. Induk di data siswa.
// Siswa yang semua pelajarannya sudah X dan belum ada di daftar tidak dimasukkan (tidak terjaring).
// Siswa yang tidak ada lagi di file dihapus dari daftar. Ceklis yang diubah pengampu dipertahankan.
// =====================================================================
const DEF_TAFTISY = {
  no_induk: ['induk', 'no induk', 'nis', 'nomor induk', 'noinduk'],
  nama: ['nama', 'nama siswa'],
  asrama: ['asrama'],
  kelas: ['kelas', 'kelas madrasah'],
};
export type PelajaranValid = { nama: string; urutan: number; x: boolean };
export type BarisTaftisyValid = { siswa_id: number; no_induk: string; tingkat: string; pelajaran: PelajaranValid[] };

export async function validasiTaftisy(sheets: { nama: string; rows: string[][] }[], db: Db, jenisId: number) {
  if (!sheets.length) throw new Error('File tidak berisi data');
  type Mentah = { sheet: string; baris: number; r: string[]; idx: Record<keyof typeof DEF_TAFTISY, number>; pel: { nama: string; kol: number }[] };
  const mentah: Mentah[] = [];
  for (const sh of sheets) {
    const head = sh.rows[0] ?? [];
    const idx = petaHeader(head, DEF_TAFTISY);
    if (idx.no_induk < 0) throw new Error(`Sheet "${sh.nama}": judul kolom "INDUK" (atau "No. Induk" / "NIS") tidak ditemukan di baris pertama`);
    const dipakai = new Set(Object.values(idx).filter((i) => i >= 0));
    const pel: { nama: string; kol: number }[] = [];
    head.forEach((h, kol) => {
      const nama = String(h ?? '').replace(/\s+/g, ' ').trim();
      if (dipakai.has(kol) || !nama) return;
      pel.push({ nama, kol });
    });
    if (!pel.length) throw new Error(`Sheet "${sh.nama}": tidak ada kolom pelajaran (kolom setelah KELAS)`);
    const ganda = pel.find((p, i) => pel.findIndex((q) => q.nama.toLowerCase() === p.nama.toLowerCase()) !== i);
    if (ganda) throw new Error(`Sheet "${sh.nama}": kolom pelajaran "${ganda.nama}" muncul lebih dari satu kali`);
    sh.rows.slice(1).forEach((r, i) => { if (r.some((x) => String(x ?? '').trim())) mentah.push({ sheet: sh.nama, baris: i + 2, r, idx, pel }); });
  }
  const ambil = (m: Mentah, k: keyof typeof DEF_TAFTISY) => (m.idx[k] >= 0 ? bersih(m.r[m.idx[k]]) : '');

  const siswa = new Map<string, { id: number; nama: string; kelas: string; asrama: string }>();
  const noInduk = [...new Set(mentah.map((m) => ambil(m, 'no_induk')).filter(Boolean))];
  for (const part of chunk(noInduk, 300)) {
    const { data } = await db.from('siswa').select('id,no_induk,nama,kelas,asrama').in('no_induk', part);
    (data ?? []).forEach((s: any) => siswa.set(s.no_induk, { id: s.id, nama: s.nama, kelas: s.kelas, asrama: s.asrama }));
  }
  const sudahAda = new Set<number>(
    (await fetchAll((from, to) => db.from('persyaratan_terjaring').select('siswa_id').eq('jenis_id', jenisId).order('siswa_id').range(from, to))).map((x) => x.siswa_id as number),
  );

  const lihat = new Set<string>();
  const ditemukan = new Set<number>();
  const pratinjau: BarisPratinjau[] = [];
  const valid: BarisTaftisyValid[] = [];
  for (const m of mentah) {
    const no_induk = ambil(m, 'no_induk');
    const s = siswa.get(no_induk);
    const pesan: string[] = [];
    if (!no_induk) pesan.push('No. induk kosong');
    else if (!s) pesan.push('No. induk tidak ditemukan di data siswa');
    if (no_induk) { if (lihat.has(no_induk)) pesan.push('No. induk dobel di file'); lihat.add(no_induk); }

    const pelajaran: PelajaranValid[] = m.pel.map((p, urutan) => {
      const v = bersih(m.r[p.kol]).toUpperCase();
      if (v && v !== 'X') pesan.push(`Kolom ${p.nama}: nilai "${v}" tidak dikenali (isi X atau kosongkan)`);
      return { nama: p.nama, urutan, x: v === 'X' };
    });
    const belum = pelajaran.filter((p) => !p.x).map((p) => p.nama);
    if (s) ditemukan.add(s.id);
    const status = pesan.length ? 'error' : !belum.length && !sudahAda.has(s!.id) ? 'lengkap' : sudahAda.has(s!.id) ? 'perbarui' : 'baru';
    pratinjau.push({
      baris: m.baris, status, pesan: pesan.join('; '), no_induk, sheet: m.sheet,
      nama: s?.nama ?? ambil(m, 'nama'), kelas: s?.kelas ?? ambil(m, 'kelas'), asrama: s?.asrama ?? ambil(m, 'asrama'),
      belum: belum.length ? `${belum.length}/${pelajaran.length}: ${belum.join(', ')}` : '',
    });
    if ((status === 'baru' || status === 'perbarui') && s) valid.push({ siswa_id: s.id, no_induk, tingkat: m.sheet, pelajaran });
  }

  const hapusId = [...sudahAda].filter((id) => !ditemukan.has(id));
  const def = [
    { status: 'baru', label: 'Baru', cls: 'badge-green' },
    { status: 'perbarui', label: 'Diperbarui', cls: 'badge-blue' },
    { status: 'lengkap', label: 'Sudah lengkap semua (tidak terjaring)', cls: 'badge-gray' },
    { status: 'error', label: 'Error', cls: 'badge-red' },
  ];
  const ringkasan: Ringkasan[] = def
    .map((d) => ({ ...d, jumlah: pratinjau.filter((r) => r.status === d.status).length }))
    .filter((d) => d.jumlah > 0 || d.status === 'error');
  if (hapusId.length) ringkasan.push({ status: 'hapus', label: 'Dihapus dari daftar (tidak ada di file)', cls: 'badge-amber', jumlah: hapusId.length });
  return { pratinjau, valid, ringkasan, hapusId };
}

// =====================================================================
// UPLOAD JUMLAH vs TARGET (Tathbiq: jumlah maqro'; Syahriyah: jumlah bulan terbayar) — kolom: INDUK + kolom jumlah (cfg.kolom).
// Kolom jumlah kosong dibaca 0. Terjaring ditentukan target minimal di Dashboard: jumlah < target = terjaring.
// Data mentah disimpan (cfg.tabel); daftar terjaring dihitung dari data itu.
// =====================================================================
export type BarisJumlahValid = { siswa_id: number; no_induk: string; jumlah: number };

export async function validasiJumlah(cfg: CfgJumlah, rows: string[][], db: Db, target: number) {
  const def = {
    no_induk: ['induk', 'no induk', 'nis', 'nomor induk', 'noinduk'],
    nama: ['nama', 'nama siswa'],
    asrama: ['asrama'],
    kelas: ['kelas', 'kelas madrasah'],
    jumlah: cfg.kolom,
  };
  const idx = petaHeader(rows[0] ?? [], def);
  if (idx.no_induk < 0) throw new Error('Judul kolom "INDUK" (atau "No. Induk" / "NIS") tidak ditemukan di baris pertama');
  if (idx.jumlah < 0) throw new Error(`Judul kolom "${cfg.judulKolom}" tidak ditemukan di baris pertama`);
  const ambil = (r: string[], k: keyof typeof idx) => (idx[k] >= 0 ? bersih(r[idx[k]]) : '');
  const mentah = rows.slice(1).map((r, i) => ({ baris: i + 2, r })).filter(({ r }) => r.some((x) => String(x ?? '').trim()));

  const siswa = new Map<string, { id: number; nama: string; kelas: string; asrama: string }>();
  const noInduk = [...new Set(mentah.map((m) => ambil(m.r, 'no_induk')).filter(Boolean))];
  for (const part of chunk(noInduk, 300)) {
    const { data } = await db.from('siswa').select('id,no_induk,nama,kelas,asrama').in('no_induk', part);
    (data ?? []).forEach((s: any) => siswa.set(s.no_induk, { id: s.id, nama: s.nama, kelas: s.kelas, asrama: s.asrama }));
  }
  const sudahAda = new Set<number>(
    (await fetchAll((from, to) => db.from(cfg.tabel).select('siswa_id').order('siswa_id').range(from, to))).map((x) => x.siswa_id as number),
  );

  const lihat = new Set<string>();
  const ditemukan = new Set<number>();
  const pratinjau: BarisPratinjau[] = [];
  const valid: BarisJumlahValid[] = [];
  let terjaring = 0, lolos = 0;
  for (const { baris, r } of mentah) {
    const no_induk = ambil(r, 'no_induk'), rawJumlah = ambil(r, 'jumlah');
    const s = siswa.get(no_induk);
    const pesan: string[] = [];
    if (!no_induk) pesan.push('No. induk kosong');
    else if (!s) pesan.push('No. induk tidak ditemukan di data siswa');
    if (no_induk) { if (lihat.has(no_induk)) pesan.push('No. induk dobel di file'); lihat.add(no_induk); }
    const jumlah = rawJumlah === '' ? 0 : /^\d{1,3}$/.test(rawJumlah) ? Number(rawJumlah) : null;
    if (jumlah === null) pesan.push(`Jumlah bukan bilangan bulat: "${rawJumlah}"`);
    if (s) ditemukan.add(s.id);
    const status = pesan.length ? 'error' : sudahAda.has(s!.id) ? 'perbarui' : 'baru';
    if (status !== 'error') { if (jumlah! < target) terjaring++; else lolos++; }
    pratinjau.push({
      baris, status, pesan: pesan.join('; '), no_induk,
      nama: s?.nama ?? ambil(r, 'nama'), kelas: s?.kelas ?? ambil(r, 'kelas'), asrama: s?.asrama ?? ambil(r, 'asrama'),
      jumlah: jumlah === null ? rawJumlah : jumlah,
      hasil: status === 'error' ? '' : jumlah! < target ? 'Terjaring' : 'Lolos',
    });
    if (status !== 'error' && s && jumlah !== null) valid.push({ siswa_id: s.id, no_induk, jumlah });
  }

  const hapusId = [...sudahAda].filter((id) => !ditemukan.has(id));
  const dasar = [
    { status: 'baru', label: 'Baru', cls: 'badge-green' },
    { status: 'perbarui', label: 'Diperbarui', cls: 'badge-blue' },
    { status: 'error', label: 'Error', cls: 'badge-red' },
  ];
  const ringkasan: Ringkasan[] = dasar
    .map((d) => ({ ...d, jumlah: pratinjau.filter((r) => r.status === d.status).length }))
    .filter((d) => d.jumlah > 0 || d.status === 'error');
  ringkasan.push({ status: 'terjaring', label: `Akan terjaring (kurang dari ${target} ${cfg.satuan})`, cls: 'badge-amber', jumlah: terjaring });
  ringkasan.push({ status: 'lolos', label: `Lolos (${target} ${cfg.satuan} atau lebih)`, cls: 'badge-gray', jumlah: lolos });
  if (hapusId.length) ringkasan.push({ status: 'hapus', label: 'Data dihapus (tidak ada di file)', cls: 'badge-amber', jumlah: hapusId.length });
  return { pratinjau, valid, ringkasan, hapusId };
}

// =====================================================================
// UPLOAD ADMINISTRASI (oleh TU) — satu sheet, kolom: INDUK, NAMA, ASRAMA, KELAS, JENIS/HUTANG, NOMINAL
// (hanya INDUK, JENIS/HUTANG, NOMINAL yang dipakai). Siswa dicocokkan dengan No. Induk di data siswa.
// - No. Induk BOLEH muncul di beberapa baris dengan keterangan berbeda: tiap baris = satu catatan milik siswa itu.
// - Siswa yang No. Induk-nya terisi SELALU terjaring, walau JENIS/HUTANG dan NOMINAL kosong (mis. dipanggil ke kantor).
// - Bila salah satu baris siswa error, SEMUA baris siswa itu dilewati agar catatannya tidak tersimpan setengah-setengah.
// - File = daftar lengkap. Siswa yang tidak ada lagi di file dihapus dari daftar. Ceklis pengampu dipertahankan saat upload ulang.
// =====================================================================
const DEF_ADMIN = {
  no_induk: ['induk', 'no induk', 'nis', 'nomor induk', 'noinduk'],
  nama: ['nama', 'nama siswa'],
  asrama: ['asrama'],
  kelas: ['kelas', 'kelas madrasah'],
  keterangan: ['jenis hutang', 'jenis hutang catatan', 'jenis catatan', 'jenis', 'hutang', 'catatan', 'keterangan'],
  nominal: ['nominal', 'jumlah', 'nilai', 'rp'],
};
export type BarisAdminValid = { siswa_id: number; no_induk: string; keterangan: string; nominal: number | null; kunci: string; urutan: number };
const namaFile = (v: string) => (v.startsWith('#') ? '' : v); // "#N/A" dari rumus Excel bukan nama

export async function validasiAdministrasi(rows: string[][], db: Db, jenisId: number) {
  const idx = petaHeader(rows[0] ?? [], DEF_ADMIN);
  if (idx.no_induk < 0) throw new Error('Judul kolom "INDUK" (atau "No. Induk" / "NIS") tidak ditemukan di baris pertama');
  if (idx.keterangan < 0) throw new Error('Judul kolom "JENIS/HUTANG" (atau "Keterangan" / "Catatan") tidak ditemukan di baris pertama');
  const ambil = (r: string[], k: keyof typeof idx) => (idx[k] >= 0 ? bersih(r[idx[k]]) : '');
  const mentah = rows.slice(1).map((r, i) => ({ baris: i + 2, r })).filter(({ r }) => r.some((x) => String(x ?? '').trim()));

  const siswa = new Map<string, { id: number; nama: string; kelas: string; asrama: string }>();
  const noInduk = [...new Set(mentah.map((m) => ambil(m.r, 'no_induk')).filter(Boolean))];
  for (const part of chunk(noInduk, 300)) {
    const { data } = await db.from('siswa').select('id,no_induk,nama,kelas,asrama').in('no_induk', part);
    (data ?? []).forEach((s: any) => siswa.set(s.no_induk, { id: s.id, nama: s.nama, kelas: s.kelas, asrama: s.asrama }));
  }
  const sudahAda = new Set<number>(
    (await fetchAll((from, to) => db.from('persyaratan_terjaring').select('siswa_id').eq('jenis_id', jenisId).order('siswa_id').range(from, to))).map((x) => x.siswa_id as number),
  );

  // Pass 1: periksa tiap baris
  type Baris = { baris: number; no_induk: string; s?: { id: number; nama: string; kelas: string; asrama: string }; keterangan: string; nominal: number | null; rawNominal: string; pesan: string[]; r: string[] };
  const daftar: Baris[] = mentah.map(({ baris, r }) => {
    const no_induk = ambil(r, 'no_induk'), keterangan = ambil(r, 'keterangan').replace(/\s+/g, ' ');
    const rawNominal = ambil(r, 'nominal');
    const s = siswa.get(no_induk);
    const pesan: string[] = [];
    if (!no_induk) pesan.push('No. induk kosong');
    else if (!s) pesan.push('No. induk tidak ditemukan di data siswa');
    const nominal = parseNominal(rawNominal);
    if (nominal === undefined) pesan.push(`Nominal tidak valid: "${rawNominal}"`);
    return { baris, no_induk, s, keterangan, nominal: nominal ?? null, rawNominal, pesan, r };
  });
  const siswaBermasalah = new Set<number>(daftar.filter((d) => d.pesan.length && d.s).map((d) => d.s!.id));

  // Pass 2: baris lain milik siswa bermasalah ikut dilewati; susun catatan valid per siswa
  const ditemukan = new Set<number>();
  const kemunculan = new Map<string, number>();
  const urutanSiswa = new Map<number, number>();
  const pratinjau: BarisPratinjau[] = [];
  const valid: BarisAdminValid[] = [];
  for (const d of daftar) {
    const pesan = [...d.pesan];
    if (!pesan.length && d.s && siswaBermasalah.has(d.s.id)) pesan.push('Baris lain siswa ini error, semua baris siswa dilewati');
    if (d.s) ditemukan.add(d.s.id);
    const status = pesan.length ? 'error' : sudahAda.has(d.s!.id) ? 'perbarui' : 'baru';
    pratinjau.push({
      baris: d.baris, status, pesan: pesan.join('; '), no_induk: d.no_induk,
      nama: d.s?.nama ?? namaFile(ambil(d.r, 'nama')), kelas: d.s?.kelas ?? namaFile(ambil(d.r, 'kelas')), asrama: d.s?.asrama ?? namaFile(ambil(d.r, 'asrama')),
      keterangan: d.keterangan || '(kosong, siswa tetap terjaring)', nominal: d.nominal ?? d.rawNominal,
    });
    if (status === 'error' || !d.s) continue;
    const dasar = d.keterangan.toLowerCase();
    const kk = `${d.s.id}|${dasar}`;
    const ke = (kemunculan.get(kk) ?? 0) + 1; kemunculan.set(kk, ke);
    const urutan = urutanSiswa.get(d.s.id) ?? 0; urutanSiswa.set(d.s.id, urutan + 1);
    valid.push({ siswa_id: d.s.id, no_induk: d.no_induk, keterangan: d.keterangan, nominal: d.nominal, kunci: kunciCatatan(d.keterangan, ke), urutan });
  }

  const hapusId = [...sudahAda].filter((id) => !ditemukan.has(id));
  const def = [
    { status: 'baru', label: 'Baru', cls: 'badge-green' },
    { status: 'perbarui', label: 'Diperbarui', cls: 'badge-blue' },
    { status: 'error', label: 'Error', cls: 'badge-red' },
  ];
  const ringkasan: Ringkasan[] = def
    .map((d) => ({ ...d, jumlah: pratinjau.filter((r) => r.status === d.status).length }))
    .filter((d) => d.jumlah > 0 || d.status === 'error');
  const jumlahSiswa = new Set(valid.map((v) => v.siswa_id)).size;
  ringkasan.push({ status: 'siswa', label: 'Siswa terjaring (satu siswa bisa punya beberapa catatan)', cls: 'badge-gray', jumlah: jumlahSiswa });
  if (hapusId.length) ringkasan.push({ status: 'hapus', label: 'Dihapus dari daftar (tidak ada di file)', cls: 'badge-amber', jumlah: hapusId.length });
  return { pratinjau, valid, ringkasan, hapusId };
}
