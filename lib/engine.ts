// The high-level "brain". Pages call these functions and get back plain data
// ready to render. It replays every finished match from the seed ratings each
// time (deterministic — a match can never be double-counted), so no database
// is required.

import { SEED, type SeedTeam } from './teams';
import { titleOdds, applyElo, kForStage } from './model';
import { resolveTeam } from './names';
import {
  getMatches,
  getStandings,
  getScorers,
  hasToken,
  type ApiMatch,
  type ApiStanding,
  type ApiTeamRef,
} from './footballData';

const UPCOMING_STATUSES = ['SCHEDULED', 'TIMED'];

// ---------- shared helpers ----------

function isFinished(m: ApiMatch): boolean {
  return (
    m.status === 'FINISHED' &&
    m.score.fullTime.home !== null &&
    m.score.fullTime.away !== null
  );
}

function seedRankMap(): Map<string, number> {
  const sorted = [...SEED].sort((a, b) => b.rating - a.rating);
  const m = new Map<string, number>();
  sorted.forEach((t, i) => m.set(t.name, i + 1));
  return m;
}

// Replay all finished matches from the seed ratings.
function replayRatings(matches: ApiMatch[]): Map<string, number> {
  const ratings = new Map<string, number>(SEED.map((t) => [t.name, t.rating]));
  const finished = matches
    .filter(isFinished)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  for (const m of finished) {
    const home = resolveTeam(m.homeTeam.name);
    const away = resolveTeam(m.awayTeam.name);
    if (!home || !away) continue;
    const ra = ratings.get(home.name);
    const rb = ratings.get(away.name);
    if (ra === undefined || rb === undefined) continue;
    const a = { rating: ra };
    const b = { rating: rb };
    applyElo(
      a,
      b,
      m.score.fullTime.home as number,
      m.score.fullTime.away as number,
      kForStage(m.stage),
    );
    ratings.set(home.name, a.rating);
    ratings.set(away.name, b.rating);
  }
  return ratings;
}

function tournamentStarted(matches: ApiMatch[]): boolean {
  return matches.some((m) => !UPCOMING_STATUSES.includes(m.status));
}

function firstKickoff(matches: ApiMatch[]): string | null {
  const dates = matches.map((m) => m.utcDate).filter(Boolean).sort();
  return dates[0] ?? null;
}

