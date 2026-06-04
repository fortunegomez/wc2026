import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { AutoRefresh } from '@/components/AutoRefresh';

export const metadata: Metadata = {
  title: 'World Cup 2026 — Who Wins?',
  description:
    'Live title predictor, fixtures, groups and top scorers for the 2026 World Cup. Updates itself automatically as real results come in.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <Nav />
          {children}
          <footer>
            WORLD CUP 2026 · LIVE TITLE PREDICTOR · BUILT WITH CLAUDE CODE
          </footer>
        </div>
        <AutoRefresh />
      </body>
    </html>
  );
}
