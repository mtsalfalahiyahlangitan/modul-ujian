-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang). Setelah migration_persyaratan.sql.
-- Tathbiq: setoran sorogan baca kitab (maqro') per minggu. TU mengunggah jumlah maqro' semua siswa,
-- dan target minimal diisi di Dashboard persyaratan. Siswa terjaring bila jumlah maqro' < target minimal.
--
--   persyaratan_jenis.target_minimal : target minimal maqro' (NULL = belum diisi)
--   tathbiq_setoran                  : jumlah maqro' hasil unggahan TU per siswa (data mentah, semua siswa di file),
--                                      disimpan agar daftar terjaring bisa dihitung ulang saat target diubah.

alter table public.persyaratan_jenis
  add column if not exists target_minimal int check (target_minimal > 0);

create table if not exists public.tathbiq_setoran (
  siswa_id    bigint primary key references public.siswa(id) on delete cascade,
  jumlah      int not null check (jumlah >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.tathbiq_setoran enable row level security;
