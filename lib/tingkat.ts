// Tingkat kelas (7/8/9, dst.) dibaca dari teks kelas di data siswa. Murni (tanpa server).
const ROMAWI: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };

// "7 A", "7-B", "Kelas 8 C" -> tingkat 7/8; "VII A", "IX" -> 7/9. Sisanya (A, B, Tsanawiyah A, dst.) menjadi rombel.
// null = tingkat tidak terbaca.
export function uraiKelas(k: string): { tingkat: number | null; sisa: string } {
  const t = k.trim().replace(/^kelas\s*/i, '');
  const a = t.match(/^(\d+)\s*(.*)$/);
  if (a) return { tingkat: Number(a[1]), sisa: a[2].replace(/^[\s\-_/.]+/, '') };
  const r = t.match(/^(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?![A-Za-z])\s*(.*)$/i);
  if (r) return { tingkat: ROMAWI[r[1].toUpperCase()], sisa: r[2].replace(/^[\s\-_/.]+/, '') };
  return { tingkat: null, sisa: t };
}

export const tingkatDariKelas = (kelas: string | null | undefined): number | null => uraiKelas(String(kelas ?? '')).tingkat;

// Tingkat yang ada pada sekumpulan teks kelas (urut naik) + jumlah kelas yang tingkatnya tidak terbaca.
export function ringkasTingkat(daftarKelas: string[]): { tingkat: number[]; takTerbaca: number } {
  const ada = new Set<number>();
  let takTerbaca = 0;
  for (const k of daftarKelas) {
    const t = tingkatDariKelas(k);
    if (t === null) takTerbaca++; else ada.add(t);
  }
  return { tingkat: [...ada].sort((a, b) => a - b), takTerbaca };
}
