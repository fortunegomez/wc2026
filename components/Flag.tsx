// Renders a team flag. Prefers our flagcdn flag (keyed to the seed list's
// country code); falls back to the API crest, then to an empty placeholder.

export function Flag({
  cc,
  crest,
  alt,
}: {
  cc?: string | null;
  crest?: string | null;
  alt: string;
}) {
  const src = cc ? `https://flagcdn.com/w40/${cc}.png` : crest || null;
  if (!src) return <span className="flag" aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="flag" src={src} alt={alt} loading="lazy" />;
}
