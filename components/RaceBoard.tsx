'use client';

// THE RACE board, made clickable. Each row opens a popup with that team's
// title chance, its group standing, and its matches so far / upcoming. From the
// semifinals on, rows carry end-of-tournament status: finalists (title odds
// split between the two), bronze contenders (no %), and the champion / runner-up
// / third-place podium with trophy badges.

import { Fragment, useState } from 'react';
import type { BoardTeam, BoardStatus, TeamDetail } from '@/lib/engine';
import { Flag } from './Flag';
import { Popup } from './Popup';

const TROPHY: Partial<Record<BoardStatus, 'gold' | 'silver' | 'bronze'>> = {
  champion: 'gold',
  runnerUp: 'silver',
  thirdPlace: 'bronze',
};

function Trophy({ place }: { place: 'gold' | 'silver' | 'bronze' }) {
  return (
    <svg className={`trophy ${place}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h12v2h3v3a4 4 0 0 1-4 4h-.6A5.5 5.5 0 0 1 13 15.8V18h3v2H8v-2h3v-2.2A5.5 5.5 0 0 1 7.6 12H7a4 4 0 0 1-4-4V5h3V3Zm0 4H5v1a2 2 0 0 0 2 2V7Zm12 0v3a2 2 0 0 0 2-2V7h-2Z" />
    </svg>
  );
}

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
        {board.map((t, i) => {
          const st = t.status;
          const trophy = TROPHY[st];
          const podiumWin = !!trophy;
          return (
            <Fragment key={t.name}>
              {i === firstOutIndex && (
                <div className="outline">
                  <span>Eliminated</span>
                </div>
              )}
              <div
                className={`row clickable${st === 'champion' ? ' champion' : ''}${
                  t.eliminated ? ' out' : ''
                }${!podiumWin && !t.eliminated && t.rank === 1 ? ' top1' : ''}`}
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
                <div className="rank">
                  {trophy ? <Trophy place={trophy} /> : t.rank}
                </div>
                <Flag cc={t.cc} alt={t.name} />
                <div>
                  <div className="name">
                    {t.name}
                    {st === 'finalist' && (
                      <span className="tag-status finalist">Finalist</span>
                    )}
                    {st === 'bronzeContender' && (
                      <span className="tag-status bronze">Bronze</span>
                    )}
                    {!podiumWin && t.delta > 0 && (
                      <span className="delta up">▲{t.delta}</span>
                    )}
                    {!podiumWin && t.delta < 0 && (
                      <span className="delta down">▼{-t.delta}</span>
                    )}
                  </div>
                  <div className="meta">
                    {t.conf} · rating {Math.round(t.rating)}
                  </div>
                </div>
                <div className="pctwrap">
                  {st === 'champion' ? (
                    <div className="pct champ">Champions</div>
                  ) : st === 'runnerUp' ? (
                    <div className="pct medal">Runner-up</div>
                  ) : st === 'thirdPlace' ? (
                    <div className="pct medal">Third place</div>
                  ) : st === 'bronzeContender' ? (
                    <div className="pct pending">3rd-place match</div>
                  ) : t.eliminated ? (
                    <div className="pct out">OUT</div>
                  ) : (
                    <>
                      <div className="pct">{t.pct.toFixed(1)}%</div>
                      <div className="barback">
                        <div
                          className="barfill"
                          style={{ width: `${((t.pct / max) * 100).toFixed(1)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
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

const BANNER: Partial<Record<BoardStatus, { text: string; tone: string }>> = {
  champion: { text: 'Champions — winners of the World Cup', tone: 'gold' },
  runnerUp: { text: 'Runner-up — lost the final', tone: 'silver' },
  thirdPlace: { text: 'Third place', tone: 'bronze' },
  bronzeContender: {
    text: 'Still in — plays the third-place match',
    tone: 'bronze',
  },
  eliminated: { text: 'Eliminated — out of the tournament', tone: '' },
};

function titleChance(team: BoardTeam): string {
  switch (team.status) {
    case 'champion':
      return 'Champions';
    case 'runnerUp':
      return 'Runner-up';
    case 'thirdPlace':
      return 'Third place';
    case 'bronzeContender':
      return '—';
    case 'eliminated':
      return 'OUT';
    default:
      return `${team.pct.toFixed(1)}%`;
  }
}

function TeamCard({ team, detail }: { team: BoardTeam; detail: TeamDetail }) {
  const banner = BANNER[team.status];
  return (
    <>
      {banner && <div className={`pop-out ${banner.tone}`}>{banner.text}</div>}
      <div className="pop-stats">
        <div className="pop-stat">
          <span className="k">Title chance</span>
          <span className="v">{titleChance(team)}</span>
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
                      {m.shootout && (
                        <span className="pm-pen">
                          {m.penFor != null && m.penAgainst != null
                            ? `PEN ${m.penFor}:${m.penAgainst}`
                            : 'PEN'}
                        </span>
                      )}
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
