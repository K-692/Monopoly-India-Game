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

/** Inline style for an avatar circle: the player's colour only when there is no emoji (emoji avatars have no background). */
export function avatarBg(
  p: { avatarEmoji?: string | null } | null | undefined,
  color: string | undefined
): Record<string, string> {
  return p?.avatarEmoji ? {} : { backgroundColor: color || '#C85A32' };
}

/** Extra classes for an emoji avatar: no background, border or shadow, and a larger emoji. */
export function emojiAvatarClass(p: { avatarEmoji?: string | null } | null | undefined, sizeClass: string): string {
  // Important modifiers so no border, ring, glow or background from the circle style can survive
  return p?.avatarEmoji ? `!bg-transparent !border-0 !shadow-none !ring-0 ${sizeClass} leading-none` : '';
}
