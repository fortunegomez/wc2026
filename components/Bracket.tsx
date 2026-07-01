'use client';

// The tournament bracket, driven by the fixed FIFA skeleton (lib/bracketSkeleton
// + getBracket). Desktop is a left-to-right set of round columns that reads like
// a standard bracket (matches are in bracket order, so each child centres
// between its two feeders); mobile shows one round at a time via a selector.
// Undecided slots carry a real "Winner M##" label from the skeleton.

import { useState } from 'react';
import type { BracketRound, BracketMatch, BracketSlot } from '@/lib/engine';
import { Flag } from './Flag';

export function Bracket({
  rounds,
  thirdPlace,
}: {
  rounds: BracketRound[];
  thirdPlace: BracketMatch | null;
}) {
  const active = rounds.findIndex((r) => r.matches.some((m) => !m.played));
  const [sel, setSel] = useState(active === -1 ? 0 : active);

  return (
    <>
      <div className="brsel">
        {rounds.map((r, i) => (
          <button
            key={r.round}
            className={`brsel-btn${i === sel ? ' active' : ''}`}
            onClick={() => setSel(i)}
          >
            {r.short}
          </button>
        ))}
      </div>

      <div className="bracket">
        {rounds.map((r, i) => (
          <div className={`bround${i === sel ? ' sel' : ''}`} key={r.round}>
            <div className="brhead">{r.label}</div>
            <div className="brmatches">
              {r.matches.map((m) => (
                <MatchCard key={m.no} m={m} last={i === rounds.length - 1} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {thirdPlace && (
        <div className="bthird">
          <div className="brhead">Third-place playoff</div>
          <MatchCard m={thirdPlace} last />
        </div>
      )}
    </>
  );
}

function Side({
  slot,
  winner,
  score,
  dim,
}: {
  slot: BracketSlot;
  winner: boolean;
  score: number | null;
  dim: boolean;
}) {
  return (
    <div className={`bteam${winner ? ' win' : dim ? ' lose' : ''}`}>
      {slot.name ? (
        <Flag cc={slot.cc} crest={slot.crest} alt={slot.name} />
      ) : (
        <span className="flag ph" aria-hidden="true" />
      )}
      <span className={`bname${slot.name ? '' : ' tbd'}`}>
        {slot.name ?? slot.placeholder}
      </span>
      <span className="bscore">{score != null ? score : ''}</span>
    </div>
  );
}

function MatchCard({ m, last }: { m: BracketMatch; last?: boolean }) {
  return (
    <div className={`bmatch${last ? ' last' : ''}`}>
      <span className="bno">M{m.no}</span>
      <Side
        slot={m.home}
        winner={m.winner === 'home'}
        score={m.homeScore}
        dim={m.played && m.winner === 'away'}
      />
      <Side
        slot={m.away}
        winner={m.winner === 'away'}
        score={m.awayScore}
        dim={m.played && m.winner === 'home'}
      />
      {m.shootout && (
        <div className="bpen">
          {m.pen ? `PEN ${m.pen.home}:${m.pen.away}` : 'PEN'}
        </div>
      )}
      {!m.played && m.dateLabel && (
        <div className="bwhen">
          {m.dateLabel}
          {m.time ? ` · ${m.time}` : ''}
        </div>
      )}
    </div>
  );
}
