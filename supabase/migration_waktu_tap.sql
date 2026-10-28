-- Jalankan jika schema.sql versi lama sudah dijalankan sebelumnya.
-- batas_masuk_menit : tap masuk ditutup N menit setelah gelombang mulai (NULL = sampai gelombang berakhir)
-- buka_pulang_menit : tap pulang dibuka N menit SEBELUM gelombang berakhir (0 = baru boleh saat berakhir)
alter table public.gelombang add column if not exists batas_masuk_menit  int check (batas_masuk_menit  >= 0);
alter table public.gelombang add column if not exists buka_pulang_menit  int not null default 0 check (buka_pulang_menit >= 0);
