import { NextRequest } from 'next/server';
import { getMe, bolehAksesRuang } from '@/lib/auth';
import { bisa, lihatSemuaRuang } from '@/lib/akses';
import { buildLaporan } from '@/lib/laporan';
import { toCsv } from '@/lib/csv';
import { fmtJam, tanggalHariIni } from '@/lib/util';

// GET /api/laporan?ruang=<id|semua>&gel=<id>&tanggal=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const me = await getMe();
  if (!me) return new Response('Unauthorized', { status: 401 });
  if (!bisa(me, 'laporan')) return new Response('Forbidden', { status: 403 });

  const sp = req.nextUrl.searchParams;
  const tanggal = sp.get('tanggal') || tanggalHariIni();
  const gelId = sp.get('gel') ? Number(sp.get('gel')) : null;
  const ruangParam = sp.get('ruang');

  let ruangId: number | null = null;
  if (ruangParam === 'semua') {
    if (!lihatSemuaRuang(me)) return new Response('Forbidden', { status: 403 });
  } else {
    ruangId = Number(ruangParam);
    if (!ruangId || !bolehAksesRuang(me, ruangId)) return new Response('Forbidden', { status: 403 });
  }

  const { rows, ruang } = await buildLaporan({ ruangId, gelId, tanggal });
  const csv = toCsv([
    ['No Induk', 'Nama', 'Asrama', 'Kelas', 'Ruang', 'Gelombang', 'Status', 'Jam Datang', 'Jam Pulang', 'Keterangan'],
    ...rows.map((r) => [r.no_induk, r.nama, r.asrama, r.kelas, r.ruang, r.gelombang, r.status,
      r.datang ? fmtJam(r.datang, true) : '', r.pulang ? fmtJam(r.pulang, true) : '', r.keterangan]),
  ]);
  const nama = ruangId ? ruang?.kode_ruang ?? 'ruang' : 'semua-ruang';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="absensi_${nama}_${tanggal}.csv"`,
    },
  });
}
