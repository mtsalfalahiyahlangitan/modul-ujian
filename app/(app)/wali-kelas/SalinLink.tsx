'use client';
import { Copy } from 'lucide-react';
import { showToast } from '@/components/Toaster';

// Kolom link yang bisa disalin untuk dibagikan ke wali kelas.
export default function SalinLink({ url }: { url: string }) {
  async function salin() {
    try { await navigator.clipboard.writeText(url); showToast('Link disalin'); }
    catch { showToast('Tidak bisa menyalin otomatis, salin link secara manual', true); }
  }
  return (
    <div className="salin-link">
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Link halaman wali kelas" />
      <button type="button" className="btn" onClick={salin}><Copy size={15} />Salin</button>
    </div>
  );
}
