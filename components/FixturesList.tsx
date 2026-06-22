'use client';

// Fixtures & Results, made clickable. Sections come pre-ordered from the engine
// (recently finished → today → upcoming). Each match opens a popup with the
// score/kick-off, stage/group, and — for group games — the live group table.
// No squads or lineups: those need a paid data plan, so we show what the free
// tier provides.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FixtureSection, FixtureMatch, GroupRow } from '@/lib/engine';
import { Flag } from './Flag';
import { Popup } from './Popup';

// useLayoutEffect on the client (scroll before paint), useEffect on the server
// (avoids the SSR warning).
const useIsoEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function FixturesList({
  sections,
  standingsByGroup,
}: {
  sections: FixtureSection[];
  standingsByGroup: Record<string, GroupRow[]>;
}) {
  const [selected, setSelected] = useState<FixtureMatch | null>(null);
  const standing =
    selected && selected.groupLabel
      ? standingsByGroup[selected.groupLabel] ?? null
      : null;

  // On load, jump to the most recent results day (the last day of the finished
  // block) so the newest results are at the top and the next fixtures sit just
  // below. Earlier games are above — scroll up to see them. Runs once.
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const finishedSection = sections.find((s) => s.key === 'finished');
  const finishedDays = finishedSection?.days ?? [];
  const anchorDate =
    finishedDays.length > 0 ? finishedDays[finishedDays.length - 1].date : null;

  useIsoEffect(() => {
    if (!anchorRef.current) return;
    // Land the latest-results day just below the sticky nav. We scroll
    // immediately and again on the next two frames, because Next.js can reset
    // scroll to the top after a client-side navigation — the deferred passes
    // win that race.
    const doScroll = () => {
      const el = anchorRef.current;
      if (!el) return;
      const nav = document.querySelector('.nav');
      const navH = nav ? nav.getBoundingClientRect().height : 0;
      const y = el.getBoundingClientRect().top + window.scrollY - navH - 14;
      window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
    };
    let raf2 = 0;
    doScroll();
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(doScroll);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {sections.map((section) => (
        <div className="fx-section" key={section.key}>
          <div className="section-head">{section.label}</div>
          {section.days.map((day) => (
            <div
              key={day.date}
              ref={
                section.key === 'finished' && day.date === anchorDate
                  ? anchorRef
                  : undefined
              }
            >
              <div className="dayhead">{day.label}</div>
              {day.matches.map((m) => (
                <div
                  className="match clickable"
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(m)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(m);
                    }
                  }}
                >
                  <div className="side home">
                    <Flag cc={m.home.cc} crest={m.home.crest} alt={m.home.name} />
                    <span className="name">{m.home.name}</span>
                  </div>
                  <div className="center">
                    {m.finished || m.live ? (
                      <div className="scoreline">
                        {m.homeGoals ?? 0}–{m.awayGoals ?? 0}
                      </div>
                    ) : (
                      <div className="vs">{m.time}</div>
                    )}
                    <div
                      className={`tag${
                        m.live ? ' live' : m.finished ? ' ft' : ''
                      }`}
                    >
                      {m.live
                        ? 'Live'
                        : m.finished
                          ? 'Full time'
                          : m.groupLabel
                            ? `Group ${m.groupLabel}`
                            : m.stageLabel}
                    </div>
                  </div>
                  <div className="side away">
                    <Flag cc={m.away.cc} crest={m.away.crest} alt={m.away.name} />
                    <span className="name">{m.away.name}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      <Popup
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected && (
            <span className="pop-fixturetitle">
              {selected.home.name} <span className="pop-vs">v</span>{' '}
              {selected.away.name}
            </span>
          )
        }
      >
        {selected && <GameCard m={selected} standing={standing} />}
      </Popup>
    </>
  );
}

function GameCard({
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
          <div
            className={`tag${m.live ? ' live' : m.finished ? ' ft' : ''}`}
          >
            {m.live ? 'Live' : m.finished ? 'Full time' : 'Kick-off (WAT)'}
          </div>
        </div>
        <div className="ps-team">
          <Flag cc={m.away.cc} crest={m.away.crest} alt={m.away.name} />
          <span>{m.away.name}</span>
        </div>
      </div>

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
