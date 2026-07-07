'use client';

// The tournament bracket. Columns of match cards with an SVG overlay whose
// elbow connectors are measured from the ACTUAL card positions, so they always
// line up. Desktop shows the full bracket; mobile shows a 2-column slice — the
// selected round plus the next round, connected — with prev/next arrows.
// Played matches open the same match-detail popup used on Fixtures & Results.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  BracketRound,
  BracketMatch,
  BracketSlot,
  FixtureMatch,
} from '@/lib/engine';
import { Flag } from './Flag';
import { Popup } from './Popup';
import { GameCard } from './GameCard';

const useIsoEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

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

  // Mobile steps: each round paired with the next (a 2-column slice), then the
  // third-place match on its own as the final step.
  const steps = useMemo(() => {
    const s = rounds.map((r, i) => ({
      label: r.label,
      slice: [rounds[i], rounds[i + 1]].filter(Boolean) as BracketRound[],
    }));
    if (thirdPlace) {
      s.push({
        label: 'Third place',
        slice: [
          {
            round: '3P' as BracketRound['round'],
            label: 'Third-place playoff',
            short: '3rd',
            matches: [thirdPlace],
          },
        ],
      });
    }
    return s;
  }, [rounds, thirdPlace]);

  const firstLive = rounds.findIndex((r) => r.matches.some((m) => !m.played));
  const [sel, setSel] = useState(firstLive === -1 ? 0 : firstLive);
  const clampSel = Math.min(Math.max(sel, 0), steps.length - 1);

  return (
    <>
      {/* ===== Desktop: full bracket ===== */}
      <div className="bracket-desktop">
        <BracketColumns rounds={rounds} fixtureFor={fixtureFor} onOpen={setPopup} />
        {thirdPlace && (
          <div className="bthird">
            <div className="brhead">Third-place playoff</div>
            <MatchCard
              m={thirdPlace}
              fixture={fixtureFor(thirdPlace)}
              onOpen={setPopup}
              cardRef={noopRef}
            />
          </div>
        )}
      </div>

      {/* ===== Mobile: selected round + next round, connected ===== */}
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
          <span className="bm-round">{steps[clampSel]?.label}</span>
          <button
            className="bm-arrow"
            onClick={() => setSel((s) => Math.min(steps.length - 1, s + 1))}
            disabled={clampSel === steps.length - 1}
            aria-label="Next round"
          >
            ›
          </button>
        </div>
        <div className="bm-scroll">
          <BracketColumns
            key={clampSel}
            rounds={steps[clampSel]?.slice ?? []}
            fixtureFor={fixtureFor}
            onOpen={setPopup}
          />
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

const noopRef = () => {};

// Renders a set of round columns with an SVG connector overlay whose paths are
// measured from the real card rects. A connector is only drawn when both a
// child and its feeder card are present, so a 2-column slice draws just the
// next-round → current-round elbows.
function BracketColumns({
  rounds,
  fixtureFor,
  onOpen,
}: {
  rounds: BracketRound[];
  fixtureFor: (m: BracketMatch) => FixtureMatch | null;
  onOpen: (f: FixtureMatch) => void;
}) {
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
                onOpen={onOpen}
                cardRef={setCardRef}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
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
}: {
  m: BracketMatch;
  fixture: FixtureMatch | null;
  onOpen: (f: FixtureMatch) => void;
  cardRef: (no: number, el: HTMLDivElement | null) => void;
}) {
  const clickable = fixture !== null;
  return (
    <div
      className={`bmatch${clickable ? ' clickable' : ''}`}
      ref={(el) => cardRef(m.no, el)}
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
    </div>
  );
}
