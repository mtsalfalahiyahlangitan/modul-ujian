# Absensi Ujian — Kerangka Fungsional (Next.js + Supabase)

Tampilan sengaja polos; fokusnya agar alur bisa dicoba dulu.

## 1. Setup Supabase
1. Buat project di https://supabase.com
2. SQL Editor → jalankan `supabase/schema.sql`
3. (Opsional, untuk uji coba) jalankan `supabase/seed.sql` → 2 ruang, 3 gelombang, 36 siswa
4. Authentication → Users → **Add user**: email `admin@absensi.local`, isi password, centang *Auto Confirm User*
5. SQL Editor:
   ```sql
   insert into public.users (id, username, nama, role)
   select id, 'admin', 'Super Admin', 'super_admin'
   from auth.users where email = 'admin@absensi.local';
   ```
6. Settings → API: salin Project URL, anon key, dan service_role key

## 2. Jalankan
```bash
cp .env.example .env.local   # isi 3 nilai dari langkah 6
npm install
npm run dev                  # http://localhost:3000
```

## 3. Skenario uji alur
1. Login `admin` → menu **Ruang & Petugas** → buat akun petugas untuk R-01 (mis. `petugas1`) dan R-02
2. Menu **Gelombang** → isi jam "Waktu mulai" (WIB) tiap gelombang (atau hanya G1, sisanya dihitung otomatis). Status berubah otomatis mengikuti jam
3. Klik **Mulai Sekarang** pada Gelombang 1 → jadwal G2/G3 bergeser
4. Buka jendela incognito, login `petugas1` → menu **Absen** → ketik no. induk di kolom scan + Enter (tap 1x = masuk, tap 2x = pulang)
5. Petugas hanya melihat R-01 (coba ubah `?ruang=` di URL: tetap ditolak/dikunci ke ruangnya)
6. Atur di menu Gelombang: *Tap masuk maks. N menit setelah mulai* dan *Tap pulang dibuka N menit sebelum selesai*; coba tap di luar batas → ditolak
7. **Laporan** → Detail / Download Absen (CSV) / Download Semua Ruang

## RFID, Barcode & QR
- Kolom **RFID** ada di data siswa (opsional, unik). Cara mengisi cepat: buka form Edit siswa, klik kolom RFID, tap kartu pada reader USB (reader mengetik UID lalu Enter).
- Di menu **Absen** ada kolom *Scan*: tap kartu RFID, scan barcode, atau scan QR yang berisi **no. induk** (reader USB bekerja seperti keyboard). Sistem mencocokkan no. induk dulu, lalu RFID.
- Tombol **Scan dengan kamera** memakai kamera HP/laptop (butuh izin kamera dan HTTPS; `localhost` boleh).
- Sudah menjalankan schema lama? Jalankan `supabase/migration_rfid.sql`, `supabase/migration_waktu_tap.sql`, dan `supabase/migration_kamar.sql` (kolom kamar asrama).
- Data siswa: menu Data siswa → Tambah siswa → Upload data siswa (file ekspor aplikasi madrasah, dicocokkan lewat judul kolom), lalu Unduh template ruang & gelombang → isi → Upload ruang & gelombang (dicocokkan lewat No. Induk).

