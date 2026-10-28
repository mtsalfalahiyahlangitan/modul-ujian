import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { getMe, kelasBoleh } from '@/lib/auth';
import { bisaSub } from '@/lib/akses';
import { adminDb } from '@/lib/supabase/admin';
import { ambilDataCetak, bacaParamCetak, teksPersyaratan, type ParamCetak } from '@/lib/persyaratan-cetak';
import { singkatJenis } from '@/lib/persyaratan';
import { tanggalHariIni } from '@/lib/util';

// GET /api/persyaratan/unduh?status=semua|terjaring|lengkap&kelas=&asrama=&judul=  -> file Excel (isi sama dengan halaman cetak)
export async function GET(req: NextRequest) {
  const me = await getMe();
  if (!me) return new Response('Unauthorized', { status: 401 });
  if (!bisaSub(me, 'dashboard')) return new Response('Forbidden', { status: 403 }); // unduh mengikuti Dashboard persyaratan

  const sp = Object.fromEntries(req.nextUrl.searchParams) as ParamCetak;
  const p = bacaParamCetak(sp);
  const { baris, adaData, jenis } = await ambilDataCetak(adminDb(), p, await kelasBoleh(me, 'dashboard'));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Persyaratan ujian', { views: [{ state: 'frozen', ySplit: 3 }], pageSetup: { paperSize: 14 as any, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: p.maks ?? 0, printTitlesRow: '3:3', margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } } });
  // Lebar kolom mengikuti isi terpanjang agar tiap siswa tetap satu baris (tanpa bungkus teks)
  const lebar = (f: (s: (typeof baris)[number]) => string, min: number, maks: number) => Math.min(maks, Math.max(min, ...baris.map((s) => f(s).length + 2)));
  ws.columns = [
    { width: 6 }, { width: 11 }, { width: lebar((s) => s.nama, 20, 70) },
    { width: lebar((s) => s.asrama, 10, 30) }, { width: 8 }, { width: lebar((s) => teksPersyaratan(s, adaData), 20, 120) },
  ];
  ws.getCell('A1').value = p.judul; ws.getCell('A1').font = { bold: true, size: 12 }; // judul hanya sekali di atas
  // Baris 2: keterangan singkatan (ABS = Absen 10%, dst.)
  ws.getCell('A2').value = 'Keterangan: ' + jenis.map((j) => `${singkatJenis(j.kode, j.nama)} = ${j.nama}`).join(', ');
  ws.getCell('A2').font = { size: 10 };

  const head = ws.getRow(3);
  head.values = ['NO', 'INDUK', 'NAMA', 'ASRAMA', 'KELAS', 'PERSYARATAN'];
  head.eachCell((c) => {
    c.font = { bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF21B24B' } };
    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });
  baris.forEach((s, i) => {
    const r = ws.addRow([i + 1, s.no_induk, s.nama, s.asrama, s.kelas, teksPersyaratan(s, adaData)]);
    r.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      c.alignment = { vertical: 'top', wrapText: false, horizontal: col === 1 || col === 5 ? 'center' : 'left' };
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
    });
    r.getCell(2).numFmt = '@';
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="persyaratan-ujian_${p.status}_${tanggalHariIni()}.xlsx"`,
    },
  });
}
