-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang).
-- Menu Pengaturan: peran baru "staf" (akun tanpa ruang dengan daftar menu yang boleh dibuka) dan kolom akses.
alter type public.user_role add value if not exists 'staf';

alter table public.users add column if not exists akses text[] not null default '{}';

-- Sebelumnya semua akun non-admin wajib punya ruang. Sekarang hanya petugas yang wajib.
alter table public.users drop constraint if exists petugas_wajib_punya_ruang;
alter table public.users add constraint petugas_wajib_punya_ruang check (role <> 'petugas' or ruang_id is not null);
