'use client';
import { useTransition } from 'react';
import { CircleCheck, LoaderCircle, Undo2 } from 'lucide-react';
import { showToast } from '@/components/Toaster';
import { konfirmasi } from '@/components/ConfirmHost';
import { setLengkapJenis } from './actions';

// Tombol pengampu: tandai lengkap, atau batalkan bila salah klik.
export default function AksiLengkap({ kode, siswaId, nama, lengkap }: { kode: string; siswaId: number; nama: string; lengkap: boolean }) {
  const [pending, mulai] = useTransition();

  async function kirim() {
    if (lengkap && !(await konfirmasi({ judul: 'Batalkan status lengkap', pesan: `Batalkan status lengkap untuk ${nama}?`, tombol: 'Ya, batalkan' }))) return;
    mulai(async () => {
      try {
        const r = await setLengkapJenis(kode, siswaId, !lengkap);
        showToast(r.ok ? `${nama}: ${r.msg.toLowerCase()}` : r.msg, !r.ok);
      } catch {
        showToast('Gagal menghubungi server. Coba lagi.', true);
      }
    });
  }

  return lengkap ? (
    <button type="button" className="btn btn-sm" onClick={kirim} disabled={pending}>
      {pending ? <LoaderCircle size={14} className="spin" /> : <Undo2 size={14} />}Batalkan
    </button>
  ) : (
    <button type="button" className="btn btn-sm btn-primary" onClick={kirim} disabled={pending}>
      {pending ? <LoaderCircle size={14} className="spin" /> : <CircleCheck size={14} />}Lengkap
    </button>
  );
}
