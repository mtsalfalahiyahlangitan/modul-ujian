import ExcelJS from 'exceljs';
import { parseCsv } from './csv';
import { parseGelombang } from './gelombang-input';
import { fetchAll } from './util';
import type { adminDb } from './supabase/admin';
import type { BarisPratinjau, Ringkasan } from './siswa-types';

type Db = ReturnType<typeof adminDb>;
export const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const norm = (s: string) => String(s ?? '').toLowerCase().replace(/[._\-/]/g, ' ').replace(/\s+/g, ' ').trim();
// "-", "null", kosong dianggap tidak ada isi (file ekspor aplikasi madrasah memakai "-")
export const bersih = (v: unknown) => { const s = String(v ?? '').trim(); return s === '-' || s.toLowerCase() === 'null' ? '' : s; };

// ---------- Template data siswa (urutan = tabel Data siswa) ----------
export const KOLOM_SISWA = [
  { key: 'no_induk', judul: 'No. Induk', lebar: 16 },
  { key: 'nama', judul: 'Nama', lebar: 30 },
  { key: 'asrama', judul: 'Asrama', lebar: 16 },
  { key: 'kamar', judul: 'Kamar', lebar: 10 },
  { key: 'kelas', judul: 'Kelas', lebar: 10 },
  { key: 'rfid', judul: 'RFID', lebar: 18 },
] as const;

// ---------- Membaca file ----------
const MAKS_KOLOM = 40;

function teksSel(c: ExcelJS.Cell): string {
  const v: any = c.value;
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(c.text ?? '').trim();
}

function barisSheet(ws: ExcelJS.Worksheet): string[][] {
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const r: string[] = [];
    for (let i = 1; i <= MAKS_KOLOM; i++) r.push(teksSel(row.getCell(i)));
    out.push(r);
  });
  return out.filter((r) => r.some((x) => x !== ''));
}

// Semua sheet dalam satu file (dipakai upload yang datanya dipisah per sheet, mis. Taftisy per tingkat). Sheet kosong dilewati.
export async function bacaSemuaSheet(file: File): Promise<{ nama: string; rows: string[][] }[]> {
  const nama = file.name.toLowerCase();
  if (nama.endsWith('.csv') || file.type === 'text/csv') return [{ nama: 'Data', rows: parseCsv(await file.text()) }];
  if (!nama.endsWith('.xlsx')) throw new Error('Format file harus .xlsx (atau .csv)');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await file.arrayBuffer()) as any);
  return wb.worksheets.map((ws) => ({ nama: ws.name.trim(), rows: barisSheet(ws) })).filter((x) => x.rows.length > 0);
}

export async function bacaFile(file: File, sheetUtama?: string): Promise<string[][]> {
  const nama = file.name.toLowerCase();
  if (nama.endsWith('.csv') || file.type === 'text/csv') return parseCsv(await file.text());
  if (!nama.endsWith('.xlsx')) throw new Error('Format file harus .xlsx (atau .csv)');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await file.arrayBuffer()) as any);
  const ws = (sheetUtama && wb.getWorksheet(sheetUtama)) || wb.worksheets[0];
  if (!ws) throw new Error('File Excel tidak berisi sheet');
  const out: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const r: string[] = [];
    for (let i = 1; i <= MAKS_KOLOM; i++) r.push(teksSel(row.getCell(i)));
    out.push(r);
  });
  return out.filter((r) => r.some((x) => x !== ''));
}

// Cocokkan judul kolom -> indeks. Setiap kolom punya daftar nama yang dikenali (urutan = prioritas).
export function petaHeader<K extends string>(head: string[], def: Record<K, string[]>): Record<K, number> {
  const h = head.map(norm);
  const out = {} as Record<K, number>;
  for (const k of Object.keys(def) as K[]) {
    out[k] = -1;
    for (const nama of def[k]) { const i = h.indexOf(nama); if (i >= 0) { out[k] = i; break; } }
  }
  return out;
}

function ringkas(rows: BarisPratinjau[], def: { status: string; label: string; cls: string }[]): Ringkasan[] {
  return def.map((d) => ({ ...d, jumlah: rows.filter((r) => r.status === d.status).length })).filter((d) => d.jumlah > 0 || d.status === 'error');
}

// =====================================================================
// 1) UPLOAD DATA SISWA — format ekspor aplikasi madrasah (NIS, Nama, Kelas Madrasah, Asrama, Ruangan Asrama, RFID)
//    atau template aplikasi ini. Ruang & gelombang TIDAK disentuh.
// =====================================================================
const DEF_SISWA = {
  no_induk: ['no induk', 'nis', 'nomor induk', 'noinduk'],
  nama: ['nama', 'nama siswa'],
  asrama: ['asrama'],
  kamar: ['ruangan asrama', 'kamar asrama', 'kamar'],
  kelas: ['kelas madrasah', 'kelas'],
  rfid: ['rfid', 'uid'],
};
export type BarisSiswaValid = { no_induk: string; nama: string; asrama: string; kamar: string; kelas: string; rfid: string };

