// The fixed FIFA knockout bracket for the 2026 World Cup (matches M73–M104).
//
// This never redraws: FIFA numbers every knockout match by bracket position, so
// the feeder linkage is static. Only the TEAMS change, and those are resolved
// at runtime from the live standings/fixtures (see getBracket in engine.ts):
//   - Round of 32 slots reference group positions (e.g. Winner Group E). Every
//     R32 match has at least one definite (winner/runner-up) side — always the
//     HOME slot — used as the anchor to find its live fixture; the third-placed
//     side comes from that fixture.
//   - Round of 16 → Final slots reference an earlier match ("Winner of M73").
//
// Source: the "2026 FIFA World Cup knockout stage" Wikipedia bracket (parsed
// from raw wikitext). The R16→Final feeder linkage was cross-checked against the
// live football-data.org feed's own resolved pairings (M89 Paraguay v France =
// W74/W77, M90 Canada v Morocco = W73/W75, M91 Brazil v Norway = W76/W78).
//
// Matches are listed in vertical display order (top→bottom) so each child sits
// between its two feeders (feeders of round-r match i are round-(r-1) matches 2i
// and 2i+1), giving a clean non-crossing bracket.

export type Round = 'R32' | 'R16' | 'QF' | 'SF' | 'F' | '3P';

export type Slot =
  | { kind: 'winnerGroup'; group: string }
  | { kind: 'runnerUpGroup'; group: string }
  | { kind: 'thirdPlace'; groups: string[] }
  | { kind: 'winnerOf'; match: number }
  | { kind: 'loserOf'; match: number };

export interface SkeletonMatch {
  no: number;
  round: Round;
  home: Slot;
  away: Slot;
}

export interface SkeletonRound {
  round: Round;
  label: string;
  short: string;
  matches: SkeletonMatch[];
}

const wg = (group: string): Slot => ({ kind: 'winnerGroup', group });
const rg = (group: string): Slot => ({ kind: 'runnerUpGroup', group });
const tp = (groups: string): Slot => ({ kind: 'thirdPlace', groups: groups.split('') });
const wo = (match: number): Slot => ({ kind: 'winnerOf', match });
const lo = (match: number): Slot => ({ kind: 'loserOf', match });

const m = (no: number, round: Round, home: Slot, away: Slot): SkeletonMatch => ({
  no,
  round,
  home,
  away,
});

export const SKELETON_ROUNDS: SkeletonRound[] = [
  {
    round: 'R32',
    label: 'Round of 32',
    short: 'R32',
    // Display order top→bottom: 74,77,73,75,83,84,81,82,76,78,79,80,86,88,85,87
    matches: [
      m(74, 'R32', wg('E'), tp('ABCDF')),
      m(77, 'R32', wg('I'), tp('CDFGH')),
      m(73, 'R32', rg('A'), rg('B')),
      m(75, 'R32', wg('F'), rg('C')),
      m(83, 'R32', rg('K'), rg('L')),
      m(84, 'R32', wg('H'), rg('J')),
      m(81, 'R32', wg('D'), tp('BEFIJ')),
      m(82, 'R32', wg('G'), tp('AEHIJ')),
      m(76, 'R32', wg('C'), rg('F')),
      m(78, 'R32', rg('E'), rg('I')),
      m(79, 'R32', wg('A'), tp('CEFHI')),
      m(80, 'R32', wg('L'), tp('EHIJK')),
      m(86, 'R32', wg('J'), rg('H')),
      m(88, 'R32', rg('D'), rg('G')),
      m(85, 'R32', wg('B'), tp('EFGIJ')),
      m(87, 'R32', wg('K'), tp('DEIJL')),
    ],
  },
  {
    round: 'R16',
    label: 'Round of 16',
    short: 'R16',
    // Display order: 89,90,93,94,91,92,95,96
    matches: [
      m(89, 'R16', wo(74), wo(77)),
      m(90, 'R16', wo(73), wo(75)),
      m(93, 'R16', wo(83), wo(84)),
      m(94, 'R16', wo(81), wo(82)),
      m(91, 'R16', wo(76), wo(78)),
      m(92, 'R16', wo(79), wo(80)),
      m(95, 'R16', wo(86), wo(88)),
      m(96, 'R16', wo(85), wo(87)),
    ],
  },
  {
    round: 'QF',
    label: 'Quarter-finals',
    short: 'QF',
    matches: [
      m(97, 'QF', wo(89), wo(90)),
      m(98, 'QF', wo(93), wo(94)),
      m(99, 'QF', wo(91), wo(92)),
      m(100, 'QF', wo(95), wo(96)),
    ],
  },
  {
    round: 'SF',
    label: 'Semi-finals',
    short: 'SF',
    matches: [
      m(101, 'SF', wo(97), wo(98)),
      m(102, 'SF', wo(99), wo(100)),
    ],
  },
  {
    round: 'F',
    label: 'Final',
    short: 'Final',
    matches: [m(104, 'F', wo(101), wo(102))],
  },
];

export const THIRD_PLACE: SkeletonMatch = m(103, '3P', lo(101), lo(102));
