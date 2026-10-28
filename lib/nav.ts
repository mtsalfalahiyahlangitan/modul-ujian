import type { Me } from './auth';
import { AREA, bisa, subYangBoleh, type KunciAkses } from './akses';

// Daftar menu sidebar. Tambah / ubah / urutkan menu cukup di file ini.
export type NavIcon = 'dashboard' | 'siswa' | 'ruang' | 'gelombang' | 'absen' | 'laporan' | 'persyaratan' | 'wali' | 'kartu' | 'pengaturan';
export type NavSub = { href: string; label: string };
export type NavItem = { href: string; label: string; icon: NavIcon; sub?: NavSub[] };

// Jenis penjaringan persyaratan ujian (submenu + halaman /persyaratan/<slug>) ada di lib/jenis-persyaratan.ts
export { JENIS_PERSYARATAN } from './jenis-persyaratan';


// Ikon dan submenu per area; label dan alamat diambil dari AREA di lib/akses.ts
const ICON: Record<KunciAkses, NavIcon> = {
  dashboard: 'dashboard', siswa: 'siswa', persyaratan: 'persyaratan', wali: 'wali', ruang: 'ruang', gelombang: 'gelombang', absen: 'absen', laporan: 'laporan', kartu: 'kartu',
};

// Menu sidebar sesuai hak akses akun: hanya menu yang boleh dibuka yang tampil
export function menuUntuk(me: Me): NavItem[] {
  const items: NavItem[] = AREA.filter((a) => bisa(me, a.key)).map((a) => {
    if (a.key !== 'persyaratan') return { href: a.href, label: a.label, icon: ICON[a.key] };
    return {
      href: a.href, label: a.label, icon: ICON[a.key],
      // submenu hanya yang boleh dibuka akun ini; alamat induk tetap /persyaratan (kunci grup & penanda aktif di sidebar)
      sub: subYangBoleh(me).map((x) => ({ href: x.href, label: x.label })),
    };
  });
  if (bisa(me, 'pengaturan')) items.push({ href: '/pengaturan', label: 'Pengaturan', icon: 'pengaturan' });
  return items;
}
