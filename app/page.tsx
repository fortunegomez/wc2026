import { getBoard } from '@/lib/engine';
import { SiteHeader } from '@/components/SiteHeader';
import { RaceBoard } from '@/components/RaceBoard';

export const revalidate = 300;

export default async function Home() {
  const { board, teamDetails, started, hasToken } = await getBoard();
  const max = board[0]?.pct ?? 1;
  const phase = !hasToken
    ? 'Preview · seed ratings'
    : started
      ? 'Updating live'
      : 'Pre-tournament';

  return (
    <>
      <SiteHeader
        kicker="Live model · seeded by FIFA ranking"
        title={
          <>
            Who wins the
            <br />
            <span className="em">World Cup?</span>
          </>
        }
        sub="All 48 teams ranked by their chance to lift the trophy. As real results come in, the board reshuffles itself — winners climb, losers slide — all the way to the final."
      />

      <div className="card">
        <h2>
          <span>The board</span>
          <span>{phase}</span>
        </h2>
        <RaceBoard board={board} details={teamDetails} max={max} />
        <div className="taphint">Tap any team for its group &amp; results</div>
      </div>

      {!hasToken && (
        <div className="notice">
          <b>Preview mode.</b> No data token is configured, so the board shows
          the pre-tournament seed ratings. Once deployed with a
          football-data.org token it updates automatically as results come in.
        </div>
      )}

      <div className="note">
        <b>How the number is worked out.</b> Each team starts with a strength
        rating from the official FIFA / Coca-Cola World Ranking (April 2026).
        Ratings become a title chance across all 48 teams, so the percentages
        add up to 100%. After every finished match both teams&apos; ratings
        shift using the Elo formula FIFA uses (a bigger winning margin moves them
        more), then every percentage is recalculated. ▲▼ shows movement since
        the pre-tournament seeding. It gives odds, never certainty — football
        stays unpredictable.
      </div>
    </>
  );
}
