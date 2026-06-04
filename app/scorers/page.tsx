import { getScorersView, kickoffLabel } from '@/lib/engine';
import { SiteHeader } from '@/components/SiteHeader';
import { Flag } from '@/components/Flag';
import { EmptyState } from '@/components/EmptyState';

export const revalidate = 900;

export default async function ScorersPage() {
  const { scorers, hasToken, kickoff } = await getScorersView();

  return (
    <>
      <SiteHeader
        kicker="Golden boot race · goals only"
        title={
          <>
            Top <span className="em">Scorers</span>
          </>
        }
        sub="The goalscoring leaderboard, updated automatically as the tournament unfolds."
      />

      <div className="card">
        <h2>
          <span>Goals</span>
          <span>Golden Boot</span>
        </h2>
        {scorers.length === 0 ? (
          <EmptyState title="No goals yet">
            {hasToken ? (
              <>
                The scorers board fills up once the first goals are scored. The
                tournament starts {kickoffLabel(kickoff)}.
              </>
            ) : (
              <>
                No data token is configured yet. The leaderboard appears here
                once deployed with a football-data.org token.
              </>
            )}
          </EmptyState>
        ) : (
          scorers.map((s) => (
            <div className="scorer" key={`${s.player}-${s.rank}`}>
              <div className="rank">{s.rank}</div>
              <Flag cc={s.cc} crest={s.crest} alt={s.team} />
              <div>
                <div className="name">{s.player}</div>
                <div className="meta">{s.team}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="goals">{s.goals}</div>
                <div className="goalslbl">goals</div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