## Persyaratan ujian
- Menu **Persyaratan ujian** (admin/TU) menampilkan siswa yang terjaring beserta rincian per persyaratan: daftar siswa dengan filter, ringkasan per jenis, dan pop up **Detail** per siswa.
- Database lama: jalankan `supabase/migration_persyaratan.sql`. Untuk melihat tampilannya sebelum importer jadi, jalankan `supabase/contoh_data_persyaratan.sql` (cara membersihkannya ada di dalam file).
- Satu baris `persyaratan_terjaring` = satu siswa terjaring pada satu jenis; `alasan` berupa ringkasan, `detail` (jsonb) bebas berbeda tiap jenis dan tampil apa adanya. `persyaratan_jenis.data_terakhir` menandai jenis itu sudah diunggah; sebelum itu siswa tidak ditampilkan "memenuhi".
- Sudah jadi: **Absen 10%**. TU mengunggah daftar siswa terjaring di Dashboard persyaratan (tombol Upload pada baris Absen 10%; kolom `INDUK` dan `JUMLAH %`, dicocokkan lewat No. Induk). Pengampu memverifikasi di menu Persyaratan ujian > Absen 10% dengan tombol **Lengkap** (bisa dibatalkan). Upload ulang: siswa yang masih ada di file mempertahankan status lengkap-nya, yang tidak ada di file dihapus dari daftar.
- Jenis lain (Absen Semen, Tasmi', dst.) belum punya importer; caranya sama: isi `persyaratan_terjaring` lalu `persyaratan_jenis.data_terakhir`. Migrasi ini aman dijalankan ulang untuk menambah kolom status lengkap.

## Catatan arsitektur
- Login: username dipetakan ke email `<username>@absensi.local` di Supabase Auth.
- Semua query data lewat server memakai `service_role`; role + ruang dicek di `lib/auth.ts` & `app/(app)/absen/actions.ts`. RLS aktif tanpa policy sehingga browser tidak bisa akses tabel langsung.
- Timestamp kedatangan/kepulangan selalu dari server. Zona waktu tampilan: WIB.
- Status "Tidak Pulang Tercatat" dihitung otomatis (hadir, belum pulang, gelombang selesai).
- Ekspor CSV memakai pemisah `;` + BOM agar langsung rapi di Excel Indonesia.

## Belum ada (sengaja ditunda)
Ekspor .xlsx/PDF, ZIP per ruang (saat ini 1 CSV gabungan), multi-hari ujian per gelombang, UI rapi/responsif.

## Kecepatan

- `npm run dev` kini memakai Turbopack (`dev:webpack` untuk cara lama). Mode dev memang jauh lebih lambat dari produksi karena
  halaman dikompilasi saat pertama dibuka. Untuk merasakan kecepatan sebenarnya: `npm run build && npm start`.
- Pop up tambah/edit terbuka langsung di browser, tanpa menunggu server. Hanya saat menyimpan data dikirim ke server.
- Halaman yang baru dibuka dipakai ulang 30 detik saat pindah menu (`staleTimes` di `next.config.mjs`); setiap simpan/hapus
  otomatis membuang cache ini.
- Di Supabase, gunakan JWT signing keys asimetris (Project Settings, JWT Keys) agar verifikasi login dilakukan lokal,
  tanpa panggilan jaringan ke server Auth pada setiap klik.

- Menu **Pengaturan** (kelola akun dan batasan akses menu): jalankan `supabase/migration_pengaturan_akses.sql` sekali. Peran: Administrator (semua menu), Staf (menu yang dicentang), Petugas ruang (absensi dan laporan ruangnya).

## Hak akses Persyaratan ujian per sub menu dan tingkat kelas
- Jalankan `supabase/migration_akses_persyaratan.sql` sekali (menambah kolom `users.akses_persyaratan`). Akun staf lama yang sudah punya menu Persyaratan ujian tetap bisa membuka semuanya sampai diatur ulang.
- Pengaturan > Edit akun staf > centang menu **Persyaratan ujian** > muncul daftar sub menu (Dashboard, Absen 10%, Absen Semen, Tasmi', Taftisy, Tathbiq, Syahriyah, Administrasi). Tiap sub menu dicentang sendiri dan punya pilihan **Semua** atau tingkat tertentu (Kelas 7/8/9, dst.).
- Pilihan tingkat diambil dari data siswa: tingkat dibaca dari teks kelas (`7A`, `7 A`, `VII-B`, `Kelas 8 C`). Kelas yang tingkatnya tidak terbaca hanya terlihat oleh akun dengan pilihan **Semua**.
- Pembatasan berlaku di daftar, hitungan ringkasan, cetak/unduh Excel (mengikuti Dashboard), dan semua aksi per siswa (tandai lengkap, ceklis Taftisy/Administrasi), baik di tampilan maupun di server.
- Upload, hapus data, dan target minimal mengganti data semua siswa, jadi hanya tersedia untuk akun yang punya **Dashboard dengan Semua tingkat**.


## Kartu ujian
- Jalankan `supabase/migration_kartu_ujian.sql` sekali (kolom `siswa.no_ujian`, `siswa.no_bangku`, dan tabel `kartu_ujian_pengaturan`). Lalu `npm install` (menambah `bwip-js` untuk QR dan barcode).
- **No. ujian dan no. bangku** diisi bersama ruang & gelombang: di form Data siswa, atau lewat Upload ruang & gelombang (template unduhan kini punya kolom *No. Ujian* dan *No. Bangku*; sel kosong = tidak diubah). No. ujian tidak boleh kembar; dicek di form dan di pratinjau upload.
- Menu **Kartu ujian** (`/kartu-ujian`): isi 3 isian header (jenis ujian, madrasah, tahun ajaran), unggah gambar kop (PNG/JPG/WEBP, maks. 1 MB; kosong = logo madrasah bawaan), pilih filter kelas/ruang/gelombang, lalu **Pratinjau & cetak**.
- Cetak (`/cetak/kartu`): kertas F4 215 x 330 mm, 9 kartu per lembar. Di dialog cetak pakai ukuran kertas F4, skala 100%, tanpa margin, atau Simpan sebagai PDF. Siswa tanpa no. ujian tidak dicetak (dihitung dan ditampilkan di menu).
- QR berisi **no. induk**, barcode (Code 128) berisi **no. ujian**. Keterangan = pill singkatan persyaratan yang menjaring siswa (urut sesuai jenis); yang sudah ditandai lengkap tampil outline dengan centang. Singkatan diubah di `lib/kartu-ujian.ts` (`SINGKATAN_KARTU`).
- Hak akses: menu ini muncul otomatis di Pengaturan > akun staf (kotak centang "Kartu ujian") dan di tabel Hak akses per peran. Administrator selalu boleh; petugas ruang tidak.
