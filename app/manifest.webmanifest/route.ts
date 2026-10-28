// Manifest PWA utama (admin dan petugas): aplikasi bisa dipasang ke layar utama / dock dan dibuka tanpa bilah browser.
// Ikon memakai public/logo-madrasah.png. Untuk hasil paling tajam, sediakan logo persegi minimal 512x512 piksel.
// Dibuat sebagai route (bukan app/manifest.ts) agar halaman /wali bisa memakai manifest sendiri lewat metadata.
export function GET() {
  return Response.json(
    {
      name: 'Module Ujian',
      short_name: 'Module Ujian',
      description: 'Aplikasi pengelolaan ujian madrasah: absensi, persyaratan, laporan, dan kartu ujian',
      lang: 'id',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#f2f4f3',
      theme_color: '#12332a',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
