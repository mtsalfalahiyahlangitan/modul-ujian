import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Client service_role: HANYA dipakai di server (server component, server action, route handler).
// Melewati RLS, jadi otorisasi WAJIB dicek manual lewat lib/auth.ts sebelum dipakai.
// Dibuat sekali lalu dipakai ulang (tanpa state sesi, aman dipakai bersama antar request).
let client: SupabaseClient | undefined;
export function adminDb(): SupabaseClient {
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  ));
}
