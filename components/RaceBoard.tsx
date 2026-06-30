'use client';

// THE RACE board, made clickable. Each row opens a popup with that team's
// title chance, its group standing, and its matches so far / upcoming. All the
// data is computed on the server and passed in — the popup makes no API calls.

import { Fragment, useState } from 'react';
import type { BoardTeam, TeamDetail } from '@/lib/engine';
import { Flag } from './Flag';
import { Popup } from './Popup';

export function RaceBoard({
  board,
  details,
  max,
}: {
  board: BoardTeam[];
  details: Record<string, TeamDetail>;
  max: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const team = selected ? board.find((t) => t.name === selected) ?? null : null;
  const detail = selected ? details[selected] ?? null : null;
  // Where the "Eliminated" divider goes (first out team, if any).
  const firstOutIndex = board.findIndex((t) => t.eliminated);

  return (
    <>
      <div>
        {board.map((t, i) => (
          <Fragment key={t.name}>
            {i === firstOutIndex && (
              <div className="outline">
                <span>Eliminated</span>
              </div>
            )}
            <div
              className={`row clickable${
                !t.eliminated && t.rank === 1 ? ' top1' : ''
              }${t.eliminated ? ' out' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(t.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(t.name);
                }
              }}
            >
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
                {t.eliminated ? (
                  <div className="pct out">OUT</div>
                ) : (
                  <>
                    <div className="pct">{t.pct.toFixed(1)}%</div>
                    <div className="barback">
                      <div
                        className="barfill"
                        style={{
                          width: `${((t.pct / max) * 100).toFixed(1)}%`,
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </Fragment>
        ))}
      </div>

      <Popup
        open={team !== null}
        onClose={() => setSelected(null)}
        title={
          team && (
            <span className="pop-teamtitle">
              <Flag cc={team.cc} alt={team.name} />
              <span>{team.name}</span>
            </span>
          )
        }
      >
        {team && detail && <TeamCard team={team} detail={detail} />}
      </Popup>
    </>
  );
}

function TeamCard({ team, detail }: { team: BoardTeam; detail: TeamDetail }) {
  return (
    <>
      {team.eliminated && (
        <div className="pop-out">Eliminated — out of the tournament</div>
      )}
      <div className="pop-stats">
        <div className="pop-stat">
          <span className="k">Title chance</span>
          <span className="v">{team.eliminated ? 'OUT' : `${team.pct.toFixed(1)}%`}</span>
        </div>
        <div className="pop-stat">
          <span className="k">Rank</span>
          <span className="v">#{team.rank}</span>
        </div>
        <div className="pop-stat">
          <span className="k">Rating</span>
          <span className="v">{Math.round(team.rating)}</span>
        </div>
        <div className="pop-stat">
          <span className="k">Group</span>
          <span className="v">{detail.group ?? '—'}</span>
        </div>
      </div>

      {detail.standing && (
        <div className="pop-section">
          <div className="pop-label">Group {detail.group} standing</div>
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
              {detail.standing.map((r) => (
                <tr key={r.name} className={r.name === team.name ? 'qualify' : ''}>
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

      <div className="pop-section">
        <div className="pop-label">Matches</div>
        {detail.matches.length === 0 ? (
          <div className="pop-empty">No matches scheduled yet.</div>
        ) : (
          <div className="pop-matches">
            {detail.matches.map((m, i) => (
              <div className="pop-match" key={i}>
                <span className="pm-when">{m.dateLabel}</span>
                <span className="pm-opp">
                  <span className="pm-ha">{m.home ? 'vs' : '@'}</span>
                  <Flag cc={m.opponentCc} alt={m.opponent} />
                  <span className="pm-name">{m.opponent}</span>
                </span>
                <span className="pm-res">
                  {m.finished || m.live ? (
                    <>
                      <b>
                        {m.scoreFor}–{m.scoreAgainst}
                      </b>
                      {m.live && <span className="pm-badge live">LIVE</span>}
                      {m.result && (
                        <span className={`pm-badge ${m.result}`}>{m.result}</span>
                      )}
                    </>
                  ) : (
                    <span className="pm-time">{m.time}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
