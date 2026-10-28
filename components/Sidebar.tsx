'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import LinkPending from './LinkPending';
import LogoMadrasah from './LogoMadrasah';
import type { NavIcon, NavItem } from '@/lib/nav';
import './Sidebar.css';
import type { LucideIcon } from 'lucide-react';
import { CalendarClock, ChevronDown, ClipboardCheck, DoorOpen, FileSpreadsheet, IdCard, LayoutDashboard, LogOut, Menu, ScanLine, Settings, UserRound, Users, X } from 'lucide-react';

const ICONS: Record<NavIcon, LucideIcon> = { dashboard: LayoutDashboard, siswa: Users, ruang: DoorOpen, gelombang: CalendarClock, absen: ScanLine, laporan: FileSpreadsheet, persyaratan: ClipboardCheck, wali: UserRound, kartu: IdCard, pengaturan: Settings };

export default function Sidebar({ items, nama, peran, logoutAction }: {
  items: NavItem[]; nama: string; peran: string; logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dalam = (href: string) => pathname === href || pathname.startsWith(href + '/');
  // Grup submenu: terbuka otomatis bila halaman aktif ada di dalamnya; selebihnya mengikuti klik pengguna
  const [grup, setGrup] = useState<Record<string, boolean>>(() => Object.fromEntries(items.filter((i) => i.sub && dalam(i.href)).map((i) => [i.href, true])));
  useEffect(() => {
    setGrup((g) => {
      const n = { ...g };
      items.forEach((i) => { if (i.sub && dalam(i.href)) n[i.href] = true; });
      return n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="Buka menu" onClick={() => setOpen(true)}><Menu size={22} /></button>
        <LogoMadrasah size={30} />
        <b>Module Ujian</b>
      </header>
      <div className={`scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`side${open ? ' open' : ''}`}>
        <div className="side-brand">
          <LogoMadrasah />
          <div><b>Module Ujian</b><small>Kelola ujian madrasah</small></div>
          <button type="button" className="icon-btn" aria-label="Tutup menu" onClick={() => setOpen(false)}
            style={{ marginLeft: 'auto', display: open ? 'inline-grid' : 'none' }}><X size={20} /></button>
        </div>
        <nav className="side-nav" aria-label="Menu utama">
          {items.map((it) => {
            const Icon = ICONS[it.icon];
            if (it.sub) {
              const terbuka = !!grup[it.href];
              const idSub = `sub-${it.icon}`;
              return (
                <div key={it.href} className="side-grup">
                  <button type="button" className="side-grup-btn" aria-expanded={terbuka} aria-controls={idSub}
                    data-aktif={dalam(it.href) ? 'true' : undefined}
                    onClick={() => setGrup((g) => ({ ...g, [it.href]: !g[it.href] }))}>
                    <Icon size={18} />{it.label}<ChevronDown size={16} className="chev" aria-hidden />
                  </button>
                  {terbuka && (
                    <div id={idSub} className="side-sub">
                      {it.sub.map((sb) => {
                        const aktifSub = sb.href === it.href ? pathname === sb.href : dalam(sb.href);
                        return (
                          <Link key={sb.href} href={sb.href} aria-current={aktifSub ? 'page' : undefined}>
                            {sb.label}<LinkPending />
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const aktif = dalam(it.href);
            return (
              <Link key={it.href} href={it.href} aria-current={aktif ? 'page' : undefined}>
                <Icon size={18} />{it.label}<LinkPending />
              </Link>
            );
          })}
        </nav>
        <div className="side-user">
          <div className="who"><b>{nama}</b><small>{peran}</small></div>
          <form action={logoutAction}>
            <button type="submit" className="icon-btn" aria-label="Keluar" title="Keluar"><LogOut size={18} /></button>
          </form>
        </div>
      </aside>
    </>
  );
}
