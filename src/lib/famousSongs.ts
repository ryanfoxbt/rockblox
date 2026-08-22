// The curated /songs library's index — metadata only (the actual beat data
// lives in the `songs` table, seeded by scripts/seedSongs.mts). Kept as a
// plain array in code, not a query, so both the Inspiration popover and the
// /songs index page can list titles without a round trip.
export interface FamousSong {
  slug: string;
  title: string;
  artist: string;
}

export const FAMOUS_SONGS: FamousSong[] = [{ slug: "blitzkriegbop", title: "Blitzkrieg Bop", artist: "The Ramones" }];
