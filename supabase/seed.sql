-- DATA CONTOH untuk uji coba alur (opsional). Jalankan SETELAH schema.sql.
insert into public.ruang (kode_ruang, nama_ruang) values
  ('R-01', 'Ruang 01 - Lab Komputer'),
  ('R-02', 'Ruang 02 - Kelas 10A');

insert into public.gelombang (urutan, nama_gelombang, durasi_ujian, durasi_jeda) values
  (1, 'Gelombang 1', 90, 15),
  (2, 'Gelombang 2', 90, 15),
  (3, 'Gelombang 3', 90, 0);

-- 36 siswa contoh di 2 ruang. Sepertiga siswa ikut gelombang 1 & 3, sisanya gelombang 2.
insert into public.siswa (no_induk, nama, asrama, kelas, ruang_id)
select
  'S' || lpad(i::text, 4, '0'),
  'Siswa Contoh ' || i,
  'Asrama ' || (1 + i % 3),
  '10-' || (1 + i % 2),
  (select id from public.ruang where kode_ruang = case when i % 2 = 0 then 'R-01' else 'R-02' end)
from generate_series(1, 36) as i;

insert into public.siswa_gelombang (siswa_id, gelombang_id)
select s.id, g.id
from public.siswa s
join public.gelombang g
  on (substr(s.no_induk, 2)::int % 3 = 0 and g.urutan in (1, 3))
  or (substr(s.no_induk, 2)::int % 3 <> 0 and g.urutan = 2);
