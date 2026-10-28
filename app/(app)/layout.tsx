import { requireMe } from '@/lib/auth';
import { menuUntuk } from '@/lib/nav';
import { LABEL_PERAN } from '@/lib/akses';
import { logout } from '../login/actions';
import Toaster from '@/components/Toaster';
import ConfirmHost from '@/components/ConfirmHost';
import Sidebar from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  return (
    <div className="shell">
      <Sidebar items={menuUntuk(me)} nama={me.nama} peran={LABEL_PERAN[me.role] ?? me.role} logoutAction={logout} />
      <main className="main"><div className="page">{children}</div></main>
      <Toaster />
      <ConfirmHost />
    </div>
  );
}
