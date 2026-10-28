import ExcelJS from 'exceljs';
import { getMe } from '@/lib/auth';
import { bisa } from '@/lib/akses';
import { KOLOM_SISWA } from '@/lib/siswa-import';

export const runtime = 'nodejs';

// GET /api/siswa/template -> template data siswa (urutan kolom sama dengan tabel Data siswa).
// Untuk data dari aplikasi madrasah, file ekspornya bisa langsung diupload tanpa template ini.
export async function GET() {
  const me = await getMe();
  if (!me) return new Response('Unauthorized', { status: 401 });
  if (!bisa(me, 'siswa')) return new Response('Forbidden', { status: 403 });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Siswa', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = KOLOM_SISWA.map((k) => ({ header: k.judul, key: k.key, width: k.lebar, style: { numFmt: '@' } })); // teks: angka 0 di depan tidak hilang
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17614A' } };
  });
  const pt = wb.addWorksheet('Petunjuk');
  pt.getColumn(1).width = 14; pt.getColumn(2).width = 80;
  pt.addRow(['Kolom', 'Keterangan']).font = { bold: true };
  [
    ['No. Induk', 'Wajib, unik. Jika sudah ada di sistem, datanya diperbarui.'],
    ['Nama', 'Wajib.'], ['Asrama', 'Wajib.'], ['Kamar', 'Opsional.'], ['Kelas', 'Wajib.'],
    ['RFID', 'Opsional, unik. Kosong atau "-" = tidak diubah.'],
  ].forEach((r) => pt.addRow(r));
  pt.addRow([]);
  pt.addRow(['Ruang ujian dan gelombang diisi lewat menu Tambah siswa → Upload ruang & gelombang.']);

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-data-siswa.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
