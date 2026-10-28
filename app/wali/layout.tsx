import type { Metadata } from 'next';

// Halaman wali kelas: tanpa sidebar dan tanpa login, dirancang untuk HP.
export const metadata: Metadata = {
  title: 'Wali Kelas - Module Ujian',
  manifest: '/wali/manifest',
  appleWebApp: { capable: true, title: 'Wali Kelas', statusBarStyle: 'default' },
};

export default function WaliLayout({ children }: { children: React.ReactNode }) {
  return <div className="wali-shell">{children}</div>;
}
