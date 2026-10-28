'use client';
import { useTransition } from 'react';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { showToast } from '@/components/Toaster';
import { konfirmasi } from '@/components/ConfirmHost';
import { hapusDataJenis } from './actions';

// Tombol hapus data satu jenis persyaratan di Dashboard. Dipakai untuk membersihkan data sebelum ujian berikutnya.
export default function HapusData({ kode, nama, jumlah }: { kode: string; nama: string; jumlah: number }) {
  const [pending, mulai] = useTransition();

  async function klik() {
    const pesan = `Hapus SEMUA data ${nama}?\n\n${jumlah} siswa terjaring beserta status lengkap dan rinciannya akan dihapus. Data siswa tidak terpengaruh. Tindakan ini tidak bisa dibatalkan.`;
    if (!(await konfirmasi({ judul: `Hapus data ${nama}`, pesan, tombol: 'Hapus semua data', bahaya: true }))) return;
    mulai(async () => {
      try {
        const r = await hapusDataJenis(kode);
        showToast(r.msg, !r.ok);
      } catch {
        showToast('Gagal menghubungi server. Coba lagi.', true);
      }
    });
  }

  return (
    <button type="button" className="btn btn-sm btn-danger" onClick={klik} disabled={pending} aria-busy={pending} title={`Hapus semua data ${nama}`}>
      {pending ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />}Hapus data
    </button>
  );
}
