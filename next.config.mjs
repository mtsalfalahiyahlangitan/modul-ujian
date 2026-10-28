/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
    // Halaman yang baru saja dibuka dipakai ulang sebentar. Dimatikan (0) agar status gelombang yang mengikuti jam selalu segar.
    // Setiap simpan/hapus otomatis membuang cache ini. Ubah ke 0 jika ingin selalu ambil data terbaru.
    staleTimes: { dynamic: 0 },
  },
};
export default nextConfig;
