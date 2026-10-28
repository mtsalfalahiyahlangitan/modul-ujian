import { cookies } from 'next/headers';
import { CircleAlert } from 'lucide-react';
import { adminDb } from '@/lib/supabase/admin';
import { COOKIE_WALI, aksesSah, type Wali } from '@/lib/wali';
import KodeAkses from './KodeAkses';
import PilihWali from './PilihWali';
import DataWali from './DataWali';

export const metadata = { title: 'Wali Kelas - Module Ujian' };

// Halaman wali kelas (tanpa login). Belum memilih nama -> daftar nama; sudah memilih -> siswa di kelasnya.
export default async function WaliPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!(await aksesSah())) return <KodeAkses galat={sp.error} />;

  const { data, error } = await adminDb().from('wali_kelas').select('id,nama,kelas').order('nama');
  if (error) {
    return (
      <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}><CircleAlert size={18} />
        <span>Halaman ini belum siap. Hubungi admin madrasah.</span>
      </div>
    );
  }
  const daftar = (data ?? []) as Wali[];
  const id = Number((await cookies()).get(COOKIE_WALI)?.value);
  const wali = id ? daftar.find((w) => w.id === id) : null;
  return wali ? <DataWali wali={wali} sp={sp} /> : <PilihWali daftar={daftar} />;
}
