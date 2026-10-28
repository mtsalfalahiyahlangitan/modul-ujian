'use client';
import { useState } from 'react';
import { ChevronRight, Search, UserRound } from 'lucide-react';
import LogoMadrasah from '@/components/LogoMadrasah';
import { pilihWali } from './actions';

// Layar pertama: wali kelas memilih namanya (sekali; diingat di perangkat ini).
export default function PilihWali({ daftar }: { daftar: { id: number; nama: string; kelas: string[] }[] }) {
  const [cari, setCari] = useState('');
  const tampil = daftar.filter((w) => w.nama.toLowerCase().includes(cari.trim().toLowerCase()));

  return (
    <>
      <header className="wali-head">
        <LogoMadrasah size={40} />
        <div className="wali-judul"><small>Module Ujian</small><b>Pilih nama wali kelas</b></div>
      </header>
      <section className="panel">
        {daftar.length > 6 && (
          <div className="wali-filter" style={{ paddingBottom: 0 }}>
            <label className="field">Cari nama
              <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Ketik nama Anda" autoComplete="off" />
            </label>
          </div>
        )}
        <div className="wali-pilih-list">
          {tampil.map((w) => (
            <form key={w.id} action={pilihWali}>
              <input type="hidden" name="id" value={w.id} />
              <button type="submit" className="wali-pilih">
                <UserRound size={20} />
                <span><b>{w.nama}</b><small>{w.kelas.length ? `Kelas ${w.kelas.join(', ')}` : 'Belum ada kelas'}</small></span>
                <ChevronRight size={18} />
              </button>
            </form>
          ))}
          {!daftar.length && <p className="empty">Belum ada wali kelas yang terdaftar. Hubungi admin madrasah.</p>}
          {daftar.length > 0 && !tampil.length && <p className="empty"><Search size={16} style={{ verticalAlign: -3 }} /> Nama tidak ditemukan.</p>}
        </div>
      </section>
    </>
  );
}
