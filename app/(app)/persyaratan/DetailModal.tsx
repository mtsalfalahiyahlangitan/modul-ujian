'use client';
import { useState } from 'react';
import { CircleCheck, CircleHelp, CircleX, ClipboardCheck } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { barisDetail, type BarisPersyaratan, type JenisPersyaratan } from '@/lib/persyaratan';

// Pop up detail: seluruh jenis persyaratan untuk satu siswa, mana yang terjaring beserta alasannya.
export default function DetailModal({ rows, jenis }: { rows: BarisPersyaratan[]; jenis: JenisPersyaratan[] }) {
  const [id, setId] = useState<number | null>(null);
  useModalOpener('persyaratan', (v) => setId(v ?? null));
  const s = id != null ? rows.find((r) => r.id === id) : null;
  if (!s) return null;

  const per = new Map(s.terjaring.map((t) => [t.jenis_id, t] as const));
  const adaData = jenis.filter((j) => j.data_terakhir);
  const jumlah = s.terjaring.length;
  const belum = s.terjaring.filter((t) => !t.lengkap).length;

  return (
    <Modal title={s.nama} icon={<ClipboardCheck size={17} />} onClose={() => setId(null)}>
      <p className="muted" style={{ marginBottom: 12 }}>
        {s.no_induk} · Kelas {s.kelas} · {s.asrama}{s.kamar ? `, kamar ${s.kamar}` : ''} · Ruang {s.ruang ?? '-'}
      </p>
      <div style={{ marginBottom: 14 }}>
        {jumlah > 0
          ? (belum > 0
            ? <span className="badge badge-red">Terjaring di {jumlah} persyaratan, {belum} belum lengkap</span>
            : <span className="badge badge-green">Terjaring di {jumlah} persyaratan, semuanya sudah lengkap</span>)
          : adaData.length > 0
            ? <span className="badge badge-green">Tidak terjaring di {adaData.length} persyaratan yang sudah diunggah</span>
            : <span className="badge badge-gray">Belum ada data penjaringan yang diunggah</span>}
      </div>

      <ul className="pt-list">
        {jenis.map((j) => {
          const t = per.get(j.id);
          const rincian = t ? barisDetail(t.detail) : [];
          const kelas = t ? (t.lengkap ? 'pt-item lengkap' : 'pt-item terjaring') : j.data_terakhir ? 'pt-item' : 'pt-item kosong';
          return (
            <li key={j.id} className={kelas}>
              <div className="pt-head">
                {t ? (t.lengkap ? <CircleCheck size={17} /> : <CircleX size={17} />) : j.data_terakhir ? <CircleCheck size={17} /> : <CircleHelp size={17} />}
                <b>{j.nama}</b>
                {t
                  ? (t.lengkap ? <span className="badge badge-green">Terjaring, sudah lengkap</span> : <span className="badge badge-red">Terjaring, belum lengkap</span>)
                  : j.data_terakhir
                    ? <span className="badge badge-green">Memenuhi</span>
                    : <span className="badge badge-gray">Belum ada data</span>}
              </div>
              {t?.alasan && <p className="pt-alasan">{t.alasan}</p>}
              {rincian.length > 0 && (
                <dl className="pt-detail">
                  {rincian.map((r, i) => <div key={i}><dt>{r.label}</dt><dd>{r.nilai}</dd></div>)}
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
