'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, ImagePlus, LoaderCircle, Save, Trash2 } from 'lucide-react';
import KartuTampil from '@/components/KartuTampil';
import { useServerForm } from '@/components/useServerForm';
import { showToast } from '@/components/Toaster';
import { KARTU_PER_HALAMAN, MAKS_KOP_BYTE, type DataKartu, type FilterKartu, type ItemKartu, type PengaturanKartu } from '@/lib/kartu-ujian';
import { ambilLembarKartu, simpanPengaturanKartu } from './actions';

// Kartu kosong (hanya header dan label) untuk pratinjau bila belum ada siswa bernomor ujian
const KOSONG: DataKartu = { no_induk: '', nama: '', kelas: '', ruang: '', gelombang: '', no_ujian: '', no_bangku: '', ket: [] };

// Dua kolom: kiri = pengaturan (form header + kop) dan bagian cetak (children, dari server); kanan = pratinjau SATU LEMBAR F4
// (9 kartu, skala setengah dari halaman cetak) yang ikut berubah saat mengetik. Lembar berikutnya dimuat dari server saat dibuka.
export default function KartuStudio({ p, filter, lembarPertama, jumlahLembar, urlKop, children }: {
  p: PengaturanKartu; filter: FilterKartu; lembarPertama: ItemKartu[]; jumlahLembar: number; urlKop: string; children: ReactNode;
}) {
  const [hal, setHal] = useState(0);
  const [cache, setCache] = useState<Record<number, ItemKartu[]>>({ 0: lembarPertama });
  const [memuat, mulaiMuat] = useTransition();
  const [galatLembar, setGalatLembar] = useState<string | null>(null);
  function pindah(ke: number) {
    if (ke < 0 || ke >= jumlahLembar || ke === hal) return;
    setGalatLembar(null);
    if (cache[ke]) { setHal(ke); return; }
    mulaiMuat(async () => {
      try {
        const r = await ambilLembarKartu(filter, ke);
        if (!r.ok) { setGalatLembar(r.msg ?? 'Gagal memuat lembar'); return; }
        setCache((c) => ({ ...c, [ke]: r.items })); setHal(ke);
      } catch { setGalatLembar('Gagal menghubungi server. Coba lagi.'); }
    });
  }
  const adaData = jumlahLembar > 0;
  const isi = cache[hal] ?? [];
  const [t, setT] = useState({ jenis_ujian: p.jenis_ujian, madrasah: p.madrasah, tahun_ajaran: p.tahun_ajaran });
  const [baru, setBaru] = useState<string | null>(null); // gambar yang baru dipilih (belum disimpan)
  const [namaFile, setNamaFile] = useState('');
  const [hapus, setHapus] = useState(false);
  const [salahFile, setSalahFile] = useState<string | null>(null);
  const { pending, error, onSubmit } = useServerForm(simpanPengaturanKartu, (r) => { showToast(r.msg, !!r.warn); setBaru(null); setNamaFile(''); setHapus(false); });

  const kop = hapus ? '/logo-madrasah.png' : baru ?? urlKop;
  const ubah = (k: keyof typeof t) => (e: React.ChangeEvent<HTMLInputElement>) => setT((x) => ({ ...x, [k]: e.target.value }));

  function pilihFile(f: File | null, input: HTMLInputElement) {
    setSalahFile(null); setBaru(null); setNamaFile('');
    if (!f) return;
    if (f.size > MAKS_KOP_BYTE) { setSalahFile('Ukuran gambar maksimal 1 MB'); input.value = ''; return; }
    setHapus(false); setBaru(URL.createObjectURL(f)); setNamaFile(f.name);
  }

  return (
    <div className="kartu-studio">
      <div className="kartu-kiri">
        <section className="panel">
          <div className="panel-head"><div><h2>1. Header dan kop kartu</h2><p className="panel-ket">Tampil di bagian atas setiap kartu.</p></div></div>
          <form onSubmit={onSubmit} className="panel-body">
            {(error || salahFile) && <div className="alert alert-error" role="alert"><CircleAlert size={18} /><span>{error ?? salahFile}</span></div>}
            <div className="kartu-form">
              <label className="field">Jenis ujian
                <input name="jenis_ujian" value={t.jenis_ujian} onChange={ubah('jenis_ujian')} required maxLength={100} placeholder="Ujian Tengah Semester 1" />
              </label>
              <label className="field">Tahun ajaran
                <input name="tahun_ajaran" value={t.tahun_ajaran} onChange={ubah('tahun_ajaran')} required maxLength={50} placeholder="1447-1448 H" />
                <small>&quot;Tahun Ajaran :&quot; ditambahkan otomatis</small>
              </label>
              <label className="field kartu-lebar">Madrasah yang melaksanakan ujian
                <input name="madrasah" value={t.madrasah} onChange={ubah('madrasah')} required maxLength={100} placeholder="Madrasah Al Falahiyah Langitan" />
              </label>
            </div>

            <div className="kop-atur">
              <div className="kop-gambar">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={kop} alt="Kop kartu" /></div>
              <div className="kop-aksi">
                <b>Kop / logo atas kartu</b>
                <span className="muted">PNG, JPG, atau WEBP, maksimal 1 MB. Kosong = logo madrasah bawaan.</span>
                <div className="actions">
                  <label className="btn btn-sm kop-pilih"><ImagePlus size={14} />{namaFile ? 'Ganti gambar' : 'Pilih gambar'}
                    <input type="file" name="kop" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pilihFile(e.target.files?.[0] ?? null, e.target)} />
                  </label>
                  {(p.ada_kop || baru) && !hapus && !baru && (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setHapus(true)}><Trash2 size={14} />Hapus kop</button>
                  )}
                  {hapus && <button type="button" className="btn btn-sm" onClick={() => setHapus(false)}>Batal hapus</button>}
                </div>
                {namaFile && <small className="muted">Dipilih: {namaFile} (belum disimpan)</small>}
                {hapus && <small className="muted">Kop unggahan akan dihapus saat disimpan.</small>}
                <input type="hidden" name="hapus_kop" value={hapus ? '1' : ''} />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={pending || !!salahFile}>
                {pending ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{pending ? 'Menyimpan…' : 'Simpan pengaturan'}
              </button>
            </div>
          </form>
        </section>
        {children}
      </div>

      <aside className="kartu-kanan" aria-label="Pratinjau lembar kartu">
        <div className="kartu-preview">
          <div className="kartu-preview-kepala">
            <b>Pratinjau lembar F4</b>
            <span className="muted">{adaData ? `${KARTU_PER_HALAMAN} kartu per lembar` : 'Belum ada data'}</span>
          </div>
          <div className="kartu-preview-badan">
            <div className="kartu-skala" data-memuat={memuat || undefined}>
              <div className="kartu-lembar">
                {Array.from({ length: KARTU_PER_HALAMAN }, (_, i) => {
                  const it = isi[i];
                  if (it) return <KartuTampil key={it.d.no_induk} d={it.d} t={t} kop={kop} qr={it.qr} bar={it.bar} />;
                  // belum ada data sama sekali: kartu kosong berisi header agar tampilan bisa dinilai; lembar terakhir yang tidak penuh: sel kosong
                  return adaData ? <div key={i} className="kartu-id" /> : <KartuTampil key={i} d={KOSONG} t={t} kop={kop} qr="" bar="" />;
                })}
              </div>
            </div>
          </div>
          <div className="kartu-pager">
            <button type="button" className="btn btn-sm" onClick={() => pindah(hal - 1)} disabled={hal <= 0 || memuat}><ChevronLeft size={14} />Sebelumnya</button>
            <span>{memuat ? <LoaderCircle size={14} className="spin" /> : null} Lembar <b>{adaData ? hal + 1 : 0}</b> dari <b>{jumlahLembar}</b></span>
            <button type="button" className="btn btn-sm" onClick={() => pindah(hal + 1)} disabled={hal >= jumlahLembar - 1 || memuat}>Berikutnya<ChevronRight size={14} /></button>
          </div>
          {galatLembar && <p className="kartu-preview-ket" style={{ color: '#a11' }}>{galatLembar}</p>}
          <p className="kartu-preview-ket muted">Teks header berubah langsung saat Anda mengetik. Simpan agar dipakai saat mencetak.</p>
        </div>
      </aside>
    </div>
  );
}
