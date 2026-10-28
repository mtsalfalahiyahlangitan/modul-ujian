import { adminDb } from './supabase/admin';

export async function audit(userId: string, aksi: string, detail: any = {}) {
  try {
    await adminDb().from('audit_log').insert({ user_id: userId, aksi, detail });
  } catch {
    /* audit tidak boleh menggagalkan aksi utama */
  }
}
