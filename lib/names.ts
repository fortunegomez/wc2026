// Maps football-data.org team names onto our 48-team seed list.
//
// Three layers, tried in order:
//   1. exact match against our names
//   2. explicit overrides for known API spellings
//   3. a normalised match (accent/case/punctuation-insensitive) as a safety net

import { SEED, type SeedTeam } from './teams';

// API spelling -> our name. Covers every case where football-data.org uses a
// different label than our seed list.
const API_NAME_MAP: Record<string, string> = {
  'United States': 'USA',
  'Korea Republic': 'South Korea',
  Turkey: 'Türkiye',
  'Czech Republic': 'Czechia',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cote d\'Ivoire': 'Ivory Coast',
  'Congo DR': 'DR Congo',
  'DR Congo': 'DR Congo',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
  'Cabo Verde': 'Cape Verde',
  'IR Iran': 'Iran',
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
}

const byExact = new Map<string, SeedTeam>(SEED.map((t) => [t.name, t]));

const byNormalized = new Map<string, SeedTeam>();
for (const t of SEED) byNormalized.set(normalize(t.name), t);
for (const [api, ours] of Object.entries(API_NAME_MAP)) {
  const team = byExact.get(ours);
  if (team) byNormalized.set(normalize(api), team);
}

// Returns our seed team for an API team name, or null if we can't match it
// (in which case callers skip the match rather than crashing).
export function resolveTeam(apiName: string | null | undefined): SeedTeam | null {
  if (!apiName) return null;
  const direct = byExact.get(apiName);
  if (direct) return direct;
  const mapped = API_NAME_MAP[apiName];
  if (mapped) {
    const t = byExact.get(mapped);
    if (t) return t;
  }
  return byNormalized.get(normalize(apiName)) ?? null;
}
