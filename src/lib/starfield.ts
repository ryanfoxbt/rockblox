// Deterministic placement for the Explore starfield: the same board always
// lands in the same spot with the same look, with no server-stored layout.

export const FIELD_WIDTH = 4000;
export const FIELD_HEIGHT = 3000;

// FNV-1a — small, fast, well-spread for short slug strings.
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Star {
  slug: string;
  displayName: string;
  x: number; // px in the virtual field
  y: number;
  radius: number; // px
  hue: number; // 0-360
}

// A star per board. Position from the hash (two independent slices), radius
// from how many slots are filled (an emptier page is a fainter dot), hue from
// another hash slice so neighbours don't all look alike.
export function layoutStar(board: {
  slug: string;
  displayName: string;
  filledSlots: number;
}): Star {
  const h = hashString(board.slug);
  const x = (h % 100000) / 100000 * FIELD_WIDTH;
  const y = ((Math.floor(h / 100000) % 100000) / 100000) * FIELD_HEIGHT;
  const radius = 7 + Math.min(4, Math.max(0, board.filledSlots)) * 5;
  const hue = h % 360;
  return { slug: board.slug, displayName: board.displayName, x, y, radius, hue };
}
