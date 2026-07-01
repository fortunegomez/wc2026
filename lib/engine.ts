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
  type ApiTableRow,
  type ApiTeamRef,
} from './footballData';
import {
  SKELETON_ROUNDS,
  THIRD_PLACE,
  type Slot,
  type SkeletonMatch,
  type Round,
} from './bracketSkeleton';

const UPCOMING_STATUSES = ['SCHEDULED', 'TIMED'];

// ---------- shared helpers ----------

function isFinished(m: ApiMatch): boolean {
  return (
    m.status === 'FINISHED' &&
    m.score.fullTime.home !== null &&
    m.score.fullTime.away !== null
  );
}

interface MatchScore {
  home: number | null; // main line: end of normal + extra time
  away: number | null;
  shootout: boolean;
  pen: { home: number; away: number } | null;
}

// Resolves the score we actually use. For a penalty shootout the "main line" is
// the score at the end of normal + extra time (a draw) — NOT football-data's
// full-time figure, which folds the shootout in (e.g. a 1-1 that went 3-4 on
// pens is reported as fullTime 4-5). The shootout is returned separately so the
// UI can show it as (PEN x:y) and the Elo update can treat the tie as level.
function matchScore(m: ApiMatch): MatchScore {
  const s = m.score;
  const hasPens =
    !!s.penalties && s.penalties.home != null && s.penalties.away != null;
  const shootout = s.duration === 'PENALTY_SHOOTOUT' || hasPens;
  if (!shootout) {
    return {
      home: s.fullTime.home,
      away: s.fullTime.away,
      shootout: false,
      pen: null,
    };
  }
  const pen = hasPens
    ? { home: s.penalties!.home as number, away: s.penalties!.away as number }
    : null;
  let home: number | null;
  let away: number | null;
  if (
    s.regularTime &&
    s.regularTime.home != null &&
    s.regularTime.away != null
  ) {
    home = s.regularTime.home + (s.extraTime?.home ?? 0);
    away = s.regularTime.away + (s.extraTime?.away ?? 0);
  } else if (pen && s.fullTime.home != null && s.fullTime.away != null) {
    // No regular-time breakdown: back out the shootout from full-time.
    home = s.fullTime.home - pen.home;
    away = s.fullTime.away - pen.away;
  } else {
    home = s.fullTime.home;
    away = s.fullTime.away;
  }
  return { home, away, shootout: true, pen };
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
    // Use the main line, so a shootout counts as the level match it was; the
    // winner still advances via the knockout logic, not via Elo.
    const sc = matchScore(m);
    if (sc.home === null || sc.away === null) continue;
    const a = { rating: ra };
    const b = { rating: rb };
    applyElo(a, b, sc.home, sc.away, kForStage(m.stage));
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
  eliminated: boolean;
  eliminatedAt: string | null; // utcDate of the knockout match it lost
}

export interface BoardResult {
  board: BoardTeam[];
  teamDetails: Record<string, TeamDetail>;
  finishedCount: number;
  started: boolean;
  kickoff: string | null;
  hasToken: boolean;
  hasData: boolean;
  knockoutActive: boolean; // are we in the knockout rounds?
  aliveCount: number; // how many teams are still in
}

// A single match from one team's point of view (used in the team popup).
export interface TeamMatch {
  opponent: string;
  opponentCc: string | null;
  home: boolean;
  finished: boolean;
  live: boolean;
  scoreFor: number | null; // main line (end of normal + extra time)
  scoreAgainst: number | null;
  shootout: boolean;
  penFor: number | null;
  penAgainst: number | null;
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
    const sc = matchScore(m);
    const hg = sc.home;
    const ag = sc.away;
    const penH = sc.pen?.home ?? null;
    const penA = sc.pen?.away ?? null;
    const stageLabel = STAGE_LABELS[m.stage] ?? m.stage;
    const groupLabel = m.stage === 'GROUP_STAGE' ? groupKey(m.group) : null;
    const time = timeFmt.format(d);
    const dateLabel = shortDayFmt.format(d);
    // A shootout's main line is a draw, so W/L comes from the shootout itself.
    const koResult = (
      forPen: number | null,
      againstPen: number | null,
      forGoals: number | null,
      againstGoals: number | null,
    ): 'W' | 'D' | 'L' | null => {
      if (sc.shootout && forPen != null && againstPen != null) {
        return forPen > againstPen ? 'W' : 'L';
      }
      return resultOf(forGoals, againstGoals, fin);
    };
    if (home) {
      add(home.name, {
        opponent: away?.name ?? m.awayTeam.name ?? 'TBD',
        opponentCc: away?.cc ?? null,
        home: true,
        finished: fin,
        live,
        scoreFor: hg,
        scoreAgainst: ag,
        shootout: sc.shootout,
        penFor: penH,
        penAgainst: penA,
        result: koResult(penH, penA, hg, ag),
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
        shootout: sc.shootout,
        penFor: penA,
        penAgainst: penH,
        result: koResult(penA, penH, ag, hg),
        time,
        dateLabel,
        stageLabel,
        groupLabel,
      });
    }
  }
  return out;
}

