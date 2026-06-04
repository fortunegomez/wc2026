'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Quietly re-pulls the server-rendered page on an interval so the board stays
// fresh without a manual reload. Picks up newly revalidated data.
export function AutoRefresh({ seconds = 90 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
