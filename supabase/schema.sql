-- =====================================================================
-- SKEMA DATABASE - Aplikasi Absensi Kehadiran Ujian
-- Jalankan di Supabase Dashboard > SQL Editor
-- =====================================================================

-- ---------- ENUM ----------
create type user_role        as enum ('super_admin', 'petugas');
create type status_gelombang as enum ('belum_mulai', 'berlangsung', 'selesai', 'dibatalkan');
create type status_hadir     as enum ('hadir', 'tidak_hadir');

-- ---------- RUANG ----------
create table public.ruang (
  id          bigint generated always as identity primary key,
  kode_ruang  varchar(20)  not null unique,          -- contoh: R-01
  nama_ruang  varchar(100) not null,
  created_at  timestamptz  not null default now()
);

-- ---------- USERS (profil, terhubung ke Supabase Auth) ----------
-- Login: username diubah menjadi email "<username>@absensi.local" di sisi aplikasi.
create table public.users (
  id        uuid primary key references auth.users(id) on delete cascade,
  username  varchar(50)  not null unique,
  nama      varchar(100) not null,
  role      user_role    not null,
  ruang_id  bigint references public.ruang(id) on delete restrict,   -- NULL untuk super_admin
  created_at timestamptz not null default now(),
  constraint petugas_wajib_punya_ruang check (role = 'super_admin' or ruang_id is not null)
);
-- 1 ruang : 1 akun petugas
create unique index users_satu_petugas_per_ruang
  on public.users (ruang_id) where role = 'petugas';

-- ---------- GELOMBANG (berbasis durasi) ----------
create table public.gelombang (
  id                   bigint generated always as identity primary key,
  urutan               int          not null unique,       -- 1,2,3 ... menentukan urutan jadwal
  nama_gelombang       varchar(50)  not null unique,
  durasi_ujian         int          not null check (durasi_ujian > 0),   -- menit
  durasi_jeda          int          not null default 0 check (durasi_jeda >= 0), -- menit
  batas_masuk_menit    int check (batas_masuk_menit >= 0),   -- tap masuk ditutup N menit setelah mulai (NULL = sampai selesai)
  buka_pulang_menit    int not null default 0 check (buka_pulang_menit >= 0), -- tap pulang dibuka N menit sebelum selesai
  waktu_mulai_rencana  timestamptz,    -- anchor; hanya dipakai gelombang urutan terkecil
  waktu_mulai_efektif  timestamptz,    -- diisi saat tombol "Mulai Sekarang"
  status               status_gelombang not null default 'belum_mulai',
  created_at           timestamptz not null default now()
);

-- ---------- SISWA ----------
create table public.siswa (
  id            bigint generated always as identity primary key,
  no_induk      varchar(30)  not null unique,
  nama          varchar(100) not null,
  asrama        varchar(50)  not null,
  kamar         varchar(30),                          -- kamar asrama, opsional
  kelas         varchar(20)  not null,
  rfid          varchar(50),                          -- UID kartu RFID (huruf besar), opsional
  ruang_id      bigint references public.ruang(id)     on delete set null,
  created_at    timestamptz not null default now()
);
create unique index siswa_rfid_unique on public.siswa (rfid) where rfid is not null;
create index siswa_ruang_idx on public.siswa (ruang_id);

-- ---------- SISWA <-> GELOMBANG (1 siswa bisa ikut beberapa gelombang, mis. 1 & 3) ----------
create table public.siswa_gelombang (
  siswa_id      bigint not null references public.siswa(id)     on delete cascade,
  gelombang_id  bigint not null references public.gelombang(id) on delete cascade,
  primary key (siswa_id, gelombang_id)
);
create index siswa_gelombang_gel_idx on public.siswa_gelombang (gelombang_id, siswa_id);

-- ---------- ABSENSI ----------
create table public.absensi (
  id                bigint generated always as identity primary key,
  siswa_id          bigint not null references public.siswa(id)     on delete cascade,
  gelombang_id      bigint not null references public.gelombang(id) on delete cascade,
  tanggal_ujian     date   not null,
  status_kehadiran  status_hadir not null,
  waktu_datang      timestamptz,
  waktu_pulang      timestamptz,
  keterangan        varchar(255),
  petugas_id        uuid references public.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (siswa_id, gelombang_id, tanggal_ujian)           -- cegah absen dobel
);
create index absensi_tgl_gel_idx on public.absensi (tanggal_ujian, gelombang_id);

-- ---------- AUDIT LOG ----------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  aksi        varchar(50) not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- KEAMANAN (RLS) ----------
-- Semua akses data dilakukan lewat server Next.js memakai service_role key,
-- yang sudah memeriksa role + ruang. RLS dinyalakan TANPA policy sehingga
-- anon/authenticated key dari browser tidak bisa membaca/menulis tabel apa pun.
alter table public.ruang      enable row level security;
alter table public.users      enable row level security;
alter table public.gelombang  enable row level security;
alter table public.siswa      enable row level security;
alter table public.siswa_gelombang enable row level security;
alter table public.absensi    enable row level security;
alter table public.audit_log  enable row level security;

-- ---------- PERSYARATAN UJIAN (hasil penjaringan TU; rancangan lengkap di migration_persyaratan.sql) ----------
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

-- =====================================================================
-- BUAT SUPER ADMIN PERTAMA
-- 1) Supabase Dashboard > Authentication > Users > Add user
--      Email    : admin@absensi.local
--      Password : (pilih sendiri)
--      centang "Auto Confirm User"
-- 2) Jalankan SQL berikut:
--
--   insert into public.users (id, username, nama, role)
--   select id, 'admin', 'Super Admin', 'super_admin'
--   from auth.users where email = 'admin@absensi.local';
-- =====================================================================
