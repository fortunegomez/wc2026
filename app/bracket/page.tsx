import { getBracket, kickoffLabel } from '@/lib/engine';
import { SiteHeader } from '@/components/SiteHeader';
import { Bracket } from '@/components/Bracket';
import { EmptyState } from '@/components/EmptyState';

export const revalidate = 300;

export default async function BracketPage() {
  const { rounds, thirdPlace, hasKnockouts, hasToken, kickoff } =
    await getBracket();

  return (
    <>
      <SiteHeader
        kicker="Knockouts · the road to the final"
        title={
          <>
            Tournament <span className="em">Bracket</span>
          </>
        }
        sub="Every knockout tie from the Round of 32 to the Final. Winners advance to the right; scores and penalty results fill in as games are played."
      />

      <div className="card">
        {!hasKnockouts ? (
          <EmptyState title="Bracket starts at the Round of 32">
            {hasToken ? (
              <>
                The knockout bracket fills in once the group stage finishes — the
                tournament kicks off {kickoffLabel(kickoff)}.
              </>
            ) : (
              <>
                No data token is configured yet. The bracket appears here once
                results are flowing.
              </>
            )}
          </EmptyState>
        ) : (
          <Bracket rounds={rounds} thirdPlace={thirdPlace} />
        )}
      </div>
    </>
  );
}