// ---------- knockout elimination ----------

const KNOCKOUT_STAGES = new Set([
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
]);

function isKnockout(m: ApiMatch): boolean {
  return KNOCKOUT_STAGES.has(m.stage);
}

// The losing side of a finished knockout match. Uses score.winner (which
// reflects penalty-shootout results), falling back to the full-time score.
// Returns null when the result can't decide a loser yet.
function knockoutLoser(
  m: ApiMatch,
  home: SeedTeam | null,
  away: SeedTeam | null,
): SeedTeam | null {
  const w = m.score.winner;
  if (w === 'HOME_TEAM') return away;
  if (w === 'AWAY_TEAM') return home;
  const h = m.score.fullTime.home;
  const a = m.score.fullTime.away;
  if (h != null && a != null && h !== a) return h > a ? away : home;
  return null;
}

interface KnockoutStatus {
  inBracket: Set<string>; // teams that reached the knockout rounds
  eliminated: Set<string>; // teams that lost a knockout match
  eliminatedAt: Map<string, string>; // utcDate of the match each lost
  active: boolean; // have the knockouts started at all?
}

// Works out who is still in purely from the knockout fixtures: a team is out
// the moment it loses a knockout match; everyone in the bracket who hasn't lost
// is still in. (No group-stage logic — once the bracket exists, any team that
// isn't in it didn't qualify and is treated as out by the caller.)
function knockoutStatus(matches: ApiMatch[]): KnockoutStatus {
  const inBracket = new Set<string>();
  const eliminated = new Set<string>();
  const eliminatedAt = new Map<string, string>();
  for (const m of matches) {
    if (!isKnockout(m)) continue;
    const home = resolveTeam(m.homeTeam.name);
    const away = resolveTeam(m.awayTeam.name);
    if (home) inBracket.add(home.name);
    if (away) inBracket.add(away.name);
    if (!isFinished(m)) continue;
    const loser = knockoutLoser(m, home, away);
    if (loser) {
      eliminated.add(loser.name);
      eliminatedAt.set(loser.name, m.utcDate);
    }
  }
  return { inBracket, eliminated, eliminatedAt, active: inBracket.size > 0 };
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
  const ko = knockoutStatus(matches);

  // A team is out if it lost a knockout match, or — once the bracket exists —
  // it never made the bracket (didn't qualify from its group).
  const isEliminated = (name: string): boolean =>
    ko.eliminated.has(name) || (ko.active && !ko.inBracket.has(name));

  const rated = SEED.map((t) => ({
    ...t,
    seedRating: t.rating,
    rating: ratings.get(t.name) ?? t.rating,
  }));

  // Title odds are recomputed over the survivors only, so their percentages
  // always sum to 100%. Eliminated teams get 0%.
  const aliveRanked = titleOdds(rated.filter((t) => !isEliminated(t.name))).sort(
    (a, b) => b.pct - a.pct,
  );

  // Eliminated below the line: most recently knocked out first, then the
  // group-stage non-qualifiers (no knockout date) by rating.
  const elimRanked = rated
    .filter((t) => isEliminated(t.name))
    .map((t) => ({ ...t, pct: 0 }))
    .sort((a, b) => {
      const ea = ko.eliminatedAt.get(a.name);
      const eb = ko.eliminatedAt.get(b.name);
      if (ea && eb) return eb.localeCompare(ea);
      if (ea) return -1;
      if (eb) return 1;
      return b.rating - a.rating;
    });

  const ordered = [...aliveRanked, ...elimRanked];
  const board: BoardTeam[] = ordered.map((t, i) => {
    const rank = i + 1;
    const seedRank = seedRanks.get(t.name) ?? rank;
    return {
      ...t,
      rank,
      seedRank,
      delta: seedRank - rank,
      eliminated: isEliminated(t.name),
      eliminatedAt: ko.eliminatedAt.get(t.name) ?? null,
    };
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
    knockoutActive: ko.active,
    aliveCount: aliveRanked.length,
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
  homeGoals: number | null; // main line (end of normal + extra time)
  awayGoals: number | null;
  shootout: boolean;
  pen: { home: number; away: number } | null;
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
    const sc = matchScore(m);
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
      homeGoals: sc.home,
      awayGoals: sc.away,
      shootout: sc.shootout,
      pen: sc.pen,
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

// ---------- TOURNAMENT BRACKET ----------
//
// The bracket structure (match numbers + feeder linkage) is the fixed FIFA
// skeleton in bracketSkeleton.ts. Here we resolve the actual TEAMS from the live
// standings/fixtures and propagate winners through the skeleton, so undecided
// slots show the real "Winner of M##" label and the connectors are drawn from
// the fixed adjacency.

// A team slot: a resolved team, or a placeholder ("Winner M73") until decided.
export interface BracketSlot {
  name: string | null;
  cc: string | null;
  crest: string | null;
  placeholder: string;
}

export interface BracketMatch {
  no: number; // FIFA match number (73–104)
  round: Round;
  home: BracketSlot;
  away: BracketSlot;
  homeFeeder: number | null; // feeding match number (for connectors)
  awayFeeder: number | null;
  homeScore: number | null; // main line (end of normal + extra time)
  awayScore: number | null;
  shootout: boolean;
  pen: { home: number; away: number } | null;
  winner: 'home' | 'away' | null;
  played: boolean;
  dateLabel: string;
  time: string;
}

export interface BracketRound {
  round: Round;
  label: string;
  short: string;
  matches: BracketMatch[];
}

export interface BracketResult {
  rounds: BracketRound[]; // R32 → Final, left-to-right
  thirdPlace: BracketMatch | null;
  hasKnockouts: boolean;
  hasToken: boolean;
  kickoff: string | null;
}

interface TeamRef {
  name: string;
  cc: string | null;
  crest: string | null;
}

const KO_STAGE: Record<Round, string> = {
  R32: 'LAST_32',
  R16: 'LAST_16',
  QF: 'QUARTER_FINALS',
  SF: 'SEMI_FINALS',
  F: 'FINAL',
  '3P': 'THIRD_PLACE',
};

export async function getBracket(): Promise<BracketResult> {
  const [matchData, standingData] = await Promise.all([
    getMatches(),
    getStandings(),
  ]);
  const matches = matchData?.matches ?? [];
  const standings = standingData?.standings ?? [];

  // 1) Group position (Winner/Runner-up of each group) → team.
  const posTeam = new Map<string, TeamRef>();
  for (const s of standings) {
    if (s.type && s.type !== 'TOTAL') continue;
    const g = groupKey(s.group);
    if (!g) continue;
    const put = (pos: 'W' | 'R', row?: ApiTableRow) => {
      if (!row?.team?.name) return;
      const seed = resolveTeam(row.team.name);
      posTeam.set(`${pos}:${g}`, {
        name: seed?.name ?? row.team.name,
        cc: seed?.cc ?? null,
        crest: row.team.crest ?? null,
      });
    };
    put('W', s.table.find((r) => r.position === 1) ?? s.table[0]);
    put('R', s.table.find((r) => r.position === 2) ?? s.table[1]);
  }

  // 2) Knockout fixtures grouped by stage, and a team resolver.
  const koByStage = new Map<string, ApiMatch[]>();
  for (const mm of matches) {
    if (mm.stage === 'GROUP_STAGE') continue;
    const arr = koByStage.get(mm.stage);
    if (arr) arr.push(mm);
    else koByStage.set(mm.stage, [mm]);
  }
  const teamOf = (ref: ApiTeamRef | null | undefined): TeamRef | null => {
    if (!ref?.name) return null;
    const seed = resolveTeam(ref.name);
    return { name: seed?.name ?? ref.name, cc: seed?.cc ?? null, crest: ref.crest ?? null };
  };
  const findFixture = (
    round: Round,
    aName: string,
    bName: string | null,
  ): ApiMatch | null => {
    for (const f of koByStage.get(KO_STAGE[round]) ?? []) {
      const names = [teamOf(f.homeTeam)?.name, teamOf(f.awayTeam)?.name].filter(
        Boolean,
      ) as string[];
      if (!names.includes(aName)) continue;
      if (bName && !names.includes(bName)) continue;
      return f;
    }
    return null;
  };

  // 3) Resolve a slot to a team (or placeholder), tracking the feeder match.
  const results = new Map<number, { winner: TeamRef | null; loser: TeamRef | null }>();
  const resolveSlot = (
    slot: Slot,
  ): { team: TeamRef | null; placeholder: string; feeder: number | null } => {
    switch (slot.kind) {
      case 'winnerGroup':
        return {
          team: posTeam.get(`W:${slot.group}`) ?? null,
          placeholder: `Winner Group ${slot.group}`,
          feeder: null,
        };
      case 'runnerUpGroup':
        return {
          team: posTeam.get(`R:${slot.group}`) ?? null,
          placeholder: `Runner-up Group ${slot.group}`,
          feeder: null,
        };
      case 'thirdPlace':
        return { team: null, placeholder: '3rd place', feeder: null };
      case 'winnerOf':
        return {
          team: results.get(slot.match)?.winner ?? null,
          placeholder: `Winner M${slot.match}`,
          feeder: slot.match,
        };
      case 'loserOf':
        return {
          team: results.get(slot.match)?.loser ?? null,
          placeholder: `Loser M${slot.match}`,
          feeder: slot.match,
        };
    }
  };

  const build = (sk: SkeletonMatch): BracketMatch => {
    const hs = resolveSlot(sk.home);
    const as = resolveSlot(sk.away);
    // Anchor = the home slot's team when known (R32 home is always definite);
    // otherwise the away slot. Locate the live fixture by that team.
    const anchor = hs.team?.name ?? as.team?.name ?? null;
    const second = hs.team && as.team ? as.team.name : null;
    const fixture = anchor ? findFixture(sk.round, anchor, second) : null;

    let home = hs.team;
    let away = as.team;
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let pen: { home: number; away: number } | null = null;
    let shootout = false;
    let winner: 'home' | 'away' | null = null;
    let played = false;
    let dateLabel = '';
    let time = '';

    if (fixture) {
      const fh = teamOf(fixture.homeTeam);
      const fa = teamOf(fixture.awayTeam);
      // Bracket-home corresponds to whichever fixture side holds the home slot's
      // team (or, when only the away slot is known, the away team's opponent).
      const homeIsFixtureHome = hs.team
        ? fh?.name === hs.team.name
        : fa?.name !== as.team?.name;
      home = home ?? (homeIsFixtureHome ? fh : fa);
      away = away ?? (homeIsFixtureHome ? fa : fh);

      const sc = matchScore(fixture);
      shootout = sc.shootout;
      played = isFinished(fixture);
      if (played) {
        homeScore = homeIsFixtureHome ? sc.home : sc.away;
        awayScore = homeIsFixtureHome ? sc.away : sc.home;
        if (sc.pen) {
          pen = homeIsFixtureHome
            ? sc.pen
            : { home: sc.pen.away, away: sc.pen.home };
        }
        const fw =
          fixture.score.winner === 'HOME_TEAM'
            ? 'fh'
            : fixture.score.winner === 'AWAY_TEAM'
              ? 'fa'
              : null;
        if (fw) winner = (fw === 'fh') === homeIsFixtureHome ? 'home' : 'away';
      }
      const d = new Date(fixture.utcDate);
      if (!Number.isNaN(d.getTime())) {
        dateLabel = shortDayFmt.format(d);
        time = timeFmt.format(d);
      }
    }

    if (winner && home && away) {
      results.set(
        sk.no,
        winner === 'home'
          ? { winner: home, loser: away }
          : { winner: away, loser: home },
      );
    }

    const toSlot = (team: TeamRef | null, ph: string): BracketSlot =>
      team
        ? { name: team.name, cc: team.cc, crest: team.crest, placeholder: '' }
        : { name: null, cc: null, crest: null, placeholder: ph };

    return {
      no: sk.no,
      round: sk.round,
      home: toSlot(home, hs.placeholder),
      away: toSlot(away, as.placeholder),
      homeFeeder: hs.feeder,
      awayFeeder: as.feeder,
      homeScore,
      awayScore,
      shootout,
      pen,
      winner,
      played,
      dateLabel,
      time,
    };
  };

  // Build in skeleton order (R32 → Final); feeders always resolve first.
  const rounds: BracketRound[] = SKELETON_ROUNDS.map((r) => ({
    round: r.round,
    label: r.label,
    short: r.short,
    matches: r.matches.map(build),
  }));
  const thirdPlace = build(THIRD_PLACE);

  return {
    rounds,
    thirdPlace,
    hasKnockouts: koByStage.size > 0,
    hasToken: hasToken(),
    kickoff: firstKickoff(matches),
  };
}
