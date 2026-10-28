'use server';
import { revalidatePath } from 'next/cache';
import { requireAkses } from '@/lib/auth';
import { adminDb } from '@/lib/supabase/admin';
import { MAKS_KOP_BYTE, KARTU_PER_HALAMAN, bacaParamKartu, type ItemKartu, type ParamKartu } from '@/lib/kartu-ujian';
import { ambilDataKartu, itemKartu } from '@/lib/kartu-data';
import { gagal, sukses, str, type FormState } from '@/lib/util';

// Jenis gambar dikenali dari isi file (bukan dari nama/ekstensi), agar yang tersimpan benar-benar gambar
function jenisGambar(b: Uint8Array): string | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

const BELUM_MIGRASI = 'Database belum disiapkan. Jalankan supabase/migration_kartu_ujian.sql di Supabase SQL Editor.';

// Simpan isian header kartu (3 isian) dan, bila dipilih, ganti / hapus gambar kop.
export async function simpanPengaturanKartu(fd: FormData): Promise<FormState> {
  await requireAkses('kartu');
  const jenis_ujian = str(fd.get('jenis_ujian')), madrasah = str(fd.get('madrasah')), tahun_ajaran = str(fd.get('tahun_ajaran'));
  if (!jenis_ujian || !madrasah || !tahun_ajaran) return gagal('Jenis ujian, madrasah, dan tahun ajaran wajib diisi');
  if (jenis_ujian.length > 100 || madrasah.length > 100 || tahun_ajaran.length > 50) return gagal('Isian terlalu panjang');

  const patch: Record<string, unknown> = { id: 1, jenis_ujian, madrasah, tahun_ajaran, updated_at: new Date().toISOString() };
  const file = fd.get('kop') as File | null;
  if (file && file.size > 0) {
    if (file.size > MAKS_KOP_BYTE) return gagal('Gambar kop maksimal 1 MB. Perkecil ukurannya lalu unggah ulang');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const jenis = jenisGambar(bytes);
    if (!jenis) return gagal('Gambar kop harus berformat PNG, JPG, atau WEBP');
    patch.kop_data = `data:${jenis};base64,${Buffer.from(bytes).toString('base64')}`;
  } else if (str(fd.get('hapus_kop')) === '1') {
    patch.kop_data = null;
  }

  const { error } = await adminDb().from('kartu_ujian_pengaturan').upsert(patch, { onConflict: 'id' });
  if (error) return gagal(/kartu_ujian_pengaturan|relation|schema cache/i.test(error.message) ? BELUM_MIGRASI : error.message);
  revalidatePath('/', 'layout');
  return sukses('Pengaturan kartu tersimpan');
}

// Isi satu lembar (9 kartu) untuk pratinjau lembar ke-hal (mulai 0), sesuai filter. Dipanggil saat pindah halaman pratinjau.
export async function ambilLembarKartu(param: ParamKartu, hal: number): Promise<{ ok: boolean; items: ItemKartu[]; msg?: string }> {
  await requireAkses('kartu');
  try {
    const { kartu } = await ambilDataKartu(adminDb(), bacaParamKartu(param));
    const mulai = Math.max(0, Math.floor(hal)) * KARTU_PER_HALAMAN;
    return { ok: true, items: kartu.slice(mulai, mulai + KARTU_PER_HALAMAN).map(itemKartu) };
  } catch (e: any) {
    return { ok: false, items: [], msg: e?.message ?? 'Gagal memuat lembar' };
  }
}
