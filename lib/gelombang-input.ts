// Mengubah teks seperti "1&3", "1 & 3", "Gelombang 1 + Gelombang 3", "1 dan 3"
// menjadi daftar id gelombang. Cocok dengan nama gelombang ATAU nomor urutan.
type Gel = { id: number; urutan: number; nama_gelombang: string };

export function parseGelombang(raw: string, gels: Gel[]): { ids: number[]; error: string | null } {
  const teks = (raw ?? '').trim();
  if (!teks) return { ids: [], error: null };
  const ids: number[] = [];
  for (const t of teks.split(/[&+,;\/|]|\bdan\b/i).map((x) => x.trim()).filter(Boolean)) {
    const low = t.toLowerCase();
    let g = gels.find((x) => x.nama_gelombang.toLowerCase() === low);
    if (!g) {
      const m = low.match(/^(?:gelombang|gel\.?|g)?\s*(\d+)$/);
      if (m) g = gels.find((x) => x.urutan === Number(m[1]));
    }
    if (!g) return { ids: [], error: `gelombang "${t}" tidak ada` };
    if (!ids.includes(g.id)) ids.push(g.id);
  }
  return { ids, error: null };
}

// Untuk ditampilkan kembali di form: [1,3] -> "1&3"
export function formatGelombang(gels: Gel[]): string {
  return [...gels].sort((a, b) => a.urutan - b.urutan).map((g) => g.urutan).join('&');
}
