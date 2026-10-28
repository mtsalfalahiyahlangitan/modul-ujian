import './globals.css';
import { Bebas_Neue } from 'next/font/google';
import PasangAplikasi from '@/components/PasangAplikasi';

// Ikon tab browser dan layar utama diambil otomatis oleh Next.js dari app/icon.png, app/apple-icon.png, dan app/favicon.ico (versi persegi kecil dari logo madrasah)
export const metadata = {
  title: 'Module Ujian',
  description: 'Absensi, persyaratan, dan kartu ujian madrasah',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Module Ujian', statusBarStyle: 'default' as const },
};
// Bebas Neue untuk judul kartu ujian (diunduh Next.js saat build lalu disajikan dari server sendiri)
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-bebas' });

export const viewport = { themeColor: '#12332a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={bebas.variable}>
      <body>{children}<PasangAplikasi /></body>
    </html>
  );
}
