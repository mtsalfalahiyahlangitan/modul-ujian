// Service worker minimal: syarat agar browser menganggap aplikasi ini bisa dipasang.
// Sengaja tidak menyimpan cache: semua permintaan tetap ke jaringan agar data absensi selalu terbaru dan login tidak tersangkut.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
