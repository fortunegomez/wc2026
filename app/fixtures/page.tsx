import { getFixtures, kickoffLabel } from '@/lib/engine';
import { SiteHeader } from '@/components/SiteHeader';
import { Flag } from '@/components/Flag';
import { EmptyState } from '@/components/EmptyState';

export const revalidate = 300;

export default async function FixturesPage() {
  const { days, hasToken, kickoff } = await getFixtures();

  return (
    <>
      <SiteHeader
        kicker="Every match · all 104 games"
        title={
          <>
            Fixtures &amp; <span className="em">Results</span>
          </>
        }
        sub="Every game of the tournament, grouped by day. Live scores and finished results appear automatically. Kick-off times shown in UTC."
      />

      <div className="card">
        {days.length === 0 ? (
          <EmptyState title="Fixtures land soon">
            {hasToken ? (
              <>
                The schedule appears here as soon as football-data.org publishes
                it. The tournament kicks off {kickoffLabel(kickoff)}.
              </>
            ) : (
              <>
                No data token is configured yet. Once deployed with a
                football-data.org token, every fixture and result shows up here
                automatically.
              </>
            )}
          </EmptyState>
        ) : (
          days.map((day) => (
            <div key={day.date}>
              <div className="dayhead">{day.label}</div>
              {day.matches.map((m) => (
                <div className="match" key={m.id}>
                  <div className="side home">
                    <Flag cc={m.home.cc} crest={m.home.crest} alt={m.home.name} />
                    <span className="name">{m.home.name}</span>
                  </div>
                  <div className="center">
                    {m.finished || m.live ? (
                      <div className="scoreline">
                        {m.homeGoals ?? 0}–{m.awayGoals ?? 0}
                      </div>
                    ) : (
                      <div className="vs">{m.time}</div>
                    )}
                    <div
                      className={`tag${
                        m.live ? ' live' : m.finished ? ' ft' : ''
                      }`}
                    >
                      {m.live
                        ? 'Live'
                        : m.finished
                          ? 'Full time'
                          : m.groupLabel
                            ? `Group ${m.groupLabel}`
                            : m.stageLabel}
                    </div>
                  </div>
                  <div className="side away">
                    <Flag cc={m.away.cc} crest={m.away.crest} alt={m.away.name} />
                    <span className="name">{m.away.name}</span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}
