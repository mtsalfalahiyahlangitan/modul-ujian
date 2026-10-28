// Manifest PWA khusus halaman wali kelas: aplikasi yang dipasang dari sini langsung terbuka di /wali.
export function GET() {
  return Response.json(
    {
      name: 'Module Ujian - Wali Kelas',
      short_name: 'Wali Kelas',
      description: 'Pantau persyaratan ujian siswa di kelas Anda',
      lang: 'id',
      start_url: '/wali',
      scope: '/wali',
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
