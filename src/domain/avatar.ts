/**
 * Player avatar helpers: any emoji can be a player's avatar; the first letter of the name is the fallback.
 */

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** First user-perceived character (grapheme) of a string. */
function firstGrapheme(value: string): string {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    for (const part of new Seg(undefined, { granularity: 'grapheme' }).segment(value)) return part.segment;
    return '';
  }
  return Array.from(value)[0] || '';
}

/** Returns a single valid emoji, or null when the value is empty or not an emoji. */
export function sanitizeAvatarEmoji(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const g = firstGrapheme(trimmed);
  if (!g || g.length > 32 || !EMOJI_RE.test(g)) return null;
  return g;
}

/** What to draw inside a player's avatar circle: their emoji, else the first letter of their name. */
export function avatarLabel(p: { avatarEmoji?: string | null; displayName?: string | null } | null | undefined): string {
  if (p?.avatarEmoji) return p.avatarEmoji;
  return (p?.displayName || 'P').trim().charAt(0).toUpperCase() || 'P';
}

/** Every single-code-point emoji with default emoji presentation (≈1,100), for the picker grid. */
export function listPickerEmojis(): string[] {
  const out: string[] = [];
  const re = /^\p{Emoji_Presentation}$/u;
  const ranges: Array<[number, number]> = [
    [0x1f600, 0x1f64f], // smileys & people
    [0x1f90c, 0x1f9ff], // supplemental symbols & pictographs
    [0x1f466, 0x1f4ff], // people, animals, objects
    [0x1f300, 0x1f465], // nature, food, places
    [0x1f680, 0x1f6ff], // transport & map
    [0x1fa70, 0x1faff], // extended pictographs
    [0x2600, 0x27bf], // misc symbols & dingbats
    [0x1f004, 0x1f251], // games & enclosed
  ];
  const seen = new Set<string>();
  for (const [a, b] of ranges) {
    for (let cp = a; cp <= b; cp++) {
      const ch = String.fromCodePoint(cp);
      if (re.test(ch) && !seen.has(ch)) {
        seen.add(ch);
        out.push(ch);
      }
    }
  }
  return out;
}
