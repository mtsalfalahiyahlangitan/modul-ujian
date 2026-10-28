'use client';
import { useEffect, useState, useTransition, type FormEvent } from 'react';
import { LoaderCircle, Save } from 'lucide-react';
import { showToast } from '@/components/Toaster';
import { konfirmasi } from '@/components/ConfirmHost';
import { simpanTargetJumlah } from './actions';

// Isian target minimal (Tathbiq: maqro', Syahriyah: bulan) di Dashboard. Siswa dengan jumlah di bawah target = terjaring.
export default function TargetJumlah({ kode, satuan, awal, adaData }: { kode: string; satuan: string; awal: number | null; adaData: boolean }) {
  const [nilai, setNilai] = useState(awal ? String(awal) : '');
  const [pending, mulai] = useTransition();
  useEffect(() => { setNilai(awal ? String(awal) : ''); }, [awal]);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    const n = Number(nilai);
    if (!Number.isInteger(n) || n < 1 || n > 99) { showToast("Isi target dengan bilangan bulat 1 sampai 99", true); return; }
    if (adaData && n !== awal && !(await konfirmasi({ judul: 'Ubah target minimal', pesan: `Ubah target minimal menjadi ${n} ${satuan}? Daftar siswa terjaring akan dihitung ulang.`, tombol: 'Ya, ubah' }))) return;
    mulai(async () => {
      try {
        const r = await simpanTargetJumlah(kode, n);
        showToast(r.msg, !r.ok);
      } catch {
        showToast('Gagal menghubungi server. Coba lagi.', true);
      }
    });
  }

  return (
    <form onSubmit={kirim} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
        Minimal {satuan}
        <input
          type="number" inputMode="numeric" min={1} max={99} value={nilai} onChange={(e) => setNilai(e.target.value)}
          placeholder="mis. 5" aria-label={`Target minimal ${satuan}`} style={{ width: 70, minHeight: 30, padding: '0 8px' }}
        />
      </label>
      <button type="submit" className="btn btn-sm" disabled={pending}>
        {pending ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}Simpan
      </button>
    </form>
  );
}
