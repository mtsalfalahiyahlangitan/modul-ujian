-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang).
-- Menambah kolom kamar asrama pada data siswa ("Ruangan Asrama" di file ekspor aplikasi madrasah).
alter table public.siswa add column if not exists kamar varchar(30);
