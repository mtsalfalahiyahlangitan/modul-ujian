-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang). Setelah migration_persyaratan.sql.
-- Administrasi: hutang / catatan administrasi siswa dari file TU (satu sheet).
-- Satu siswa (No. Induk) boleh muncul di beberapa baris dengan keterangan berbeda; tiap baris menjadi satu catatan.
--
--   persyaratan_administrasi : 1 baris = 1 catatan (keterangan + nominal) milik 1 siswa terjaring.
--     kunci     : keterangan yang dinormalkan + nomor kemunculan; dipakai mencocokkan catatan saat TU upload ulang
--     keterangan: kosong ('') bila di file hanya ada No. Induk (siswa tetap terjaring, mis. dipanggil ke kantor)
--     nominal   : boleh kosong (NULL)
--     ceklis    : true bila catatan sudah diselesaikan (dicek pengampu); dipertahankan saat TU upload ulang
--   Status "lengkap" siswa pada persyaratan_terjaring (jenis administrasi) = semua catatannya terceklis.

insert into public.persyaratan_jenis (kode, nama, urutan) values ('administrasi', 'Administrasi', 7)
on conflict (kode) do nothing;

create table if not exists public.persyaratan_administrasi (
  id          bigint generated always as identity primary key,
  siswa_id    bigint not null references public.siswa(id)             on delete cascade,
  jenis_id    bigint not null references public.persyaratan_jenis(id) on delete cascade,
  kunci       varchar(300) not null,
  keterangan  varchar(255) not null default '',
  nominal     bigint check (nominal >= 0),
  urutan      int         not null default 0,
  ceklis      boolean     not null default false,
  ceklis_at   timestamptz,
  ceklis_oleh uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (siswa_id, jenis_id, kunci)
);
create index if not exists persyaratan_administrasi_jenis_idx on public.persyaratan_administrasi (jenis_id, siswa_id);

alter table public.persyaratan_administrasi enable row level security;
