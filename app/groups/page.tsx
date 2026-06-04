import { getGroups, kickoffLabel } from '@/lib/engine';
import { SiteHeader } from '@/components/SiteHeader';
import { Flag } from '@/components/Flag';
import { EmptyState } from '@/components/EmptyState';

export const revalidate = 300;

export default async function GroupsPage() {
  const { groups, hasToken, kickoff } = await getGroups();

  return (
    <>
      <SiteHeader
        kicker="12 groups · the model's pick in each"
        title={
          <>
            The <span className="em">Groups</span>
          </>
        }
        sub="All 12 groups with the model's predicted winner — the team most likely to finish top, based on its current rating. Real standings fill in as games are played."
      />

      {groups.length === 0 ? (
        <div className="card">
          <EmptyState title="Groups start June 11">
            {hasToken ? (
              <>
                Once the draw and fixtures are published by football-data.org,
                all 12 groups and their predicted winners appear here. Kick-off:{' '}
                {kickoffLabel(kickoff)}.
              </>
            ) : (
              <>
                No data token is configured yet. Group tables and predicted
                winners show up here once deployed with a football-data.org
                token.
              </>
            )}
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div className="groupgrid">
            {groups.map((g) => (
              <div className="group" key={g.key}>
                <div className="grouphead">
                  <span className="gname">{g.label}</span>
                </div>
                {g.predictedWinner && (
                  <div className="pickrow">
                    <span className="lbl">Pick</span>
                    <Flag
                      cc={g.predictedWinner.cc}
                      alt={g.predictedWinner.name}
                    />
                    <span>{g.predictedWinner.name}</span>
                  </div>
                )}
                <table className="gtable">
                  <thead>
                    <tr>
                      <th className="tleft">
                        {g.hasResults ? 'Team' : 'Team (by rating)'}
                      </th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GD</th>
                      <th>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.table.map((r, i) => (
                      <tr key={r.name} className={i < 2 ? 'qualify' : ''}>
                        <td className="tname">
                          <Flag cc={r.cc} alt={r.name} />
                          <span>{r.name}</span>
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.draw}</td>
                        <td>{r.lost}</td>
                        <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                        <td className="pts">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          {!hasToken && (
            <div className="notice">
              <b>Preview mode.</b> Showing seed-rating order. Real standings
              appear once deployed with a data token.
            </div>
          )}
        </div>
      )}
    </>
  );
}
