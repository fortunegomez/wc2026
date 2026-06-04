// Thin client for the football-data.org v4 API (free tier).
//
// Every request is cached by Next.js for `revalidate` seconds and tagged
// 'wc', so the free-tier rate limit is respected and the cron job (or any
// visitor) can refresh on a schedule. On any error we return null and the
// UI falls back to a friendly state / the last good cached data.

const BASE = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';

// How long a cached response is considered fresh, in seconds.
export const REVALIDATE_MATCHES = 300; // 5 min
export const REVALIDATE_SCORERS = 900; // 15 min

export interface ApiTeamRef {
  id: number | null;
  name: string | null;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  stage: string; // GROUP_STAGE | LAST_16 | QUARTER_FINALS | ...
  group: string | null;
  matchday: number | null;
  homeTeam: ApiTeamRef;
  awayTeam: ApiTeamRef;
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
  };
}

export interface ApiTableRow {
  position: number;
  team: ApiTeamRef;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface ApiStanding {
  stage: string;
  type: string; // TOTAL | HOME | AWAY
  group: string | null;
  table: ApiTableRow[];
}

export interface ApiScorer {
  player: { id: number; name: string; nationality?: string | null };
  team: ApiTeamRef;
  goals: number | null;
  assists?: number | null;
  playedMatches?: number | null;
}

export function hasToken(): boolean {
  return Boolean(process.env.FOOTBALL_DATA_TOKEN);
}

async function fd<T>(path: string, revalidate: number): Promise<T | null> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'X-Auth-Token': token },
      next: { revalidate, tags: ['wc'] },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function getMatches(): Promise<{ matches: ApiMatch[] } | null> {
  return fd(`/competitions/${COMPETITION}/matches`, REVALIDATE_MATCHES);
}

export function getStandings(): Promise<{ standings: ApiStanding[] } | null> {
  return fd(`/competitions/${COMPETITION}/standings`, REVALIDATE_MATCHES);
}

export function getScorers(): Promise<{ scorers: ApiScorer[] } | null> {
  return fd(`/competitions/${COMPETITION}/scorers?limit=20`, REVALIDATE_SCORERS);
}
