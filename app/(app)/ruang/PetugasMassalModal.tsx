'use client';
import { useMemo, useState, useTransition } from 'react';
import { CircleAlert, Download, LoaderCircle, UserPlus, Users, X } from 'lucide-react';
import Modal from '@/components/Modal';
import { useModalOpener } from '@/components/OpenModal';
import { showToast } from '@/components/Toaster';
import { namaDariPola, usernameDariPola, PENANDA_USERNAME } from '@/lib/ruang-gen';
import { buatPetugasMassal, type HasilPetugasMassal } from './actions';

type Ruang = { id: number; kode_ruang: string };

export default function PetugasMassalModal({ ruang }: { ruang: Ruang[] }) {
  const [buka, setBuka] = useState(false);
  useModalOpener('petugas-massal', () => setBuka(true));
  if (!buka) return null;
  return (
    <Modal wide title="Buat akun petugas massal" icon={<Users size={17} />} onClose={() => setBuka(false)}>
      <Isi ruang={ruang} onTutup={() => setBuka(false)} />
    </Modal>
  );
}

function unduh(b64: string) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'akun-petugas.xlsx'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Isi({ ruang, onTutup }: { ruang: Ruang[]; onTutup: () => void }) {
  const [awal] = useState(ruang); // daftar ruang saat pop up dibuka; tetap stabil walau halaman dimuat ulang
  const [pilih, setPilih] = useState<Set<number>>(() => new Set(awal.map((r) => r.id)));
  const [polaUser, setPolaUser] = useState('ruang{no}');
  const [polaNama, setPolaNama] = useState('Petugas Ruang {no}');
  const [mode, setMode] = useState<'acak' | 'sama'>('acak');
  const [sandi, setSandi] = useState('');
  const [pending, mulai] = useTransition();
  const [hasil, setHasil] = useState<HasilPetugasMassal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const terpilih = awal.filter((r) => pilih.has(r.id));
  const contoh = terpilih[0];
  const semua = awal.length > 0 && terpilih.length === awal.length;
  const polaValid = PENANDA_USERNAME.test(polaUser.toLowerCase());
  const contohUser = useMemo(
    () => (polaValid ? terpilih.slice(0, 3).map((r, i) => usernameDariPola(polaUser, r.kode_ruang, i + 1) || '(tanpa angka)').join(', ') : ''),
    [terpilih, polaUser, polaValid],
  );

  function kirim() {
    const fd = new FormData();
    fd.set('ids', JSON.stringify(terpilih.map((r) => r.id)));
    fd.set('pola_username', polaUser); fd.set('pola_nama', polaNama); fd.set('mode', mode); fd.set('password', sandi);
    setError(null);
    mulai(async () => {
      try {
        const r = await buatPetugasMassal(fd);
        if (r.ok) { setHasil(r); showToast(r.msg, !!r.warn); if (r.xlsx) unduh(r.xlsx); } else setError(r.msg);
      } catch {
        setError('Gagal menghubungi server. Coba lagi.');
      }
    });
  }

  if (hasil?.ok) {
    return (
      <div>
        <div className="alert alert-ok" role="status"><UserPlus size={18} /><span>{hasil.msg}. File Excel berisi username & password sudah diunduh. Password hanya tampil sekali, simpan file itu.</span></div>
        <div className="preview-scroll">
          <table>
            <thead><tr><th>Ruang</th><th>Nama petugas</th><th>Username</th><th>Password</th></tr></thead>
            <tbody>{hasil.akun?.map((a) => <tr key={a.username}><td>{a.kode_ruang}</td><td>{a.nama}</td><td><code>{a.username}</code></td><td><code>{a.password}</code></td></tr>)}</tbody>
          </table>
        </div>
        {!!hasil.dilewati?.length && <div className="alert alert-warn" style={{ marginTop: 12 }}><CircleAlert size={18} /><span>Dilewati: {hasil.dilewati.join('; ')}</span></div>}
        <div className="preview-actions">
          <button type="button" className="btn" onClick={() => hasil.xlsx && unduh(hasil.xlsx)}><Download size={16} />Unduh lagi (Excel)</button>
          <button type="button" className="btn btn-primary" onClick={onTutup}>Selesai</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
      {!awal.length ? (
        <p className="muted">Semua ruang sudah punya akun petugas.</p>
      ) : (
        <>
          <div className="form-grid">
            <label className="field">Pola username
              <input value={polaUser} onChange={(e) => setPolaUser(e.target.value)} autoComplete="off" />
              <small>
                {polaValid
                  ? `Hasil: ${contohUser || '-'}, dst. `
                  : <span style={{ color: 'var(--danger, #b42318)' }}>Wajib memuat {'{no}'}, {'{kode}'}, atau {'{urut}'}. </span>}
                {'{no}'} = nomor ruang tanpa nol depan (R-001 jadi 1), {'{kode}'} = kode lengkap (r001), {'{urut}'} = 1, 2, 3 sesuai urutan.
              </small>
            </label>
            <label className="field">Pola nama petugas
              <input value={polaNama} onChange={(e) => setPolaNama(e.target.value)} />
              <small>
                {contoh ? `Hasil: ${terpilih.slice(0, 3).map((r, i) => namaDariPola(polaNama, r.kode_ruang, i + 1)).join(', ')}, dst. ` : ''}
                Penanda sama: {'{no}'}, {'{kode}'}, {'{urut}'}.
              </small>
            </label>
            <label className="field">Password
              <select value={mode} onChange={(e) => setMode(e.target.value as 'acak' | 'sama')}>
                <option value="acak">Acak, berbeda tiap ruang (disarankan)</option>
                <option value="sama">Sama untuk semua ruang</option>
              </select>
            </label>
            {mode === 'sama' && (
              <label className="field">Password bersama
                <input value={sandi} onChange={(e) => setSandi(e.target.value)} minLength={6} autoComplete="off" />
                <small>Minimal 6 karakter</small>
              </label>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
              <input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={semua}
                onChange={() => setPilih(semua ? new Set() : new Set(awal.map((r) => r.id)))} />
              Ruang yang belum punya petugas ({terpilih.length} dari {awal.length} dipilih)
            </label>
            <div className="chips" style={{ marginTop: 8 }}>
              {awal.map((r) => (
                <label key={r.id} className={`badge ${pilih.has(r.id) ? 'badge-green' : 'badge-gray'}`} style={{ cursor: 'pointer', gap: 6 }}>
                  <input type="checkbox" style={{ width: 'auto', minHeight: 0 }} checked={pilih.has(r.id)}
                    onChange={() => setPilih((p) => { const n = new Set(p); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />
                  {r.kode_ruang}
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="preview-actions">
        <button type="button" className="btn" onClick={onTutup} disabled={pending}><X size={16} />Batal</button>
        <button type="button" className="btn btn-primary" onClick={kirim}
          disabled={pending || !terpilih.length || !polaValid || (mode === 'sama' && sandi.length < 6)}>
          {pending ? <LoaderCircle size={16} className="spin" /> : <UserPlus size={16} />}
          {pending ? 'Membuat akun…' : `Buat ${terpilih.length} akun`}
        </button>
      </div>
    </div>
  );
}
