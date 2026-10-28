// Filter daftar Data siswa. Dipakai halaman daftar dan "hapus semua hasil filter", agar keduanya selalu sama.
// Bila sp.gel diisi, query harus memuat relasi  sg:siswa_gelombang!inner(gelombang_id).
export type FilterSiswa = { q?: string; kelas?: string; asrama?: string; ruang?: string; gel?: string };

export function filterSiswa(q: any, sp: FilterSiswa) {
  if (sp.gel) q = q.eq('sg.gelombang_id', Number(sp.gel));
  if (sp.q) {
    const k = sp.q.replace(/[,()%]/g, ' ').trim();
    q = q.or(`nama.ilike.%${k}%,no_induk.ilike.%${k}%,rfid.ilike.%${k}%,no_ujian.ilike.%${k}%`);
  }
  if (sp.kelas) q = q.eq('kelas', sp.kelas);
  if (sp.asrama) q = q.eq('asrama', sp.asrama);
  if (sp.ruang) q = q.eq('ruang_id', Number(sp.ruang));
  return q;
}

// Batasi query ke kelas yang diizinkan akun (hasil kelasBoleh di lib/auth.ts). kelas null = semua kelas, tanpa penyaringan.
// kolom = 'kelas' untuk tabel siswa, atau 's.kelas' bila siswa digabung dengan alias s (mis. s:siswa!inner(kelas)).
export function batasiKelas(q: any, kelas: string[] | null, kolom = 'kelas'): any {
  if (kelas === null) return q;
  return q.in(kolom, kelas.length ? kelas : ['__tidak_ada_kelas__']); // daftar kosong -> tak ada baris yang cocok
}
