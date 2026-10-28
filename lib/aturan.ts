import { fmtJam } from './util';

type J = { mulai: Date | null; selesai: Date | null } | undefined;

// Batas akhir tap masuk = mulai + batas_masuk_menit, tidak pernah melewati jam selesai gelombang
export function batasMasuk(g: any, j: J): Date | null {
  if (!j?.mulai) return null;
  let batas: Date | null = j.selesai;
  if (g.batas_masuk_menit != null) {
    const b = new Date(j.mulai.getTime() + g.batas_masuk_menit * 60000);
    if (!batas || b < batas) batas = b;
  }
  return batas;
}

// Tap pulang dibuka = selesai - buka_pulang_menit
export function bukaPulang(g: any, j: J): Date | null {
  if (!j?.selesai) return null;
  return new Date(j.selesai.getTime() - (g.buka_pulang_menit ?? 0) * 60000);
}

// Mengembalikan pesan error, atau null jika boleh. Super admin = override.
export function cekDatang(g: any, j: J, now: Date, admin: boolean): string | null {
  if (admin) return null;
  if (g.status === 'belum_mulai') return `${g.nama_gelombang} belum dimulai`;
  if (g.status === 'dibatalkan') return `${g.nama_gelombang} dibatalkan`;
  if (g.status === 'selesai') return `${g.nama_gelombang} sudah selesai, absen masuk ditutup`;
  const batas = batasMasuk(g, j);
  if (batas && now > batas) return `Batas tap masuk terlewat (${fmtJam(batas)})`;
  return null;
}

export function cekPulang(g: any, j: J, now: Date, admin: boolean): string | null {
  if (admin) return null;
  if (g.status === 'belum_mulai') return `${g.nama_gelombang} belum dimulai`;
  if (g.status === 'dibatalkan') return `${g.nama_gelombang} dibatalkan`;
  if (g.status === 'selesai') return null;
  const buka = bukaPulang(g, j);
  if (!buka) return 'Jadwal gelombang belum diketahui';
  if (now < buka) return `Absen pulang dibuka pukul ${fmtJam(buka)}`;
  return null;
}
