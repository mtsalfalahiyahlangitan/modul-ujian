-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang).
-- Menu Kartu ujian: nomor ujian + nomor bangku per siswa, dan pengaturan tampilan kartu.

-- Nomor ujian (barcode kartu) dan nomor bangku. Diisi bersama ruang & gelombang (Data siswa).
-- Sengaja TIDAK unik di database: tukar nomor antar siswa lewat upload Excel akan gagal di tengah jalan bila unik.
-- Kedobelan nomor ujian dicek oleh aplikasi (form siswa dan upload ruang & gelombang).
alter table public.siswa add column if not exists no_ujian  varchar(30);
alter table public.siswa add column if not exists no_bangku varchar(20);
create index if not exists siswa_no_ujian_idx on public.siswa (no_ujian) where no_ujian is not null;

-- Pengaturan kartu: satu baris saja (id selalu 1).
--   jenis_ujian  : judul besar di kartu, contoh "Ujian Tengah Semester 1"
--   madrasah     : madrasah penyelenggara, contoh "Madrasah Al Falahiyah Langitan"
--   tahun_ajaran : contoh "1447-1448 H" (tulisan "Tahun Ajaran :" ditambahkan otomatis)
--   kop_data     : gambar kop/logo atas kartu sebagai data URL (png/jpg/webp, maks. 1 MB). Kosong = logo madrasah bawaan.
create table if not exists public.kartu_ujian_pengaturan (
  id            int primary key default 1 check (id = 1),
  jenis_ujian   varchar(100) not null default 'Ujian Tengah Semester 1',
  madrasah      varchar(100) not null default 'Madrasah Al Falahiyah Langitan',
  tahun_ajaran  varchar(50)  not null default '1447-1448 H',
  kop_data      text,
  updated_at    timestamptz  not null default now()
);
alter table public.kartu_ujian_pengaturan enable row level security;
insert into public.kartu_ujian_pengaturan (id) values (1) on conflict (id) do nothing;
