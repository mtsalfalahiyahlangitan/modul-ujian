-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang).
-- Menu "Wali kelas": daftar wali kelas beserta kelas yang diampu.
-- Halaman /wali (tanpa login) memakai tabel ini: wali memilih namanya, lalu melihat siswa di kelasnya beserta persyaratan yang menjaringnya.
create table if not exists public.wali_kelas (
  id          bigint generated always as identity primary key,
  nama        varchar(100) not null,
  kelas       text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create unique index if not exists wali_kelas_nama_idx on public.wali_kelas (lower(nama));
alter table public.wali_kelas enable row level security;
