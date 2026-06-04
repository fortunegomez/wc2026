'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'The Race' },
  { href: '/fixtures', label: 'Fixtures & Results' },
  { href: '/groups', label: 'Groups' },
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
            className={`navlink${active ? ' active' : ''}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
