// Menu Kartu ujian: tipe, nilai bawaan, dan singkatan keterangan. Murni (tanpa server), dipakai server dan komponen client.
// Ukuran kartu 54 x 86 mm (ID card standar CR80, tegak). Ukuran kertas: F4 215 x 330 mm, 9 kartu per lembar (3 kolom x 3 baris). Ukuran kartu ada di globals.css (.kartu-*).
export const KARTU_PER_HALAMAN = 9;
export const MAKS_KOP_BYTE = 1024 * 1024; // gambar kop maksimal 1 MB
export const URL_KOP_BAWAAN = '/logo-madrasah.png';
export const URL_KOP = '/api/kartu-ujian/kop';

export type PengaturanKartu = {
  jenis_ujian: string;   // judul besar, contoh "Ujian Tengah Semester 1"
  madrasah: string;      // madrasah penyelenggara
  tahun_ajaran: string;  // contoh "1447-1448 H" (awalan "Tahun Ajaran :" ditambahkan otomatis)
  ada_kop: boolean;      // true = pakai gambar kop unggahan; false = logo madrasah bawaan
  versi: string;         // penanda versi kop (agar browser memuat ulang gambar setelah diganti)
};
export const PENGATURAN_BAWAAN: PengaturanKartu = {
  jenis_ujian: 'Ujian Tengah Semester 1', madrasah: 'Madrasah Al Falahiyah Langitan', tahun_ajaran: '1447-1448 H', ada_kop: false, versi: '0',
};

// Singkatan keterangan di kartu (terjaring apa), kunci = kode jenis di tabel persyaratan_jenis. Ubah di sini bila ingin singkatan lain.
// Beda dengan SINGKATAN_JENIS di lib/persyaratan.ts (dipakai tabel dashboard) karena kartu memakai singkatan dari contoh kartu madrasah.
export const SINGKATAN_KARTU: Record<string, string> = {
  absen_10: 'AB',
  absen_semen: 'SMN',
  tasmi: 'TAS',
  taftisy: 'TAF',
  tathbiq: 'TAT',
  syahriyah: 'SYAH',
  administrasi: 'ADM',
};
export const singkatKartu = (kode: string, nama: string) =>
  SINGKATAN_KARTU[kode] ?? (nama.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '?');

export type KetKartu = { kode: string; singkatan: string; nama: string; lengkap: boolean };
export type DataKartu = {
  no_induk: string; nama: string; kelas: string; ruang: string; gelombang: string;
  no_ujian: string; no_bangku: string; ket: KetKartu[];
};

// Nilai filter tingkat untuk kelas yang tingkatnya tidak terbaca dari teksnya (bukan angka / romawi di depan)
export const TINGKAT_LAIN = 'lain';
export type ParamKartu = { tingkat?: string; kelas?: string; ruang?: string; gel?: string; asrama?: string; maks?: string };
export const bacaParamKartu = (sp: ParamKartu) => ({
  tingkat: /^\d{1,2}$/.test(sp.tingkat ?? '') || sp.tingkat === TINGKAT_LAIN ? String(sp.tingkat) : '', // angka tingkat (7, 8, 9, ...) atau 'lain' = tingkat tidak terbaca
  kelas: (sp.kelas ?? '').trim().slice(0, 30),
  asrama: (sp.asrama ?? '').trim().slice(0, 30),
  ruang: /^\d+$/.test(sp.ruang ?? '') ? String(sp.ruang) : '',
  gel: /^\d+$/.test(sp.gel ?? '') ? String(sp.gel) : '',
});
export type FilterKartu = ReturnType<typeof bacaParamKartu>;

// Ukuran huruf mengecil bila teks panjang agar tetap satu baris di kartu (jenis ujian dan nama).
export function ukuranHuruf(teks: string, dasar: number, batas: number, minimum: number): number {
  const lebih = teks.length - batas;
  return lebih <= 0 ? dasar : Math.max(minimum, Math.round((dasar - lebih * (dasar / (batas * 1.6))) * 10) / 10);
}

// Satu kartu beserta QR dan barcode-nya (SVG dari server), untuk pratinjau lembar di menu Kartu ujian
export type ItemKartu = { d: DataKartu; qr: string; bar: string };

// Lebar karakter huruf tebal sans-serif (metrik Arial Bold, per 1000 em). Dipakai memperkirakan lebar teks header supaya ukuran hurufnya pas.
// Calibri (font kartu bila ada) lebih sempit daripada Arial, jadi perkiraan ini aman: teks tidak akan lebih lebar dari area.
const LEBAR_HURUF = 'A722 B722 C722 D722 E667 F611 G778 H722 I278 J556 K722 L611 M833 N722 O778 P667 Q778 R722 S667 T611 U722 V667 W944 X667 Y667 Z611 ' +
  'a556 b611 c556 d611 e556 f333 g611 h611 i278 j278 k556 l278 m889 n611 o611 p611 q611 r389 s556 t333 u611 v556 w778 x556 y556 z500';
const PETA_LEBAR = new Map(LEBAR_HURUF.split(' ').map((x) => [x[0], Number(x.slice(1)) / 1000] as const));
const lebarEm = (c: string): number => PETA_LEBAR.get(c) ?? (c === ' ' ? 0.278 : c >= '0' && c <= '9' ? 0.556 : 0.4);

// Ukuran huruf (pt) agar teks muat satu baris selebar lebarMm: kecil bila teks panjang, tidak lebih kecil dari minimum
// skala = pengali lebar huruf terhadap Arial Bold (font sempit seperti Bebas Neue sekitar 0,62); rapat = jarak antar huruf (em).
// (bila masih terlalu panjang, teks turun ke baris berikutnya lewat CSS, tidak pernah terpotong). Dipakai untuk semua teks header kartu.
export function ukuranMuat(teks: string, lebarMm: number, dasar: number, minimum: number, kapital = false, rapat = 0, skala = 1): number {
  const t = kapital ? teks.toUpperCase() : teks;
  const em = Array.from(t).reduce((n, c) => n + lebarEm(c) * skala + rapat, 0);
  if (em <= 0) return dasar;
  const lebarPt = (lebarMm / 25.4) * 72;
  const pas = Math.floor((lebarPt / em) * 0.97 * 10) / 10;
  return Math.max(minimum, Math.min(dasar, pas));
}