export const STATUS_SISWA = [
  { status: 'baru', label: 'Baru', cls: 'badge-green' },
  { status: 'perbarui', label: 'Diperbarui', cls: 'badge-blue' },
  { status: 'error', label: 'Error', cls: 'badge-red' },
];

export async function validasiSiswa(rows: string[][], db: Db) {
  const idx = petaHeader(rows[0] ?? [], DEF_SISWA);
  const hilang = (['no_induk', 'nama', 'asrama', 'kelas'] as const).filter((k) => idx[k] < 0);
  if (hilang.length) {
    const nama = { no_induk: 'NIS / No. Induk', nama: 'Nama', asrama: 'Asrama', kelas: 'Kelas Madrasah / Kelas' };
    throw new Error(`Judul kolom tidak ditemukan di baris pertama: ${hilang.map((k) => nama[k]).join(', ')}`);
  }
  const ambil = (r: string[], k: keyof typeof idx) => (idx[k] >= 0 ? bersih(r[idx[k]]) : '');
  const mentah = rows.slice(1).map((r, i) => ({ baris: i + 2, r })).filter(({ r }) => r.some((x) => String(x ?? '').trim()));

  const noInduk = [...new Set(mentah.map((m) => ambil(m.r, 'no_induk')).filter(Boolean))];
  const rfids = [...new Set(mentah.map((m) => ambil(m.r, 'rfid').toUpperCase()).filter(Boolean))];
  const ada = new Set<string>();
  const rfidMilik = new Map<string, string>();
  for (const part of chunk(noInduk, 300)) {
    const { data } = await db.from('siswa').select('no_induk').in('no_induk', part);
    (data ?? []).forEach((s: any) => ada.add(s.no_induk));
  }
  for (const part of chunk(rfids, 300)) {
    const { data } = await db.from('siswa').select('no_induk,rfid').in('rfid', part);
    (data ?? []).forEach((s: any) => rfidMilik.set(s.rfid, s.no_induk));
  }

  const lihatNo = new Set<string>(), lihatRfid = new Set<string>();
  const pratinjau: BarisPratinjau[] = [];
  const valid: BarisSiswaValid[] = [];
  for (const { baris, r } of mentah) {
    const no_induk = ambil(r, 'no_induk'), nama = ambil(r, 'nama'), asrama = ambil(r, 'asrama'),
      kamar = ambil(r, 'kamar'), kelas = ambil(r, 'kelas'), rfid = ambil(r, 'rfid').toUpperCase();
    const pesan: string[] = [];
    if (!no_induk || !nama || !asrama || !kelas) pesan.push('No. induk, nama, asrama, kelas wajib diisi');
    if (no_induk) { if (lihatNo.has(no_induk)) pesan.push('No. induk dobel di file'); lihatNo.add(no_induk); }
    if (rfid) {
      if (lihatRfid.has(rfid)) pesan.push('RFID dobel di file');
      lihatRfid.add(rfid);
      const pemilik = rfidMilik.get(rfid);
      if (pemilik && pemilik !== no_induk) pesan.push(`RFID sudah dipakai siswa ${pemilik}`);
    }
    const status = pesan.length ? 'error' : ada.has(no_induk) ? 'perbarui' : 'baru';
    pratinjau.push({ baris, status, pesan: pesan.join('; '), no_induk, nama, asrama, kamar, kelas, rfid });
    if (!pesan.length) valid.push({ no_induk, nama, asrama, kamar, kelas, rfid });
  }
  return { pratinjau, valid, ringkasan: ringkas(pratinjau, STATUS_SISWA) };
}

// =====================================================================
// 2) UPLOAD RUANG & GELOMBANG — dicocokkan dengan No. Induk yang sudah ada di data siswa
// =====================================================================
const DEF_RUANG = {
  no_induk: ['no induk', 'nis', 'nomor induk', 'noinduk'],
  ruang: ['kode ruang', 'ruang', 'koderuang', 'kode ruang ujian'],
  gelombang: ['gelombang', 'gel'],
  no_ujian: ['no ujian', 'nomor ujian', 'noujian'],
  no_bangku: ['no bangku', 'nomor bangku', 'nobangku', 'bangku'],
};
// no_ujian / no_bangku: null = kolom kosong di file = tidak diubah
export type BarisRuangValid = { id: number; no_induk: string; ruang_id: number | null; gelombang_ids: number[] | null; no_ujian: string | null; no_bangku: string | null };

export const STATUS_RUANG = [
  { status: 'ubah', label: 'Akan diperbarui', cls: 'badge-green' },
  { status: 'lewati', label: 'Tidak ada perubahan', cls: 'badge-gray' },
  { status: 'error', label: 'Error', cls: 'badge-red' },
];

