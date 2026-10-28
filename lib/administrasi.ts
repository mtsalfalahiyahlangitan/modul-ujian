// Administrasi: hutang / catatan administrasi siswa. Satu siswa bisa punya beberapa catatan (baris) dengan keterangan berbeda.
// Dipakai saat upload TU dan saat pengampu menceklis catatan, agar alasan / rincian di tabel persyaratan_terjaring
// (tampil di Dashboard persyaratan) selalu sama dengan ceklis.
export type ItemAdministrasi = { id: number; keterangan: string; nominal: number | null; urutan: number; ceklis: boolean };

export const LABEL_TANPA_KETERANGAN = 'Tanpa keterangan (dipanggil ke kantor)';
export const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
export const namaItem = (i: { keterangan: string }) => i.keterangan || LABEL_TANPA_KETERANGAN;
const teksItem = (i: { keterangan: string; nominal: number | null }) => `${namaItem(i)}${i.nominal != null ? ` (${rupiah(i.nominal)})` : ''}`;

// Nominal dari sel Excel: "75000", "75.000", "Rp 75.000". Kosong -> null (sah). Bukan angka -> undefined (error).
export function parseNominal(raw: string): number | null | undefined {
  const t = String(raw ?? '').trim();
  if (!t || t === '-') return null;
  if (!/^(rp\.?)?\s*[\d.,\s]+$/i.test(t)) return undefined;
  const n = Number(t.replace(/^rp\.?/i, '').replace(/[^\d]/g, ''));
  return Number.isSafeInteger(n) && n <= 1_000_000_000_000 ? n : undefined;
}

// Kunci pencocokan catatan antar upload: keterangan (huruf kecil, spasi dirapikan) + nomor kemunculan bila keterangan sama muncul lagi.
export const kunciCatatan = (keterangan: string, kemunculan: number) => `${keterangan.toLowerCase().replace(/\s+/g, ' ').trim()}#${kemunculan}`;

export function ringkasAdministrasi(items: { keterangan: string; nominal: number | null; urutan: number; ceklis: boolean }[]) {
  const belum = items.filter((i) => !i.ceklis).sort((a, b) => a.urutan - b.urutan);
  const lengkap = items.length > 0 && belum.length === 0;
  const sisa = belum.reduce((n, i) => n + (i.nominal ?? 0), 0);
  return {
    lengkap, belum: belum.map(teksItem),
    alasan: lengkap ? `Semua ${items.length} catatan administrasi sudah selesai` : `Belum selesai ${belum.length} dari ${items.length} catatan administrasi`,
    detail: {
      jumlah_catatan: items.length, sudah_selesai: items.length - belum.length,
      belum_selesai: belum.map(teksItem), ...(sisa > 0 ? { sisa_nominal: rupiah(sisa) } : {}),
    },
  };
}
