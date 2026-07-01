'use client';

// The tournament bracket. On desktop it's a left-to-right set of round columns
// (R32 → Final) that reads like a standard bracket; on mobile a round selector
// shows one round at a time (a full bracket is too wide for a phone). Undecided
// slots show which round the team arrives from ("R32 winner"), since
// football-data.org doesn't expose exact match-to-match linkage.

import { useState } from 'react';
import type { BracketRound, BracketMatch } from '@/lib/engine';
import { Flag } from './Flag';

export function Bracket({
  rounds,
  thirdPlace,
}: {
  rounds: BracketRound[];
  thirdPlace: BracketMatch | null;
}) {
  // Mobile selector defaults to the first round still being played.
  const active = rounds.findIndex((r) => r.matches.some((m) => !m.played));
  const [sel, setSel] = useState(active === -1 ? 0 : active);

  return (
    <>
      <div className="brsel">
        {rounds.map((r, i) => (
          <button
            key={r.key}
            className={`brsel-btn${i === sel ? ' active' : ''}`}
            onClick={() => setSel(i)}
          >
            {r.short}
          </button>
        ))}
      </div>

      <div className="bracket">
        {rounds.map((r, i) => (
          <div className={`bround${i === sel ? ' sel' : ''}`} key={r.key}>
            <div className="brhead">{r.label}</div>
            <div className="brmatches">
              {r.matches.map((m) => (
                <MatchCard
                  key={m.id}
                  m={m}
                  feeder={rounds[i - 1]?.short ?? null}
                  last={i === rounds.length - 1}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {thirdPlace && (
        <div className="bthird">
          <div className="brhead">Third-place playoff</div>
          <MatchCard m={thirdPlace} feeder="SF" feederLoser last />
        </div>
      )}
    </>
  );
}

function MatchCard({
  m,
  feeder,
  feederLoser,
  last,
}: {
  m: BracketMatch;
  feeder: string | null;
  feederLoser?: boolean;
  last?: boolean;
}) {
  const placeholder = feeder
    ? `${feeder} ${feederLoser ? 'loser' : 'winner'}`
    : 'To be decided';

  const slot = (
    team: BracketMatch['home'],
    isWinner: boolean,
    score: number | null,
  ) => (
    <div className={`bteam${isWinner ? ' win' : m.played ? ' lose' : ''}`}>
      {team.name ? (
        <Flag cc={team.cc} crest={team.crest} alt={team.name} />
      ) : (
        <span className="flag ph" aria-hidden="true" />
      )}
      <span className={`bname${team.name ? '' : ' tbd'}`}>
        {team.name ?? placeholder}
      </span>
      <span className="bscore">{score != null ? score : ''}</span>
    </div>
  );

  return (
    <div className={`bmatch${last ? ' last' : ''}`}>
      {slot(m.home, m.winner === 'home', m.homeScore)}
      {slot(m.away, m.winner === 'away', m.awayScore)}
      {m.shootout && (
        <div className="bpen">
          {m.pen ? `PEN ${m.pen.home}:${m.pen.away}` : 'PEN'}
        </div>
      )}
      {!m.played && (m.dateLabel || m.time) && (
        <div className="bwhen">
          {m.dateLabel}
          {m.time ? ` · ${m.time}` : ''}
        </div>
      )}
    </div>
  );
}
