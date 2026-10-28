import { getMe } from '@/lib/auth';
import { bisa } from '@/lib/akses';
import { adminDb } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// GET /api/kartu-ujian/kop -> gambar kop kartu ujian yang diunggah (parameter ?v= hanya penanda versi agar browser memuat ulang).
export async function GET() {
  const me = await getMe();
  if (!me) return new Response('Unauthorized', { status: 401 });
  if (!bisa(me, 'kartu')) return new Response('Forbidden', { status: 403 });

  const { data } = await adminDb().from('kartu_ujian_pengaturan').select('kop_data').eq('id', 1).maybeSingle();
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/.exec(data?.kop_data ?? '');
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
}
