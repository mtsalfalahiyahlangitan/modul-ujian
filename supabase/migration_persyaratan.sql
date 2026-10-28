-- Jalankan di Supabase SQL Editor (sekali saja; aman diulang).
-- Menu "Persyaratan ujian": hasil penjaringan TU per siswa.
--
-- Rancangan:
--   persyaratan_jenis      : daftar jenis penjaringan (Absen 10%, Tasmi', dst).
--                            data_terakhir = kapan data jenis itu terakhir diunggah TU.
--                            NULL berarti jenis itu belum pernah diunggah, sehingga siswa
--                            tidak boleh ditampilkan "lolos" untuk jenis tersebut.
--   persyaratan_terjaring  : 1 baris = 1 siswa terjaring pada 1 jenis (maks. satu per siswa per jenis).
--                            alasan = ringkasan satu kalimat; detail = rincian bebas (jsonb) yang
--                            bentuknya berbeda untuk tiap jenis, tampil apa adanya di pop up detail.
--                            lengkap = sudah diverifikasi lengkap oleh pengampu (siswa tidak lagi dianggap bermasalah).
--
-- Untuk menambah jenis baru cukup insert satu baris ke persyaratan_jenis.
-- Importer tiap jenis (dibuat nanti) cukup mengganti baris jenisnya lalu mengisi data_terakhir.

create table if not exists public.persyaratan_jenis (
  id             bigint generated always as identity primary key,
  kode           varchar(30) not null unique,
  nama           varchar(50) not null,
  urutan         int         not null default 0,
  data_terakhir  timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.persyaratan_terjaring (
  id          bigint generated always as identity primary key,
  siswa_id    bigint not null references public.siswa(id)              on delete cascade,
  jenis_id    bigint not null references public.persyaratan_jenis(id)  on delete cascade,
  alasan      varchar(255),
  detail      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (siswa_id, jenis_id)
);
create index if not exists persyaratan_terjaring_jenis_idx on public.persyaratan_terjaring (jenis_id, siswa_id);

-- Status verifikasi oleh pengampu: siswa terjaring baru dianggap memenuhi syarat setelah pengampu menandai "lengkap".
alter table public.persyaratan_terjaring
  add column if not exists lengkap       boolean not null default false,
  add column if not exists lengkap_at    timestamptz,
  add column if not exists lengkap_oleh  uuid references public.users(id) on delete set null;

-- Jumlah siswa terjaring per jenis (dipakai ringkasan di halaman, 1 query saja)
create or replace view public.persyaratan_ringkasan with (security_invoker = true) as
  select jenis_id, count(*)::int as jumlah, (count(*) filter (where lengkap))::int as lengkap
  from public.persyaratan_terjaring group by jenis_id;

alter table public.persyaratan_jenis     enable row level security;
alter table public.persyaratan_terjaring enable row level security;

insert into public.persyaratan_jenis (kode, nama, urutan) values
  ('absen_10',     'Absen 10%',    1),
  ('absen_semen',  'Absen Semen',  2),
  ('tasmi',        'Tasmi''',      3),
  ('taftisy',      'Taftisy',      4),
  ('tathbiq',      'Tathbiq',      5),
  ('syahriyah',    'Syahriyah',    6),
  ('administrasi', 'Administrasi', 7)
on conflict (kode) do nothing;
