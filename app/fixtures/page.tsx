import { getFixtures, kickoffLabel } from '@/lib/engine';
import { SiteHeader } from '@/components/SiteHeader';
import { FixturesList } from '@/components/FixturesList';
import { EmptyState } from '@/components/EmptyState';

export const revalidate = 300;

export default async function FixturesPage() {
  const { sections, standingsByGroup, hasToken, kickoff } = await getFixtures();

  return (
    <>
      <SiteHeader
        kicker="Every match · all 104 games"
        title={
          <>
            Fixtures &amp; <span className="em">Results</span>
          </>
        }
        sub="The latest results show first, with the next fixtures just below — scroll up for earlier games. Kick-off times are in Nigerian time (WAT)."
      />

      <div className="card">
        {sections.length === 0 ? (
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
          <FixturesList
            sections={sections}
            standingsByGroup={standingsByGroup}
          />
        )}
      </div>
    </>
  );
}
