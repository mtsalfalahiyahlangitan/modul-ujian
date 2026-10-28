import { KeyRound, LogIn, CircleAlert } from 'lucide-react';
import LogoMadrasah from '@/components/LogoMadrasah';
import { masukKode } from './actions';

// Hanya tampil bila WALI_KODE_AKSES diisi di environment.
export default function KodeAkses({ galat }: { galat?: string }) {
  return (
    <div className="login" style={{ margin: '24px auto' }}>
      <div className="login-head">
        <LogoMadrasah size={44} />
        <div><b>Wali Kelas</b><small>Masukkan kode akses dari admin</small></div>
      </div>
      <form action={masukKode} className="login-body">
        {galat && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{galat}</span></div>}
        <label className="field">Kode akses
          <input name="kode" type="password" required autoFocus autoComplete="off" />
        </label>
        <button type="submit" className="btn btn-primary"><LogIn size={17} />Masuk</button>
        <p className="muted" style={{ fontSize: 12 }}><KeyRound size={12} style={{ verticalAlign: -1 }} /> Kode cukup dimasukkan sekali di perangkat ini.</p>
      </form>
    </div>
  );
}
