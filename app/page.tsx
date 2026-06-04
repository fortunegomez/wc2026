import { getBoard } from '@/lib/engine';
import { SiteHeader } from '@/components/SiteHeader';
import { Flag } from '@/components/Flag';

export const revalidate = 300;

export default async function Home() {
  const { board, started, hasToken } = await getBoard();
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
        <div>
          {board.map((t) => (
            <div className={`row${t.rank === 1 ? ' top1' : ''}`} key={t.name}>
              <div className="rank">{t.rank}</div>
              <Flag cc={t.cc} alt={t.name} />
              <div>
                <div className="name">
                  {t.name}
                  {t.delta > 0 && <span className="delta up">▲{t.delta}</span>}
                  {t.delta < 0 && (
                    <span className="delta down">▼{-t.delta}</span>
                  )}
                </div>
                <div className="meta">
                  {t.conf} · rating {Math.round(t.rating)}
                </div>
              </div>
              <div className="pctwrap">
                <div className="pct">{t.pct.toFixed(1)}%</div>
                <div className="barback">
                  <div
                    className="barfill"
                    style={{ width: `${((t.pct / max) * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
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