function groupKey(g: string | null): string | null {
  if (!g) return null;
  const cleaned = g.replace(/group/i, '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return cleaned || null;
}

// ---------- THE RACE ----------

export interface BoardTeam extends SeedTeam {
  seedRating: number;
  pct: number;
  rank: number;
  seedRank: number;
  delta: number; // seedRank - rank; positive = climbed since seeding
}

export interface BoardResult {
  board: BoardTeam[];
  teamDetails: Record<string, TeamDetail>;
  finishedCount: number;
  started: boolean;
  kickoff: string | null;
  hasToken: boolean;
  hasData: boolean;
}

// A single match from one team's point of view (used in the team popup).
export interface TeamMatch {
  opponent: string;
  opponentCc: string | null;
  home: boolean;
  finished: boolean;
  live: boolean;
  scoreFor: number | null;
  scoreAgainst: number | null;
  result: 'W' | 'D' | 'L' | null;
  time: string;
  dateLabel: string;
  stageLabel: string;
  groupLabel: string | null;
}

export interface TeamDetail {
  group: string | null;
  standing: GroupRow[] | null; // the team's group table
  matches: TeamMatch[];
}

function resultOf(
  scoreFor: number | null,
  scoreAgainst: number | null,
  finished: boolean,
): 'W' | 'D' | 'L' | null {
  if (!finished || scoreFor === null || scoreAgainst === null) return null;
  if (scoreFor > scoreAgainst) return 'W';
  if (scoreFor < scoreAgainst) return 'L';
  return 'D';
}

// Every team's matches (results so far + upcoming), keyed by seed name.
function buildTeamMatches(matches: ApiMatch[]): Record<string, TeamMatch[]> {
  const out: Record<string, TeamMatch[]> = {};
  const add = (name: string, tm: TeamMatch) => {
    (out[name] ??= []).push(tm);
  };
  const sorted = [...matches].sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  for (const m of sorted) {
    const d = new Date(m.utcDate);
    if (Number.isNaN(d.getTime())) continue;
    const home = resolveTeam(m.homeTeam.name);
    const away = resolveTeam(m.awayTeam.name);
    const fin = isFinished(m);
    const live = ['IN_PLAY', 'PAUSED'].includes(m.status);
    const hg = m.score.fullTime.home;
    const ag = m.score.fullTime.away;
    const stageLabel = STAGE_LABELS[m.stage] ?? m.stage;
    const groupLabel = m.stage === 'GROUP_STAGE' ? groupKey(m.group) : null;
    const time = timeFmt.format(d);
    const dateLabel = shortDayFmt.format(d);
    if (home) {
      add(home.name, {
        opponent: away?.name ?? m.awayTeam.name ?? 'TBD',
        opponentCc: away?.cc ?? null,
        home: true,
        finished: fin,
        live,
        scoreFor: hg,
        scoreAgainst: ag,
        result: resultOf(hg, ag, fin),
        time,
        dateLabel,
        stageLabel,
        groupLabel,
      });
    }
    if (away) {
      add(away.name, {
        opponent: home?.name ?? m.homeTeam.name ?? 'TBD',
        opponentCc: home?.cc ?? null,
        home: false,
        finished: fin,
        live,
        scoreFor: ag,
        scoreAgainst: hg,
        result: resultOf(ag, hg, fin),
        time,
        dateLabel,
        stageLabel,
        groupLabel,
      });
    }
  }
  return out;
}

export async function getBoard(): Promise<BoardResult> {
  const [matchData, standingData] = await Promise.all([
    getMatches(),
    getStandings(),
  ]);
  const matches = matchData?.matches ?? [];
  const standings = standingData?.standings ?? [];
  const ratings = replayRatings(matches);
  const seedRanks = seedRankMap();

  const rated = SEED.map((t) => ({
    ...t,
    seedRating: t.rating,
    rating: ratings.get(t.name) ?? t.rating,
  }));

  const ranked = titleOdds(rated).sort((a, b) => b.pct - a.pct);
  const board: BoardTeam[] = ranked.map((t, i) => {
    const rank = i + 1;
    const seedRank = seedRanks.get(t.name) ?? rank;
    return { ...t, rank, seedRank, delta: seedRank - rank };
  });

  const { standingsByGroup, teamGroup } = buildGroupViews(
    matches,
    standings,
    ratings,
  );
  const teamMatches = buildTeamMatches(matches);
  const teamDetails: Record<string, TeamDetail> = {};
  for (const t of board) {
    const group = teamGroup[t.name] ?? null;
    teamDetails[t.name] = {
      group,
      standing: group ? standingsByGroup[group] ?? null : null,
      matches: teamMatches[t.name] ?? [],
    };
  }

  return {
    board,
    teamDetails,
    finishedCount: matches.filter(isFinished).length,
    started: tournamentStarted(matches),
    kickoff: firstKickoff(matches),
    hasToken: hasToken(),
    hasData: matchData !== null,
  };
}

// ---------- GROUPS ----------

export interface GroupRow {
  name: string;
  cc: string | null;
  played: number;
  won: number;
  draw: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface GroupView {
  key: string;
  label: string;
  predictedWinner: { name: string; cc: string } | null;
  table: GroupRow[];
  hasResults: boolean;
}

export interface GroupsResult {
  groups: GroupView[];
  started: boolean;
  kickoff: string | null;
  hasToken: boolean;
  hasData: boolean;
}

// Builds the 12 group views from matches + standings. Also returns lookups the
// popups reuse: each group's table keyed by group letter, and which group each
// team is in. Shared by the Groups page, the fixtures game popup, and the team
// popup so the standings logic lives in exactly one place.
interface GroupBuild {
  groups: GroupView[];
  standingsByGroup: Record<string, GroupRow[]>;
  teamGroup: Record<string, string>; // team name -> group letter
}

function buildGroupViews(
  matches: ApiMatch[],
  standings: ApiStanding[],
  ratings: Map<string, number>,
): GroupBuild {
  const groupTeams = new Map<string, Map<string, ApiTeamRef>>();
  const teamGroup: Record<string, string> = {};
  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE') continue;
    const key = groupKey(m.group);
    if (!key) continue;
    if (!groupTeams.has(key)) groupTeams.set(key, new Map());
    const bucket = groupTeams.get(key)!;
    for (const ref of [m.homeTeam, m.awayTeam]) {
      if (ref?.name) {
        bucket.set(ref.name, ref);
        const seed = resolveTeam(ref.name);
        if (seed) teamGroup[seed.name] = key;
      }
    }
  }

  const standByKey = new Map<string, ApiStanding>();
  for (const s of standings) {
    if (s.type && s.type !== 'TOTAL') continue;
    const key = groupKey(s.group);
    if (key) standByKey.set(key, s);
  }

  const standingsByGroup: Record<string, GroupRow[]> = {};
  const keys = [...groupTeams.keys()].sort();
  const groups: GroupView[] = keys.map((key) => {
    const refs = [...groupTeams.get(key)!.values()];
    const rated = refs
      .map((ref) => {
        const seed = resolveTeam(ref.name);
        if (!seed) return null;
        return {
          name: seed.name,
          cc: seed.cc,
          rating: ratings.get(seed.name) ?? seed.rating,
        };
      })
      .filter((x): x is { name: string; cc: string; rating: number } => x !== null);

    const odds = titleOdds(rated).sort((a, b) => b.pct - a.pct);
    const predictedWinner = odds[0]
      ? { name: odds[0].name, cc: odds[0].cc }
      : null;

    const standing = standByKey.get(key);
    const hasResults = Boolean(
      standing && standing.table.some((r) => r.playedGames > 0),
    );

    let table: GroupRow[];
    if (standing && standing.table.length) {
      table = standing.table.map((r) => {
        const seed = resolveTeam(r.team.name);
        return {
          name: seed?.name ?? r.team.name ?? '—',
          cc: seed?.cc ?? null,
          played: r.playedGames,
          won: r.won,
          draw: r.draw,
          lost: r.lost,
          gf: r.goalsFor,
          ga: r.goalsAgainst,
          gd: r.goalDifference,
          points: r.points,
        };
      });
    } else {
      table = rated
        .slice()
        .sort((a, b) => b.rating - a.rating)
        .map((t) => ({
          name: t.name,
          cc: t.cc,
          played: 0,
          won: 0,
          draw: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          points: 0,
        }));
    }

    standingsByGroup[key] = table;
    return { key, label: `Group ${key}`, predictedWinner, table, hasResults };
  });

  return { groups, standingsByGroup, teamGroup };
}

export async function getGroups(): Promise<GroupsResult> {
  const [matchData, standingData] = await Promise.all([
    getMatches(),
    getStandings(),
  ]);
  const matches = matchData?.matches ?? [];
  const standings = standingData?.standings ?? [];
  const ratings = replayRatings(matches);
  const { groups } = buildGroupViews(matches, standings, ratings);

  return {
    groups,
    started: tournamentStarted(matches),
    kickoff: firstKickoff(matches),
    hasToken: hasToken(),
    hasData: matchData !== null,
  };
}

// ---------- FIXTURES & RESULTS ----------

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-finals',
  SEMI_FINALS: 'Semi-finals',
  THIRD_PLACE: 'Third-place play-off',
  FINAL: 'Final',
};

