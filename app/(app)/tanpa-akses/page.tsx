import { LockKeyhole } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

// Akun yang belum diberi akses ke menu apa pun mendarat di sini.
export default function TanpaAkses() {
  return (
    <div>
      <PageHeader title="Belum ada akses" />
      <div className="alert alert-warn" role="alert">
        <LockKeyhole size={18} />
        <span>Akun Anda belum diberi akses ke menu apa pun. Hubungi administrator untuk mengaturnya.</span>
      </div>
    </div>
  );
}
