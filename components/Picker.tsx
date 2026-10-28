import Link from 'next/link';

// Admin: pilih ruang. Semua: filter gelombang (hanya untuk tampilan daftar & tombol massal)
export default function Picker({ ctx }: { ctx: any }) {
  if (!ctx.isAdmin && !ctx.ruang) return null;
  const rq = ctx.ruang ? `ruang=${ctx.ruang.id}` : '';
  return (
    <div className="panel">
      <div className="panel-body">
        {ctx.isAdmin && (
          <div className="filter-row">
            <span className="filter-label">Ruang</span>
            <div className="chips">
              {ctx.ruangList.map((r: any) => (
                <Link key={r.id} href={`/absen?ruang=${r.id}`} className="chip" aria-current={ctx.ruang?.id === r.id}>{r.kode_ruang}</Link>
              ))}
            </div>
          </div>
        )}
        {ctx.ruang && (
          <div className="filter-row">
            <span className="filter-label">Gelombang</span>
            <div className="chips">
              <Link href={`/absen?${rq}`} className="chip" aria-current={!ctx.gel}>Semua</Link>
              {ctx.gelList.map((g: any) => (
                <Link key={g.id} href={`/absen?${rq}&gel=${g.id}`} className="chip" aria-current={ctx.gel?.id === g.id}>{g.nama_gelombang}</Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