export interface FixtureTeam {
  name: string;
  cc: string | null;
  crest: string | null;
}

export interface FixtureMatch {
  id: number;
  time: string; // HH:mm in Nigerian time (WAT)
  dateLabel: string; // Thu 11 Jun (used in popups)
  status: string;
  finished: boolean;
  live: boolean;
  stageLabel: string;
  groupLabel: string | null;
  home: FixtureTeam;
  away: FixtureTeam;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface FixtureDay {
  date: string; // YYYY-MM-DD
  label: string; // Thursday 11 June
  matches: FixtureMatch[];
}

// Fixtures & Results are shown in three blocks: most-recently-finished first,
// then today, then upcoming by date.
export interface FixtureSection {
  key: 'finished' | 'today' | 'upcoming';
  label: string;
  days: FixtureDay[];
}

export interface FixturesResult {
  sections: FixtureSection[];
  standingsByGroup: Record<string, GroupRow[]>; // for the game popup
  started: boolean;
  kickoff: string | null;
  hasToken: boolean;
  hasData: boolean;
}

function teamCell(ref: ApiTeamRef): FixtureTeam {
  const seed = resolveTeam(ref?.name);
  return {
    name: seed?.name ?? ref?.name ?? 'TBD',
    cc: seed?.cc ?? null,
    crest: ref?.crest ?? null,
  };
}

// All match dates and times are shown in Nigerian time (WAT = UTC+1, no daylight
// saving), so the formatters use a fixed timezone — deterministic on both the
// server and the client, so there's no hydration mismatch.
const TZ = 'Africa/Lagos';
const dayFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
});
const shortDayFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: TZ,
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
});
// YYYY-MM-DD in Nigerian time, used for day-grouping and the today split.
const dateKeyFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TZ,
});

function lagosDateKey(d: Date): string {
  return dateKeyFmt.format(d);
}
function todayKey(): string {
  return dateKeyFmt.format(new Date());
}

