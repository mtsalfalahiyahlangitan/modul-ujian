-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang). Setelah migration_persyaratan.sql.
-- Taftisy: pengecekan kelengkapan makna/tulisan kitab per pelajaran. Pelajaran bersifat dinamis (mengikuti file TU).
--
--   persyaratan_taftisy : 1 baris = 1 pelajaran milik 1 siswa terjaring.
--     dari_file : pelajaran bertanda X di file TU (lengkap menurut TU)
--     ceklis    : status akhir yang dipakai (diceklis pengampu / bawaan file)
--     diubah    : true bila pengampu mengubah ceklis berbeda dari file TU (dipertahankan saat TU upload ulang)
--   Status "lengkap" siswa pada persyaratan_terjaring (jenis taftisy) = semua pelajarannya ceklis.

create table if not exists public.persyaratan_taftisy (
  id          bigint generated always as identity primary key,
  siswa_id    bigint not null references public.siswa(id)             on delete cascade,
  jenis_id    bigint not null references public.persyaratan_jenis(id) on delete cascade,
  pelajaran   varchar(60) not null,
  urutan      int         not null default 0,
  dari_file   boolean     not null default false,
  ceklis      boolean     not null default false,
  diubah      boolean     not null default false,
  ceklis_at   timestamptz,
  ceklis_oleh uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (siswa_id, jenis_id, pelajaran)
);
create index if not exists persyaratan_taftisy_jenis_idx on public.persyaratan_taftisy (jenis_id, siswa_id);

alter table public.persyaratan_taftisy enable row level security;
