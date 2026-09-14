import "server-only";

import { asc, count, countDistinct, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { boards, complaints, mathLessons, mathProgress, userSongs, wallMessages } from "@/db/schema";
import { getActivity } from "@/lib/activity";

const TREND_DAYS = 30;

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  boards: number;
  songs: number;
  mathCompletions: number;
}

export interface LessonCompletionRow {
  slug: string;
  lessonNumber: number;
  title: string;
  grade: number;
  completions: number;
  learners: number;
}

export interface AdminAnalytics {
  kpis: {
    totalBoards: number;
    boardsLast30: number;
    totalUserSongs: number;
    songsLast30: number;
    totalMathCompletions: number;
    mathCompletionsLast30: number;
    distinctMathLearners: number;
    totalWallMessages: number;
    wallMessagesLast30: number;
    totalComplaints: number;
    complaintsLast30: number;
    activeVisitorsNow: number;
    activeBoardsNow: number;
  };
  trend: DailyPoint[];
  lessonCompletions: LessonCompletionRow[];
  recentComplaints: { id: number; message: string; url: string; createdAt: string }[];
  recentWallMessages: { id: number; boardSlug: string; message: string; createdAt: string }[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The last TREND_DAYS calendar days (UTC), oldest first, as an array of
// zero-filled buckets — so a day with no activity still shows as 0 rather
// than being absent from the chart.
function emptyTrend(): Map<string, DailyPoint> {
  const map = new Map<string, DailyPoint>();
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = dayKey(d);
    map.set(date, { date, boards: 0, songs: 0, mathCompletions: 0 });
  }
  return map;
}

// RockBlox's product analytics, built directly from real usage already
// recorded in the database — boards/songs created, RockBlocks Math
// completions, community activity — rather than a separate event-tracking
// pipeline. Everything here is aggregate/staff-facing; callers gate access
// (see requireAdmin).
export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (TREND_DAYS - 1));
  cutoff.setUTCHours(0, 0, 0, 0);

  const [
    totalBoardsResult,
    totalUserSongsResult,
    totalMathCompletionsResult,
    distinctMathLearnersResult,
    totalWallMessagesResult,
    totalComplaintsResult,
    boardsByDay,
    songsByDay,
    mathByDay,
    wallMessagesLast30Result,
    complaintsLast30Result,
    lessonRows,
    recentComplaintsRows,
    recentWallRows,
    activity,
  ] = await Promise.all([
    db.select({ n: count() }).from(boards),
    db.select({ n: count() }).from(userSongs),
    db.select({ n: count() }).from(mathProgress),
    db.select({ n: countDistinct(mathProgress.ownerId) }).from(mathProgress),
    db.select({ n: count() }).from(wallMessages),
    db.select({ n: count() }).from(complaints),
    db
      .select({ day: sql<string>`to_char(${boards.createdAt} at time zone 'utc', 'YYYY-MM-DD')`, n: count() })
      .from(boards)
      .where(gte(boards.createdAt, cutoff))
      .groupBy(sql`1`),
    db
      .select({ day: sql<string>`to_char(${userSongs.createdAt} at time zone 'utc', 'YYYY-MM-DD')`, n: count() })
      .from(userSongs)
      .where(gte(userSongs.createdAt, cutoff))
      .groupBy(sql`1`),
    db
      .select({ day: sql<string>`to_char(${mathProgress.solvedAt} at time zone 'utc', 'YYYY-MM-DD')`, n: count() })
      .from(mathProgress)
      .where(gte(mathProgress.solvedAt, cutoff))
      .groupBy(sql`1`),
    db.select({ n: count() }).from(wallMessages).where(gte(wallMessages.createdAt, cutoff)),
    db.select({ n: count() }).from(complaints).where(gte(complaints.createdAt, cutoff)),
    db
      .select({
        slug: mathLessons.slug,
        lessonNumber: mathLessons.lessonNumber,
        title: mathLessons.title,
        grade: mathLessons.grade,
        completions: count(mathProgress.id),
        learners: countDistinct(mathProgress.ownerId),
      })
      .from(mathLessons)
      .leftJoin(mathProgress, eq(mathProgress.lessonSlug, mathLessons.slug))
      .where(eq(mathLessons.isPublished, true))
      .groupBy(mathLessons.id)
      .orderBy(asc(mathLessons.grade), asc(mathLessons.lessonNumber)),
    db
      .select({ id: complaints.id, message: complaints.message, url: complaints.url, createdAt: complaints.createdAt })
      .from(complaints)
      .orderBy(desc(complaints.createdAt))
      .limit(15),
    db
      .select({
        id: wallMessages.id,
        boardSlug: wallMessages.boardSlug,
        message: wallMessages.message,
        createdAt: wallMessages.createdAt,
      })
      .from(wallMessages)
      .orderBy(desc(wallMessages.createdAt))
      .limit(15),
    getActivity(),
  ]);

  const trendMap = emptyTrend();
  for (const row of boardsByDay) {
    const bucket = trendMap.get(row.day);
    if (bucket) bucket.boards = row.n;
  }
  for (const row of songsByDay) {
    const bucket = trendMap.get(row.day);
    if (bucket) bucket.songs = row.n;
  }
  for (const row of mathByDay) {
    const bucket = trendMap.get(row.day);
    if (bucket) bucket.mathCompletions = row.n;
  }
  const trend = [...trendMap.values()];
  const sum = (pick: (p: DailyPoint) => number) => trend.reduce((acc, p) => acc + pick(p), 0);

  return {
    kpis: {
      totalBoards: totalBoardsResult[0].n,
      boardsLast30: sum((p) => p.boards),
      totalUserSongs: totalUserSongsResult[0].n,
      songsLast30: sum((p) => p.songs),
      totalMathCompletions: totalMathCompletionsResult[0].n,
      mathCompletionsLast30: sum((p) => p.mathCompletions),
      distinctMathLearners: distinctMathLearnersResult[0].n,
      totalWallMessages: totalWallMessagesResult[0].n,
      wallMessagesLast30: wallMessagesLast30Result[0].n,
      totalComplaints: totalComplaintsResult[0].n,
      complaintsLast30: complaintsLast30Result[0].n,
      activeVisitorsNow: activity.totals.activeVisitors,
      activeBoardsNow: activity.totals.activeBoards,
    },
    trend,
    lessonCompletions: lessonRows,
    recentComplaints: recentComplaintsRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    recentWallMessages: recentWallRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}
