// Hasil pratinjau upload Excel (dipakai pop up upload siswa maupun upload ruang & gelombang).
export type BarisPratinjau = { baris: number; status: string; pesan: string; [kolom: string]: string | number };
export type Ringkasan = { status: string; label: string; cls: string; jumlah: number };
export type Pratinjau =
  | { ok: false; msg: string }
  | { ok: true; namaFile: string; total: number; bisaDiimpor: number; ringkasan: Ringkasan[]; rows: BarisPratinjau[] };
