import type { ReactNode } from 'react';

export function SiteHeader({
  kicker,
  title,
  sub,
}: {
  kicker: ReactNode;
  title: ReactNode;
  sub: ReactNode;
}) {
  return (
    <header className="hero">
      <span className="kicker">
        <span className="dot" /> {kicker}
      </span>
      <h1 className="title">{title}</h1>
      <p className="sub">{sub}</p>
    </header>
  );
}
