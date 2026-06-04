import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Called by Vercel Cron. Clears the cached football-data.org responses so the
// next page render pulls fresh data. Protected by CRON_SECRET: Vercel Cron
// automatically sends "Authorization: Bearer <CRON_SECRET>" when that env var
// is set.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401 },
      );
    }
  }

  revalidateTag('wc');
  return NextResponse.json({ ok: true, revalidated: true, at: Date.now() });
}
