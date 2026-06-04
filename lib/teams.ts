// The 48 qualified teams with seed ratings from the FIFA / Coca-Cola World
// Ranking (April 2026). Ported verbatim from world-cup-predictor.html.
// `cc` is the ISO country code used for the flag image (flagcdn.com).

export type Confederation =
  | 'UEFA'
  | 'CONMEBOL'
  | 'CAF'
  | 'CONCACAF'
  | 'AFC'
  | 'OFC';

export interface SeedTeam {
  name: string;
  cc: string;
  conf: Confederation;
  rating: number;
}

export const SEED: SeedTeam[] = [
  { name: 'France', cc: 'fr', conf: 'UEFA', rating: 1877.32 },
  { name: 'Spain', cc: 'es', conf: 'UEFA', rating: 1876.4 },
  { name: 'Argentina', cc: 'ar', conf: 'CONMEBOL', rating: 1874.81 },
  { name: 'England', cc: 'gb-eng', conf: 'UEFA', rating: 1825.97 },
  { name: 'Portugal', cc: 'pt', conf: 'UEFA', rating: 1763.83 },
  { name: 'Brazil', cc: 'br', conf: 'CONMEBOL', rating: 1761.16 },
  { name: 'Netherlands', cc: 'nl', conf: 'UEFA', rating: 1757.87 },
  { name: 'Morocco', cc: 'ma', conf: 'CAF', rating: 1755.87 },
  { name: 'Belgium', cc: 'be', conf: 'UEFA', rating: 1734.71 },
  { name: 'Germany', cc: 'de', conf: 'UEFA', rating: 1730.37 },
  { name: 'Croatia', cc: 'hr', conf: 'UEFA', rating: 1717.07 },
  { name: 'Colombia', cc: 'co', conf: 'CONMEBOL', rating: 1693.09 },
  { name: 'Senegal', cc: 'sn', conf: 'CAF', rating: 1688.99 },
  { name: 'Mexico', cc: 'mx', conf: 'CONCACAF', rating: 1681.03 },
  { name: 'USA', cc: 'us', conf: 'CONCACAF', rating: 1673.13 },
  { name: 'Uruguay', cc: 'uy', conf: 'CONMEBOL', rating: 1673.07 },
  { name: 'Japan', cc: 'jp', conf: 'AFC', rating: 1660.43 },
  { name: 'Switzerland', cc: 'ch', conf: 'UEFA', rating: 1649.4 },
  { name: 'Iran', cc: 'ir', conf: 'AFC', rating: 1638 },
  { name: 'Australia', cc: 'au', conf: 'AFC', rating: 1588 },
  { name: 'South Korea', cc: 'kr', conf: 'AFC', rating: 1575 },
  { name: 'Ecuador', cc: 'ec', conf: 'CONMEBOL', rating: 1568 },
  { name: 'Austria', cc: 'at', conf: 'UEFA', rating: 1562 },
  { name: 'Türkiye', cc: 'tr', conf: 'UEFA', rating: 1546 },
  { name: 'Sweden', cc: 'se', conf: 'UEFA', rating: 1532 },
  { name: 'Norway', cc: 'no', conf: 'UEFA', rating: 1528 },
  { name: 'Egypt', cc: 'eg', conf: 'CAF', rating: 1518 },
  { name: 'Panama', cc: 'pa', conf: 'CONCACAF', rating: 1512 },
  { name: 'Scotland', cc: 'gb-sct', conf: 'UEFA', rating: 1503 },
  { name: 'Ivory Coast', cc: 'ci', conf: 'CAF', rating: 1500 },
  { name: 'Tunisia', cc: 'tn', conf: 'CAF', rating: 1492 },
  { name: 'Czechia', cc: 'cz', conf: 'UEFA', rating: 1491 },
  { name: 'Algeria', cc: 'dz', conf: 'CAF', rating: 1486 },
  { name: 'Paraguay', cc: 'py', conf: 'CONMEBOL', rating: 1481 },
  { name: 'Canada', cc: 'ca', conf: 'CONCACAF', rating: 1480 },
  { name: 'New Zealand', cc: 'nz', conf: 'OFC', rating: 1462 },
  { name: 'Ghana', cc: 'gh', conf: 'CAF', rating: 1455 },
  { name: 'Bosnia & Herzegovina', cc: 'ba', conf: 'UEFA', rating: 1450 },
  { name: 'Qatar', cc: 'qa', conf: 'AFC', rating: 1448 },
  { name: 'Saudi Arabia', cc: 'sa', conf: 'AFC', rating: 1445 },
  { name: 'South Africa', cc: 'za', conf: 'CAF', rating: 1445 },
  { name: 'DR Congo', cc: 'cd', conf: 'CAF', rating: 1442 },
  { name: 'Uzbekistan', cc: 'uz', conf: 'AFC', rating: 1438 },
  { name: 'Iraq', cc: 'iq', conf: 'AFC', rating: 1410 },
  { name: 'Jordan', cc: 'jo', conf: 'AFC', rating: 1392 },
  { name: 'Cape Verde', cc: 'cv', conf: 'CAF', rating: 1380 },
  { name: 'Curaçao', cc: 'cw', conf: 'CONCACAF', rating: 1330 },
  { name: 'Haiti', cc: 'ht', conf: 'CONCACAF', rating: 1322 },
];
