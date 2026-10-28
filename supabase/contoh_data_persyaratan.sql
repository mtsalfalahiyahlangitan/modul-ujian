-- OPSIONAL, hanya untuk melihat tampilan menu Persyaratan ujian sebelum importer jadi.
-- Mengisi data contoh pada 12 siswa pertama. Jalankan setelah migration_persyaratan.sql.
insert into public.persyaratan_terjaring (siswa_id, jenis_id, alasan, detail)
select s.id, j.id,
  'Contoh: ' || j.nama,
  case j.kode
    when 'absen_10'     then jsonb_build_object('jumlah_alpa', 7, 'batas_maksimal', 5, 'persentase', '14%')
    when 'syahriyah'    then jsonb_build_object('bulan_tunggakan', jsonb_build_array('Agustus', 'September'), 'total_tunggakan', 'Rp 300.000')
    else                     jsonb_build_object('catatan', 'Data contoh')
  end
from (select id, row_number() over (order by id) as rn from public.siswa order by id limit 12) s
join public.persyaratan_jenis j on (
     (j.kode = 'absen_10'     and s.rn in (1, 2, 3, 4, 5, 6))
  or (j.kode = 'syahriyah'    and s.rn in (3, 4, 5, 6))
  or (j.kode = 'administrasi' and s.rn in (5, 9))
)
on conflict (siswa_id, jenis_id) do nothing;

update public.persyaratan_jenis set data_terakhir = now() where kode in ('absen_10', 'syahriyah', 'administrasi');

-- Membersihkan data contoh:
--   delete from public.persyaratan_terjaring where alasan like 'Contoh:%';
--   update public.persyaratan_jenis set data_terakhir = null;
