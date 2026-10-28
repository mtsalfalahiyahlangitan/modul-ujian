// Jenis penjaringan persyaratan ujian. Murni (tanpa server), dipakai nav, hak akses, dan halaman.
// slug = alamat halaman /persyaratan/<slug>, sekaligus kunci sub menu di hak akses.
// kode = kode jenis yang sama di tabel persyaratan_jenis.
// Tambah / ubah / urutkan jenis cukup di sini.
export const JENIS_PERSYARATAN = [
  { slug: 'absen-10', kode: 'absen_10', nama: 'Absen 10%' },
  { slug: 'absen-semen', kode: 'absen_semen', nama: 'Absen Semen' },
  { slug: 'tasmi', kode: 'tasmi', nama: "Tasmi'" },
  { slug: 'taftisy', kode: 'taftisy', nama: 'Taftisy' },
  { slug: 'tathbiq', kode: 'tathbiq', nama: 'Tathbiq' },
  { slug: 'syahriyah', kode: 'syahriyah', nama: 'Syahriyah' },
  { slug: 'administrasi', kode: 'administrasi', nama: 'Administrasi' },
] as const;
