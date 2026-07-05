'use client';

// The tournament bracket. Desktop: bracket-ordered columns with an SVG overlay
// whose connector coordinates are measured from the ACTUAL card positions (so
// they always line up). Mobile: one round at a time with prev/next arrows and a
// "winner goes to M##" hint under each card. Played matches open the same
// match-detail popup used on Fixtures & Results.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { BracketRound, BracketMatch, BracketSlot, FixtureMatch } from '@/lib/engine';
import { SKELETON_ROUNDS, THIRD_PLACE } from '@/lib/bracketSkeleton';
import { Flag } from './Flag';
import { Popup } from './Popup';
import { GameCard } from './GameCard';

const useIsoEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Match number → the match its WINNER advances to (from the fixed skeleton).
const WINNER_TO: Map<number, number> = (() => {
  const map = new Map<number, number>();
  const all = [...SKELETON_ROUNDS.flatMap((r) => r.matches), THIRD_PLACE];
  for (const sm of all) {
    for (const slot of [sm.home, sm.away]) {
      if (slot.kind === 'winnerOf') map.set(slot.match, sm.no);
    }
  }
  return map;
})();

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

export function Bracket({
  rounds,
  thirdPlace,
  fixtures,
}: {
  rounds: BracketRound[];
  thirdPlace: BracketMatch | null;
  fixtures: FixtureMatch[];
}) {
  // Live knockout fixture for each resolved match, by team pair.
  const fixtureByPair = new Map<string, FixtureMatch>();
  for (const f of fixtures) {
    if (f.groupLabel !== null || !f.home.name || !f.away.name) continue; // knockouts only
    fixtureByPair.set(pairKey(f.home.name, f.away.name), f);
  }
  const fixtureFor = (m: BracketMatch): FixtureMatch | null => {
    if (!m.played || !m.home.name || !m.away.name) return null;
    return fixtureByPair.get(pairKey(m.home.name, m.away.name)) ?? null;
  };

  const [popup, setPopup] = useState<FixtureMatch | null>(null);

  // ----- mobile round stepper (main rounds + third place) -----
  const mobileRounds = [
    ...rounds.map((r) => ({ label: r.label, matches: r.matches })),
    ...(thirdPlace ? [{ label: 'Third place', matches: [thirdPlace] }] : []),
  ];
  const firstLive = rounds.findIndex((r) => r.matches.some((m) => !m.played));
  const [sel, setSel] = useState(firstLive === -1 ? 0 : firstLive);
  const clampSel = Math.min(sel, mobileRounds.length - 1);

  // ----- desktop SVG connectors, measured from real card positions -----
  const innerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<number, HTMLDivElement>());
  const setCardRef = useCallback((no: number, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(no, el);
    else cardRefs.current.delete(no);
  }, []);
  const [paths, setPaths] = useState<string[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const compute = useCallback(() => {
    const inner = innerRef.current;
    if (!inner || inner.offsetWidth === 0) {
      setPaths([]);
      return;
    }
    const ir = inner.getBoundingClientRect();
    const rectOf = (no: number) => {
      const el = cardRefs.current.get(no);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: r.left - ir.left,
        right: r.right - ir.left,
        cy: (r.top + r.bottom) / 2 - ir.top,
      };
    };
    const out: string[] = [];
    for (const round of rounds) {
      for (const m of round.matches) {
        const child = rectOf(m.no);
        if (!child) continue;
        for (const feederNo of [m.homeFeeder, m.awayFeeder]) {
          if (feederNo == null) continue;
          const f = rectOf(feederNo);
          if (!f) continue;
          const midX = (f.right + child.left) / 2;
          // elbow: feeder right-edge → midpoint X → child centre Y → child left-edge
          out.push(
            `M ${f.right} ${f.cy} H ${midX} V ${child.cy} H ${child.left}`,
          );
        }
      }
    }
    setSize({ w: inner.scrollWidth, h: inner.scrollHeight });
    setPaths(out);
  }, [rounds]);

  useIsoEffect(() => {
    compute();
    const inner = innerRef.current;
    if (!inner) return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(inner);
    window.addEventListener('resize', compute);
    const t = setTimeout(compute, 120); // after fonts/flags settle
    if (document.fonts?.ready) document.fonts.ready.then(compute).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
      clearTimeout(t);
    };
  }, [compute]);

  return (
    <>
      {/* ===== Desktop: full bracket with measured SVG connectors ===== */}
      <div className="bracket-desktop">
        <div className="bd-inner" ref={innerRef}>
          <svg
            className="bd-svg"
            width={size.w}
            height={size.h}
            viewBox={`0 0 ${size.w} ${size.h}`}
            aria-hidden="true"
          >
            {paths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
          {rounds.map((r) => (
            <div className="bround" key={r.round}>
              <div className="brhead">{r.label}</div>
              <div className="brmatches">
                {r.matches.map((m) => (
                  <MatchCard
                    key={m.no}
                    m={m}
                    fixture={fixtureFor(m)}
                    onOpen={setPopup}
                    cardRef={setCardRef}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {thirdPlace && (
          <div className="bthird">
            <div className="brhead">Third-place playoff</div>
            <MatchCard
              m={thirdPlace}
              fixture={fixtureFor(thirdPlace)}
              onOpen={setPopup}
            />
          </div>
        )}
      </div>

      {/* ===== Mobile: one round at a time with prev/next arrows ===== */}
      <div className="bracket-mobile">
        <div className="bm-head">
          <button
            className="bm-arrow"
            onClick={() => setSel((s) => Math.max(0, s - 1))}
            disabled={clampSel === 0}
            aria-label="Previous round"
          >
            ‹
          </button>
          <span className="bm-round">{mobileRounds[clampSel]?.label}</span>
          <button
            className="bm-arrow"
            onClick={() =>
              setSel((s) => Math.min(mobileRounds.length - 1, s + 1))
            }
            disabled={clampSel === mobileRounds.length - 1}
            aria-label="Next round"
          >
            ›
          </button>
        </div>
        <div className="bm-list">
          {mobileRounds[clampSel]?.matches.map((m) => (
            <MatchCard key={m.no} m={m} fixture={fixtureFor(m)} onOpen={setPopup} hint />
          ))}
        </div>
      </div>

      <Popup
        open={popup !== null}
        onClose={() => setPopup(null)}
        title={
          popup && (
            <span className="pop-fixturetitle">
              {popup.home.name} <span className="pop-vs">v</span> {popup.away.name}
            </span>
          )
        }
      >
        {popup && <GameCard m={popup} standing={null} />}
      </Popup>
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

function MatchCard({
  m,
  fixture,
  onOpen,
  cardRef,
  hint,
}: {
  m: BracketMatch;
  fixture: FixtureMatch | null;
  onOpen: (f: FixtureMatch) => void;
  cardRef?: (no: number, el: HTMLDivElement | null) => void;
  hint?: boolean;
}) {
  const clickable = fixture !== null;
  const dest = WINNER_TO.get(m.no);
  return (
    <div
      className={`bmatch${clickable ? ' clickable' : ''}`}
      ref={cardRef ? (el) => cardRef(m.no, el) : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onOpen(fixture) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen(fixture);
              }
            }
          : undefined
      }
    >
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
      {hint && dest && <div className="bhint">→ Winner to M{dest}</div>}
    </div>
  );
}
