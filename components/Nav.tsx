'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'The Race' },
  // scroll:false lets the Fixtures page control its own scroll position (it
  // jumps to the latest results) instead of Next resetting to the top.
  { href: '/fixtures', label: 'Fixtures & Results', scroll: false },
  { href: '/groups', label: 'Groups' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/scorers', label: 'Top Scorers' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        WC<span className="em">26</span>
      </Link>
      {TABS.map((t) => {
        const active =
          t.href === '/' ? path === '/' : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            scroll={t.scroll ?? true}
            className={`navlink${active ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
