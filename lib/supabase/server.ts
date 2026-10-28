import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Client berbasis cookie untuk membaca sesi login pengguna.
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // dipanggil dari Server Component: abaikan (middleware yang me-refresh sesi)
          }
        },
      },
    }
  );
}