// Groups a list of fixtures into days. `desc` reverses both the day order and
// the kick-off order within each day (used for the most-recently-finished
// block, so the newest match sits at the very top).
function toDays(
  entries: { dateKey: string; sortKey: string; match: FixtureMatch }[],
  desc: boolean,
): FixtureDay[] {
  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!byDay.has(e.dateKey)) byDay.set(e.dateKey, []);
    byDay.get(e.dateKey)!.push(e);
  }
  const dayKeys = [...byDay.keys()].sort((a, b) =>
    desc ? b.localeCompare(a) : a.localeCompare(b),
  );
  return dayKeys.map((date) => {
    const matches = byDay
      .get(date)!
      .slice()
      .sort((a, b) =>
        desc
          ? b.sortKey.localeCompare(a.sortKey)
          : a.sortKey.localeCompare(b.sortKey),
      )
      .map((e) => e.match);
    return {
      date,
      label: dayFmt.format(new Date(`${date}T12:00:00Z`)),
      matches,
    };
  });
}

export async function getFixtures(): Promise<FixturesResult> {
  const [matchData, standingData] = await Promise.all([
    getMatches(),
    getStandings(),
  ]);
  const matches = (matchData?.matches ?? [])
    .slice()
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));
  const standings = standingData?.standings ?? [];
  const ratings = replayRatings(matches);
  const { standingsByGroup } = buildGroupViews(matches, standings, ratings);

  const today = todayKey();
  type Entry = { dateKey: string; sortKey: string; match: FixtureMatch };
  const finished: Entry[] = [];
  const todayMatches: Entry[] = [];
  const upcoming: Entry[] = [];

  for (const m of matches) {
    const d = new Date(m.utcDate);
    if (Number.isNaN(d.getTime())) continue;
    const dateKey = lagosDateKey(d);
    const fin = isFinished(m);
    const fixture: FixtureMatch = {
      id: m.id,
      time: timeFmt.format(d),
      dateLabel: shortDayFmt.format(d),
      status: m.status,
      finished: fin,
      live: ['IN_PLAY', 'PAUSED'].includes(m.status),
      stageLabel: STAGE_LABELS[m.stage] ?? m.stage,
      groupLabel: m.stage === 'GROUP_STAGE' ? groupKey(m.group) : null,
      home: teamCell(m.homeTeam),
      away: teamCell(m.awayTeam),
      homeGoals: m.score.fullTime.home,
      awayGoals: m.score.fullTime.away,
    };
    const entry: Entry = { dateKey, sortKey: m.utcDate, match: fixture };
    if (fin) finished.push(entry);
    else if (dateKey <= today) todayMatches.push(entry);
    else upcoming.push(entry);
  }

  // Vertical order is chronological (oldest results at the very top → newest
  // results → today → upcoming). The fixtures list auto-scrolls on load so the
  // newest results sit at the top of the screen with the next fixtures just
  // below; scrolling up reveals earlier games.
  const sections: FixtureSection[] = [];
  if (finished.length)
    sections.push({
      key: 'finished',
      label: 'Results',
      days: toDays(finished, false),
    });
  if (todayMatches.length)
    sections.push({
      key: 'today',
      label: 'Today',
      days: toDays(todayMatches, false),
    });
  if (upcoming.length)
    sections.push({
      key: 'upcoming',
      label: 'Up next',
      days: toDays(upcoming, false),
    });

  return {
    sections,
    standingsByGroup,
    started: tournamentStarted(matches),
    kickoff: firstKickoff(matches),
    hasToken: hasToken(),
    hasData: matchData !== null,
  };
}

// ---------- TOP SCORERS ----------

export interface ScorerRow {
  rank: number;
  player: string;
  team: string;
  cc: string | null;
  crest: string | null;
  goals: number;
}

export interface ScorersResult {
  scorers: ScorerRow[];
  started: boolean;
  kickoff: string | null;
  hasToken: boolean;
  hasData: boolean;
}

export async function getScorersView(): Promise<ScorersResult> {
  const [scorerData, matchData] = await Promise.all([getScorers(), getMatches()]);
  const list = scorerData?.scorers ?? [];
  const scorers: ScorerRow[] = list.map((s, i) => {
    const seed = resolveTeam(s.team?.name);
    return {
      rank: i + 1,
      player: s.player?.name ?? '—',
      team: seed?.name ?? s.team?.name ?? '—',
      cc: seed?.cc ?? null,
      crest: s.team?.crest ?? null,
      goals: s.goals ?? 0,
    };
  });
  const matches = matchData?.matches ?? [];
  return {
    scorers,
    started: tournamentStarted(matches),
    kickoff: firstKickoff(matches),
    hasToken: hasToken(),
    hasData: scorerData !== null,
  };
}

// ---------- shared formatting for friendly empty states ----------

const friendlyFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
});

export function kickoffLabel(kickoff: string | null): string {
  if (!kickoff) return 'June 11, 2026';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return 'June 11, 2026';
  return friendlyFmt.format(d);
}
