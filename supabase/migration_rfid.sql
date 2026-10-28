-- Jalankan HANYA jika schema.sql versi lama sudah dijalankan sebelumnya.
alter table public.siswa add column if not exists rfid varchar(50);
create unique index if not exists siswa_rfid_unique on public.siswa (rfid) where rfid is not null;
