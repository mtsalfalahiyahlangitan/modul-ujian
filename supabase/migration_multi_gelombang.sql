-- Jalankan di Supabase SQL Editor jika database SUDAH dibuat dengan schema.sql versi lama.
-- Siswa kini bisa punya BEBERAPA gelombang (mis. kelas 7 = gelombang 1 & 3).
-- Data lama (1 gelombang per siswa) otomatis disalin ke tabel baru, lalu kolom lama dihapus.
-- Aman dijalankan lebih dari sekali.

create table if not exists public.siswa_gelombang (
  siswa_id      bigint not null references public.siswa(id)     on delete cascade,
  gelombang_id  bigint not null references public.gelombang(id) on delete cascade,
  primary key (siswa_id, gelombang_id)
);
create index if not exists siswa_gelombang_gel_idx on public.siswa_gelombang (gelombang_id, siswa_id);
alter table public.siswa_gelombang enable row level security;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'siswa' and column_name = 'gelombang_id'
  ) then
    insert into public.siswa_gelombang (siswa_id, gelombang_id)
      select id, gelombang_id from public.siswa where gelombang_id is not null
      on conflict do nothing;
    alter table public.siswa drop column gelombang_id;   -- ikut menghapus index lama
  end if;
end $$;

create index if not exists siswa_ruang_idx on public.siswa (ruang_id);
