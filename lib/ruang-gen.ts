// Pembuat daftar ruang massal. Dipakai pop up (pratinjau langsung) dan server (penyimpanan), agar hasilnya identik.
export type PolaRuang = { prefix: string; mulai: number; jumlah: number; digit: number; pola: string };
export const MAKS_RUANG = 200;

export function bangunRuang(p: PolaRuang): { kode_ruang: string; nama_ruang: string }[] {
  const out: { kode_ruang: string; nama_ruang: string }[] = [];
  for (let i = 0; i < p.jumlah; i++) {
    const no = String(p.mulai + i).padStart(p.digit, '0');
    out.push({ kode_ruang: `${p.prefix}${no}`, nama_ruang: (p.pola || 'Ruang {no}').replaceAll('{no}', no) });
  }
  return out;
}

// Pesan error, atau null bila pola valid
export function cekPola(p: PolaRuang): string | null {
  if (!Number.isInteger(p.jumlah) || p.jumlah < 1 || p.jumlah > MAKS_RUANG) return `Jumlah ruang harus 1 sampai ${MAKS_RUANG}`;
  if (!Number.isInteger(p.mulai) || p.mulai < 0) return 'Nomor awal tidak valid';
  if (!Number.isInteger(p.digit) || p.digit < 0 || p.digit > 4) return 'Jumlah digit 0 sampai 4';
  const daftar = bangunRuang(p);
  if (daftar.some((r) => r.kode_ruang.length > 20)) return 'Kode ruang maksimal 20 karakter';
  if (daftar.some((r) => r.nama_ruang.length > 100)) return 'Nama ruang maksimal 100 karakter';
  return null;
}

// Nomor dari kode ruang: angka di ujung kode, tanpa nol di depan. "R-001" -> "1", "R-12" -> "12". Tanpa angka -> "".
export function nomorDariKode(kode: string) {
  const m = kode.match(/(\d+)\D*$/);
  return m ? m[1].replace(/^0+(?=\d)/, '') : '';
}

// Username petugas dari pola. Penanda yang dikenal:
//   {no}   nomor dari kode ruang tanpa nol depan  ("R-001" -> 1)   contoh: ruang{no}  -> ruang1
//   {kode} kode ruang apa adanya, huruf kecil      ("R-001" -> r001) contoh: p-{kode}  -> p-r001
//   {urut} urutan 1, 2, 3, ... dari ruang terpilih                   contoh: petugas{urut}
// Mengembalikan "" bila {no} dipakai tetapi kode ruang tidak mengandung angka.
export const PENANDA_USERNAME = /\{(no|kode|urut)\}/;
export function usernameDariPola(pola: string, kode: string, urut: number) {
  const no = nomorDariKode(kode);
  const p = pola.toLowerCase();
  if (p.includes('{no}') && !no) return '';
  return p
    .replaceAll('{no}', no)
    .replaceAll('{kode}', kode.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .replaceAll('{urut}', String(urut));
}
// Nama petugas dari pola. Penanda sama seperti username, tetapi hasilnya tidak diubah ke huruf kecil:
//   {no} nomor ruang tanpa nol depan, {kode} kode ruang apa adanya ("R-001"), {urut} urutan 1, 2, 3, ...
export function namaDariPola(pola: string, kode: string, urut: number) {
  return (pola || 'Petugas Ruang {no}')
    .replace(/\{no\}/gi, nomorDariKode(kode))
    .replace(/\{kode\}/gi, kode)
    .replace(/\{urut\}/gi, String(urut));
}
export const POLA_USERNAME = /^[a-z0-9._-]+$/;
