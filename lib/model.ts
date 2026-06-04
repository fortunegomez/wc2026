// The model — pure maths, no data fetching. Mirrors world-cup-predictor.html.
//
// This is the "brain". It never touches the DOM or the network, so the UI
// (the "face") can be redesigned freely without affecting these numbers.

// Temperature for the softmax. Controls how spread out the favourites are.
// Matches the attached file (chance proportional to exp(rating / 100)).
const TEMPERATURE = 100;

export interface HasRating {
  rating: number;
}

// Turn ratings into a championship % across the given teams (a softmax).
// Percentages sum to 100. Pass all 48 teams for the title board, or a
// single group's 4 teams for a "predicted group winner".
export function titleOdds<T extends HasRating>(
  teams: T[],
): (T & { pct: number })[] {
  if (teams.length === 0) return [];
  const exps = teams.map((t) => Math.exp(t.rating / TEMPERATURE));
  const sum = exps.reduce((a, b) => a + b, 0);
  return teams.map((t, i) => ({ ...t, pct: (exps[i] / sum) * 100 }));
}

// Elo update after one finished match. Mutates the two team objects'
// `rating` in place — the same maths FIFA's ranking uses.
//   K = 50 for group-stage games, 60 for knockout games.
//   Goal-difference multiplier G: 1 for a 1-goal or drawn game,
//   1.5 for 2 goals, (11 + gd) / 8 for 3+.
export function applyElo(
  a: HasRating,
  b: HasRating,
  goalsA: number,
  goalsB: number,
  K: number,
): void {
  const Ra = a.rating;
  const Rb = b.rating;
  const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
  const Eb = 1 - Ea;
  const Sa = goalsA > goalsB ? 1 : goalsA < goalsB ? 0 : 0.5;
  const Sb = 1 - Sa;
  const gd = Math.abs(goalsA - goalsB);
  const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
  a.rating = Ra + K * G * (Sa - Ea);
  b.rating = Rb + K * G * (Sb - Eb);
}

// K factor for a match given its competition stage.
export function kForStage(stage: string | undefined): number {
  return stage === 'GROUP_STAGE' ? 50 : 60;
}
