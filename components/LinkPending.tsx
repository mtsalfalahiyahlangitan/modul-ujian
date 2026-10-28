'use client';
import { useLinkStatus } from 'next/link';
import { LoaderCircle } from 'lucide-react';

// Taruh di dalam <Link>: muncul seketika saat link diklik dan halaman tujuan masih dimuat.
export default function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <LoaderCircle size={15} className="spin link-pending" aria-hidden /> : null;
}
