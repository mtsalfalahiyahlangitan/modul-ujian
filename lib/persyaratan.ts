// Menu Persyaratan ujian: tipe data dan pemformat tampilan rincian penjaringan.
export type JenisPersyaratan = { id: number; kode: string; nama: string; urutan: number; data_terakhir: string | null; target_minimal?: number | null };
export type Terjaring = { jenis_id: number; alasan: string | null; detail: unknown; lengkap: boolean };
export type BarisPersyaratan = {
  id: number; no_induk: string; nama: string; kelas: string; asrama: string; kamar: string | null;
  ruang: string | null; terjaring: Terjaring[];
};
export const PER_HALAMAN = 50;
export const KODE_ABSEN_10 = 'absen_10';
export const KODE_ABSEN_SEMEN = 'absen_semen';
export const KODE_TASMI = 'tasmi';
export const KODE_TAFTISY = 'taftisy';
export const KODE_TATHBIQ = 'tathbiq';
export const KODE_SYAHRIYAH = 'syahriyah';
export const KODE_ADMINISTRASI = 'administrasi';
// Jenis yang sudah punya importer di Dashboard persyaratan (kode jenis di tabel persyaratan_jenis)
export const KODE_BISA_UPLOAD = new Set([KODE_ABSEN_10, KODE_ABSEN_SEMEN, KODE_TASMI, KODE_TAFTISY, KODE_TATHBIQ, KODE_SYAHRIYAH, KODE_ADMINISTRASI]);
// Jenis yang cukup diklik "Lengkap" oleh pengampu. Taftisy dan Administrasi tidak termasuk: statusnya dari ceklis tiap pelajaran / catatan.
export const KODE_LENGKAP_LANGSUNG = new Set([KODE_ABSEN_10, KODE_ABSEN_SEMEN, KODE_TASMI, KODE_TATHBIQ, KODE_SYAHRIYAH]);
export const HARI_WAJIB_SEMEN = 7;

// Singkatan tiap jenis persyaratan (dipakai di pill dashboard, halaman cetak, dan Excel). Warna pill ada di globals.css (.pill-jenis[data-k]).
export const SINGKATAN_JENIS: Record<string, string> = {
  [KODE_ABSEN_10]: 'ABS',
  [KODE_ABSEN_SEMEN]: 'SMN',
  [KODE_TASMI]: 'TAS',
  [KODE_TAFTISY]: 'TAF',
  [KODE_TATHBIQ]: 'TATH',
  [KODE_SYAHRIYAH]: 'SYAH',
  [KODE_ADMINISTRASI]: 'ADM',
};
// Jenis baru yang belum didaftarkan: pakai 3 huruf pertama namanya
export const singkatJenis = (kode: string, nama: string) =>
  SINGKATAN_JENIS[kode] ?? (nama.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '?');

// Jumlah hari dari sel Excel. Kosong / "-" = 0. Bukan bilangan bulat >= 0 -> null.
export function parseHari(raw: string): number | null {
  const t = String(raw ?? '').trim();
  if (!t || t === '-') return 0;
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

// Persentase dari sel Excel -> angka persen. "81%" -> 81, 0.81 -> 81, 13,5% -> 13.5. Nilai <= 1 dianggap pecahan (0.1 = 10%).
// null bila kosong / bukan angka / di luar 0-100.
export function parsePersen(raw: string): number | null {
  const t = String(raw ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  const n = parseFloat(t.replace('%', ''));
  if (!Number.isFinite(n) || !/^[0-9.]+%?$/.test(t)) return null;
  const persen = t.endsWith('%') ? n : n <= 1 ? n * 100 : n;
  const r = Math.round(persen * 100) / 100;
  return r > 0 && r <= 100 ? r : null;
}

// "jumlah_alpa" -> "Jumlah alpa"
export function labelKunci(k: string) {
  const t = k.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function formatNilai(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  if (Array.isArray(v)) return v.length ? v.map(formatNilai).join(', ') : '-';
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${labelKunci(k)}: ${formatNilai(x)}`).join('; ');
  return String(v);
}

// Rincian bebas (jsonb) -> baris label/nilai. Bentuk rincian berbeda tiap jenis, jadi dibaca secara generik.
export function barisDetail(detail: unknown): { label: string; nilai: string }[] {
  if (detail === null || detail === undefined || detail === '') return [];
  if (Array.isArray(detail)) return detail.map((x, i) => ({ label: `${i + 1}`, nilai: formatNilai(x) }));
  if (typeof detail === 'object') {
    return Object.entries(detail as Record<string, unknown>).map(([k, v]) => ({
      label: labelKunci(k), nilai: typeof v === 'number' && /persen/i.test(k) ? `${v}%` : formatNilai(v),
    }));
  }
  return [{ label: 'Keterangan', nilai: formatNilai(detail) }];
}

// Jenis "jumlah dibanding target minimal" (Tathbiq, Syahriyah): TU mengunggah jumlah per siswa, target minimal diisi di Dashboard.
// Jumlah < target = terjaring. Data mentah disimpan di tabel sendiri agar daftar terjaring bisa dihitung ulang saat target diubah.
export type CfgJumlah = {
  kode: string; nama: string; tabel: string; satuan: string;
  kunci: string;            // nama field jumlah di detail (tampil di Dashboard dan halaman pengampu)
  kolom: string[];          // nama judul kolom jumlah yang dikenali di file (sudah dinormalkan huruf kecil)
  judulKolom: string;       // judul kolom untuk petunjuk
  alasan: (jumlah: number, target: number) => string;
};
export const CFG_JUMLAH: Record<string, CfgJumlah> = {
  [KODE_TATHBIQ]: {
    kode: KODE_TATHBIQ, nama: 'Tathbiq', tabel: 'tathbiq_setoran', satuan: "maqro'", kunci: 'jumlah_maqro',
    kolom: ['jumlah', 'jumlah maqro', "jumlah maqro'", "maqro'", 'maqro', 'maqra', 'setoran'], judulKolom: 'JUMLAH',
    alasan: (n, t) => `Setoran ${n} maqro' dari minimal ${t}`,
  },
  [KODE_SYAHRIYAH]: {
    kode: KODE_SYAHRIYAH, nama: 'Syahriyah', tabel: 'syahriyah_bayar', satuan: 'bulan', kunci: 'bulan_terbayar',
    kolom: ['jumlah terbayar', 'terbayar', 'jumlah', 'jumlah bulan', 'bulan', 'dibayar', 'jumlah bayar'], judulKolom: 'JUMLAH TERBAYAR',
    alasan: (n, t) => `Syahriyah terbayar ${n} bulan dari minimal ${t}`,
  },
};
