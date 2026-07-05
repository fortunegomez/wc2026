// The match-detail popup body, shared by Fixtures & Results and the bracket.
// Renders the score, penalty line, goal scorers (where available), stage/date,
// and — for group games — the group standing table.

import type { FixtureMatch, GroupRow } from '@/lib/engine';
import { Flag } from './Flag';

export function GameCard({
  m,
  standing,
}: {
  m: FixtureMatch;
  standing: GroupRow[] | null;
}) {
  return (
    <>
      <div className="pop-score">
        <div className="ps-team">
          <Flag cc={m.home.cc} crest={m.home.crest} alt={m.home.name} />
          <span>{m.home.name}</span>
        </div>
        <div className="ps-mid">
          {m.finished || m.live ? (
            <div className="ps-num">
              {m.homeGoals ?? 0}–{m.awayGoals ?? 0}
            </div>
          ) : (
            <div className="ps-time">{m.time}</div>
          )}
          {m.shootout && (
            <div className="pen">
              {m.pen ? `PEN ${m.pen.home}:${m.pen.away}` : 'PEN'}
            </div>
          )}
          <div className={`tag${m.live ? ' live' : m.finished ? ' ft' : ''}`}>
            {m.live ? 'Live' : m.finished ? 'Full time' : 'Kick-off (WAT)'}
          </div>
        </div>
        <div className="ps-team">
          <Flag cc={m.away.cc} crest={m.away.crest} alt={m.away.name} />
          <span>{m.away.name}</span>
        </div>
      </div>

      {m.goals && (m.goals.home.length > 0 || m.goals.away.length > 0) && (
        <div className="pop-goals">
          <ul className="pg-col">
            {m.goals.home.map((g, i) => (
              <li key={i}>
                {g.name}
                <span className="pg-min">
                  {g.minute != null ? ` ${g.minute}'` : ''}
                  {g.penalty ? ' (pen)' : ''}
                  {g.owngoal ? ' (og)' : ''}
                </span>
              </li>
            ))}
          </ul>
          <span className="pg-ball" aria-hidden="true">
            ⚽
          </span>
          <ul className="pg-col right">
            {m.goals.away.map((g, i) => (
              <li key={i}>
                {g.name}
                <span className="pg-min">
                  {g.minute != null ? ` ${g.minute}'` : ''}
                  {g.penalty ? ' (pen)' : ''}
                  {g.owngoal ? ' (og)' : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pop-metarow">
        <span>
          {m.stageLabel}
          {m.groupLabel ? ` · Group ${m.groupLabel}` : ''}
        </span>
        <span>
          {m.dateLabel} · {m.time} WAT
        </span>
      </div>

      {standing && (
        <div className="pop-section">
          <div className="pop-label">Group {m.groupLabel} standing</div>
          <table className="gtable">
            <thead>
              <tr>
                <th className="tleft">Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GD</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {standing.map((r) => (
                <tr
                  key={r.name}
                  className={
                    r.name === m.home.name || r.name === m.away.name
                      ? 'qualify'
                      : ''
                  }
                >
                  <td className="tname">
                    <Flag cc={r.cc} alt={r.name} />
                    {r.name}
                  </td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.draw}</td>
                  <td>{r.lost}</td>
                  <td>{r.gd}</td>
                  <td className="pts">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
