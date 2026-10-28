import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { login } from './actions';
import { getMe, homeFor } from '@/lib/auth';
import Flash from '@/components/Flash';
import LogoMadrasah from '@/components/LogoMadrasah';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // Sudah login? langsung ke halaman sesuai peran
  const me = await getMe();
  if (me) redirect(homeFor(me));

  return (
    <div className="login-wrap">
      <div className="login">
        <div className="login-head">
          <LogoMadrasah size={44} />
          <div><b>Module Ujian</b><small>Masuk untuk melanjutkan</small></div>
        </div>
        <form action={login} className="login-body">
          <Flash sp={sp} />
          <label className="field">Username
            <input name="username" required autoFocus autoComplete="username" />
          </label>
          <label className="field">Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button type="submit" className="btn btn-primary"><LogIn size={17} />Masuk</button>
        </form>
        <div className="login-wali"><Link href="/wali">Wali kelas? Buka halaman wali kelas</Link></div>
      </div>
    </div>
  );
}
