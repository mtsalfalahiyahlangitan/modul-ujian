import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export const TZ = 'Asia/Jakarta';

export function tanggalHariIni() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}

// 2026-10-25 -> "Minggu, 25 Oktober 2026"
export function fmtTanggal(ymd: string) {
  return new Date(ymd + 'T00:00:00+07:00').toLocaleDateString('id-ID', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function fmtJam(v: string | Date | null | undefined, detik = false) {
  if (!v) return '-';
  const d = typeof v === 'string' ? new Date(v) : v;
  return d.toLocaleTimeString('id-ID', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
    ...(detik ? { second: '2-digit' as const } : {}),
  });
}

// untuk <input type="datetime-local"> (waktu WIB)
export function toInputDateTime(v: string | null | undefined) {
  if (!v) return '';
  return new Date(v).toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 16).replace(' ', 'T');
}
export function fromInputDateTime(s: string) {
  return s ? new Date(s + ':00+07:00').toISOString() : null;
}

export function str(v: FormDataEntryValue | null) {
  return String(v ?? '').trim();
}
export function num(v: FormDataEntryValue | null) {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function withParam(path: string, key: string, msg: string) {
  return `${path}${path.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(msg)}`;
}
export function fail(path: string, msg: string): never {
  redirect(withParam(path, 'error', msg));
}
export function ok(path: string, msg: string): never {
  revalidatePath('/', 'layout'); // data berubah: buang cache halaman (server & router) agar daftar tidak basi
  redirect(withParam(path, 'msg', msg));
}

// Hasil form yang dikirim balik ke pop up (tanpa redirect), supaya error tampil di dalam pop up
// dan isian tidak hilang.
export type FormState = { ok: boolean; msg: string; warn?: boolean };
export const gagal = (msg: string): FormState => ({ ok: false, msg });
export const sukses = (msg: string, warn = false): FormState => ({ ok: true, msg, warn });

// Status kehadiran turunan (sesuai PRD 6.4)
export function statusSiswa(a: any | null, gelStatus?: string) {
  if (!a) return 'Belum Absen';
  if (a.status_kehadiran === 'tidak_hadir') return 'Tidak Hadir';
  if (a.waktu_pulang) return 'Selesai';
  if (gelStatus === 'selesai') return 'Tidak Pulang Tercatat';
  return 'Hadir';
}

// Supabase membatasi 1000 baris per query. Halaman pertama diambil sendiri (kebanyakan data cukup 1 halaman);
// bila penuh, halaman berikutnya diambil 4 sekaligus, bukan satu per satu.
export async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
): Promise<any[]> {
  const PAGE = 1000, PAR = 4;
  const first = await build(0, PAGE - 1);
  if (first.error) throw new Error(first.error.message);
  const out: any[] = [...(first.data ?? [])];
  if (out.length < PAGE) return out;
  for (let from = PAGE; ; from += PAGE * PAR) {
    const res = await Promise.all(
      Array.from({ length: PAR }, (_, i) => build(from + i * PAGE, from + (i + 1) * PAGE - 1))
    );
    let selesai = false;
    for (const r of res) {
      if (r.error) throw new Error(r.error.message);
      out.push(...(r.data ?? []));
      if ((r.data?.length ?? 0) < PAGE) { selesai = true; break; }
    }
    if (selesai) break;
  }
  return out;
}
