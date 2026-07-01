// Read-only, public-domain goal-scorer data from OpenFootball's worldcup.json
// (no API key). Fetched on the server and cached with the same 'wc' tag as the
// football-data calls, so the cron refresh clears it and the public page only
// ever reads the cache — it never calls this URL itself.
//
// This source is hand-updated and lags the live scores, so scorers appear after
// a delay. Callers must treat missing scorers as normal and never block on them.

const URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const REVALIDATE = 900; // 15 min

export interface OFGoal {
  name?: string;
  minute?: number | string; // OpenFootball stores the minute as a string ("67")
  penalty?: boolean;
  owngoal?: boolean;
}

export interface OFMatch {
  round?: string;
  date?: string; // YYYY-MM-DD (local match date)
  team1?: string;
  team2?: string;
  score?: { ft?: number[] };
  goals1?: OFGoal[]; // goals credited to team1
  goals2?: OFGoal[]; // goals credited to team2
}

export async function getOpenFootballMatches(): Promise<OFMatch[] | null> {
  try {
    const res = await fetch(URL, { next: { revalidate: REVALIDATE, tags: ['wc'] } });
    if (!res.ok) return null;
    const data = (await res.json()) as { matches?: OFMatch[] };
    return data.matches ?? [];
  } catch {
    return null;
  }
}
