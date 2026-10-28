import { notFound } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { requireAksesSub } from '@/lib/auth';
import { JENIS_PERSYARATAN } from '@/lib/nav';
import PageHeader from '@/components/PageHeader';

// Halaman tiap jenis penjaringan. Masih kosong; isinya (upload data dan tampilan) dibuat per jenis nanti.
export default async function JenisPersyaratanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const jenis = JENIS_PERSYARATAN.find((j) => j.slug === slug);
  if (!jenis) notFound();
  await requireAksesSub(slug);

  return (
    <div>
      <PageHeader title={jenis.nama} desc="Penjaringan persyaratan ujian." />
      <section className="panel">
        <div className="empty">
          <ClipboardList size={28} style={{ marginBottom: 8 }} />
          <p>Belum ada isi. Upload data dan tampilan penjaringan {jenis.nama} akan ditambahkan.</p>
        </div>
      </section>
    </div>
  );
}
