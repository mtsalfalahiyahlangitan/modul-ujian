import ExcelJS from 'exceljs';
import { getMe } from '@/lib/auth';
import { bisa } from '@/lib/akses';
import { adminDb } from '@/lib/supabase/admin';
import { formatGelombang } from '@/lib/gelombang-input';
import { fetchAll } from '@/lib/util';

export const runtime = 'nodejs';

// GET /api/siswa/template-ruang -> daftar SEMUA siswa yang sudah ada di database; tinggal isi Kode Ruang & Gelombang.
export async function GET() {
  const me = await getMe();
  if (!me) return new Response('Unauthorized', { status: 401 });
  if (!bisa(me, 'siswa')) return new Response('Forbidden', { status: 403 });

  const db = adminDb();
  const [ruangR, gelR, siswa] = await Promise.all([
    db.from('ruang').select('id,kode_ruang,nama_ruang').order('kode_ruang'),
    db.from('gelombang').select('urutan,nama_gelombang').order('urutan'),
    fetchAll((a, b) => db.from('siswa')
      .select('no_induk,nama,kelas,asrama,kamar,no_ujian,no_bangku,ruang:ruang_id(kode_ruang),semua:siswa_gelombang(gelombang(urutan,nama_gelombang))')
      .order('kelas').order('nama').order('id').range(a, b)),
  ]);
  const ruang = ruangR.data ?? [], gels = gelR.data ?? [];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Ruang & Gelombang', { views: [{ state: 'frozen', ySplit: 1 }] });
  const teks = { numFmt: '@' };
  ws.columns = [
    { header: 'No. Induk', key: 'no_induk', width: 14, style: teks },
    { header: 'Nama', key: 'nama', width: 32, style: teks },
    { header: 'Kelas', key: 'kelas', width: 9, style: teks },
    { header: 'Asrama', key: 'asrama', width: 16, style: teks },
    { header: 'Kode Ruang', key: 'ruang', width: 14, style: teks },
    { header: 'Gelombang', key: 'gelombang', width: 14, style: teks },
    { header: 'No. Ujian', key: 'no_ujian', width: 12, style: teks },
    { header: 'No. Bangku', key: 'no_bangku', width: 12, style: teks },
  ];
  siswa.forEach((s: any) => ws.addRow({
    no_induk: s.no_induk, nama: s.nama, kelas: s.kelas, asrama: s.asrama,
    ruang: s.ruang?.kode_ruang ?? '', no_ujian: s.no_ujian ?? '', no_bangku: s.no_bangku ?? '',
    gelombang: formatGelombang(((s.semua ?? []) as any[]).map((x) => x.gelombang).filter(Boolean)),
  }));
  ws.getRow(1).eachCell((c, n) => {
    const isi = n >= 5; // kolom yang diisi pengguna
    c.font = { bold: true, color: { argb: isi ? 'FF000000' : 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isi ? 'FFFFE699' : 'FF17614A' } };
  });
  ws.autoFilter = { from: 'A1', to: 'H1' };
  if (ruang.length) {
    for (let r = 2; r <= siswa.length + 1; r++) {
      ws.getCell(r, 5).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: [`Petunjuk!$D$2:$D$${ruang.length + 1}`] };
    }
  }

  const pt = wb.addWorksheet('Petunjuk');
  pt.getColumn(1).width = 14; pt.getColumn(2).width = 72; pt.getColumn(4).width = 14; pt.getColumn(5).width = 28; pt.getColumn(7).width = 10; pt.getColumn(8).width = 24;
  pt.addRow(['Kolom', 'Keterangan']).font = { bold: true };
  [
    ['No. Induk', 'Kunci pencocokan dengan data siswa. Jangan diubah.'],
    ['Nama, Kelas, Asrama', 'Hanya sebagai acuan, tidak diproses saat upload.'],
    ['Kode Ruang', 'Isi dengan kode ruang pada daftar di sebelah kanan. Kosong = tidak diubah.'],
    ['Gelombang', 'Nomor urutan gelombang; pisahkan dengan & jika lebih dari satu, contoh 1&3. Kosong = tidak diubah.'],
    ['No. Ujian', 'Nomor ujian siswa (jadi barcode di kartu ujian). Tidak boleh sama dengan siswa lain. Kosong = tidak diubah.'],
    ['No. Bangku', 'Nomor bangku di ruang ujian. Kosong = tidak diubah.'],
  ].forEach((r) => pt.addRow(r));
  pt.getCell('D1').value = 'Kode Ruang'; pt.getCell('E1').value = 'Nama Ruang';
  pt.getCell('G1').value = 'Urutan'; pt.getCell('H1').value = 'Nama Gelombang';
  ['D1', 'E1', 'G1', 'H1'].forEach((a) => (pt.getCell(a).font = { bold: true }));
  ruang.forEach((r: any, i) => { pt.getCell(`D${i + 2}`).value = r.kode_ruang; pt.getCell(`E${i + 2}`).value = r.nama_ruang; });
  gels.forEach((g: any, i) => { pt.getCell(`G${i + 2}`).value = g.urutan; pt.getCell(`H${i + 2}`).value = g.nama_gelombang; });

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-ruang-gelombang.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
