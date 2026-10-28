import { createHash } from 'crypto';
import { cookies } from 'next/headers';

// Halaman wali kelas (/wali) tidak memakai login. Wali memilih namanya, pilihan diingat lewat cookie.
// Pengaman opsional: bila WALI_KODE_AKSES diisi di environment, halaman meminta kode itu sekali (lalu diingat 90 hari).
export type Wali = { id: number; nama: string; kelas: string[] };
export const COOKIE_WALI = 'wali_id';
export const COOKIE_AKSES = 'wali_akses';

export const kodeAkses = () => (process.env.WALI_KODE_AKSES ?? '').trim();
export const tandaAkses = (kode: string) => createHash('sha256').update(`wali-akses:${kode}`).digest('hex');

export async function aksesSah(): Promise<boolean> {
  const k = kodeAkses();
  if (!k) return true;
  return (await cookies()).get(COOKIE_AKSES)?.value === tandaAkses(k);
}
