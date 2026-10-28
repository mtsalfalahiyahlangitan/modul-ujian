-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang). Setelah migration_persyaratan.sql.
-- Syahriyah (SPP): TU mengunggah jumlah bulan yang sudah dibayar per siswa, target minimal bulan diisi di Dashboard
-- persyaratan. Siswa terjaring bila jumlah bulan terbayar < target minimal.
--
--   persyaratan_jenis.target_minimal : target minimal (dipakai juga oleh Tathbiq; NULL = belum diisi)
--   syahriyah_bayar                  : jumlah bulan terbayar hasil unggahan TU per siswa (data mentah), agar daftar
--                                      terjaring bisa dihitung ulang saat target diubah.

alter table public.persyaratan_jenis
  add column if not exists target_minimal int check (target_minimal > 0);

create table if not exists public.syahriyah_bayar (
  siswa_id    bigint primary key references public.siswa(id) on delete cascade,
  jumlah      int not null check (jumlah >= 0),
  updated_at  timestamptz not null default now()
);

alter table public.syahriyah_bayar enable row level security;
