const SISWA: Record<string, string> = {
  'Belum Absen': 'badge-gray',
  'Hadir': 'badge-green',
  'Selesai': 'badge-blue',
  'Tidak Hadir': 'badge-red',
  'Tidak Pulang Tercatat': 'badge-amber',
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${SISWA[status] ?? 'badge-gray'}`}>{status}</span>;
}

const GEL: Record<string, [string, string]> = {
  belum_mulai: ['Belum mulai', 'badge-gray'],
  berlangsung: ['Berlangsung', 'badge-green'],
  selesai: ['Selesai', 'badge-blue'],
  dibatalkan: ['Dibatalkan', 'badge-red'],
};
export function GelBadge({ status }: { status: string }) {
  const [label, cls] = GEL[status] ?? [status, 'badge-gray'];
  return <span className={`badge ${cls}`}>{label}</span>;
}