export async function validasiRuang(rows: string[][], db: Db) {
  const idx = petaHeader(rows[0] ?? [], DEF_RUANG);
  if (idx.no_induk < 0) throw new Error('Judul kolom "No. Induk" (atau "NIS") tidak ditemukan di baris pertama');
  if (idx.ruang < 0 && idx.gelombang < 0 && idx.no_ujian < 0 && idx.no_bangku < 0) throw new Error('Judul kolom "Kode Ruang", "Gelombang", "No. Ujian", atau "No. Bangku" tidak ditemukan di baris pertama');
  const ambil = (r: string[], k: keyof typeof idx) => (idx[k] >= 0 ? bersih(r[idx[k]]) : '');
  const mentah = rows.slice(1).map((r, i) => ({ baris: i + 2, r })).filter(({ r }) => r.some((x) => String(x ?? '').trim()));

  const [ruangR, gelR] = await Promise.all([db.from('ruang').select('id,kode_ruang'), db.from('gelombang').select('id,urutan,nama_gelombang')]);
  const ruangMap = new Map((ruangR.data ?? []).map((r: any) => [String(r.kode_ruang).toLowerCase(), r.id as number]));
  const gels = gelR.data ?? [];

  const siswa = new Map<string, { id: number; nama: string; kelas: string }>();
  const noInduk = [...new Set(mentah.map((m) => ambil(m.r, 'no_induk')).filter(Boolean))];
  for (const part of chunk(noInduk, 300)) {
    const { data } = await db.from('siswa').select('id,no_induk,nama,kelas').in('no_induk', part);
    (data ?? []).forEach((s: any) => siswa.set(s.no_induk, { id: s.id, nama: s.nama, kelas: s.kelas }));
  }

  // Nomor ujian harus unik se-madrasah. Cek terhadap hasil AKHIR: nomor siswa lain di database, kecuali siswa yang nomornya
  // ikut diganti oleh file ini (jadi menukar nomor antar siswa lewat file tetap boleh).
  const diFile = new Map<string, string>(); // no_induk -> no ujian baru
  for (const { r } of mentah) { const n = ambil(r, 'no_induk'), u = ambil(r, 'no_ujian'); if (n && u) diFile.set(n, u); }
  const pemilikUjian = new Map<string, string>(); // no ujian -> no_induk (database, di luar siswa yang diganti file)
  if (diFile.size) {
    const semua = await fetchAll((a, b) => db.from('siswa').select('no_induk,no_ujian').not('no_ujian', 'is', null).order('id').range(a, b));
    for (const x of semua) if (!diFile.has(x.no_induk) && x.no_ujian) pemilikUjian.set(String(x.no_ujian), x.no_induk);
  }
  const hitungUjian = new Map<string, number>();
  diFile.forEach((u) => hitungUjian.set(u, (hitungUjian.get(u) ?? 0) + 1));

  const lihat = new Set<string>();
  const pratinjau: BarisPratinjau[] = [];
  const valid: BarisRuangValid[] = [];
  for (const { baris, r } of mentah) {
    const no_induk = ambil(r, 'no_induk'), kode = ambil(r, 'ruang'), gelRaw = ambil(r, 'gelombang');
    const no_ujian = ambil(r, 'no_ujian'), no_bangku = ambil(r, 'no_bangku');
    const s = siswa.get(no_induk);
    const pesan: string[] = [];
    if (!no_induk) pesan.push('No. induk kosong');
    else if (!s) pesan.push('No. induk tidak ditemukan di data siswa');
    if (no_induk) { if (lihat.has(no_induk)) pesan.push('No. induk dobel di file'); lihat.add(no_induk); }
    const ruang_id = kode ? ruangMap.get(kode.toLowerCase()) ?? null : null;
    if (kode && ruang_id == null) pesan.push(`Ruang "${kode}" tidak ada`);
    const pg = gelRaw ? parseGelombang(gelRaw, gels) : { ids: null as number[] | null, error: null };
    if (pg.error) pesan.push(`Gelombang: ${pg.error}`);
    if (no_ujian.length > 30) pesan.push('No. ujian maksimal 30 karakter');
    if (no_bangku.length > 20) pesan.push('No. bangku maksimal 20 karakter');
    if (no_ujian) {
      if ((hitungUjian.get(no_ujian) ?? 0) > 1) pesan.push(`No. ujian ${no_ujian} dobel di file`);
      const pemilik = pemilikUjian.get(no_ujian);
      if (pemilik && pemilik !== no_induk) pesan.push(`No. ujian ${no_ujian} sudah dipakai siswa ${pemilik}`);
    }
    const status = pesan.length ? 'error' : !kode && !gelRaw && !no_ujian && !no_bangku ? 'lewati' : 'ubah';
    pratinjau.push({ baris, status, pesan: pesan.join('; '), no_induk, nama: s?.nama ?? '', kelas: s?.kelas ?? '', kode_ruang: kode, gelombang: gelRaw, no_ujian, no_bangku });
    if (status === 'ubah' && s) valid.push({ id: s.id, no_induk, ruang_id, gelombang_ids: gelRaw ? pg.ids : null, no_ujian: no_ujian || null, no_bangku: no_bangku || null });
  }
  return { pratinjau, valid, ringkasan: ringkas(pratinjau, STATUS_RUANG) };
}
