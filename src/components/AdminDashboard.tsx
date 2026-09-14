"use client";

import { useMemo, useState } from "react";
import type { AdminAnalytics, DailyPoint, LessonCompletionRow } from "@/lib/analytics";
import { gradeLabel } from "@/lib/mathSchool";

// Dark-surface-validated categorical hues (see the dataviz palette) — kept
// off yellow since that's this site's own accent color everywhere else, and
// a data series in the same hue as every link/highlight would read as UI
// chrome rather than data.
const SERIES = [
  { key: "boards" as const, label: "Boards created", color: "#3987e5" },
  { key: "songs" as const, label: "Songs saved", color: "#d95926" },
  { key: "mathCompletions" as const, label: "Math questions solved", color: "#199e70" },
];

function formatCompact(n: number): string {
  if (n < 1000) return n.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function niceCeiling(n: number): number {
  if (n <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(n));
  for (const step of [1, 2, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= n) return candidate;
  }
  return 10 * magnitude;
}

function StatTile({ label, value, sublabel }: { label: string; value: number; sublabel?: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-xs font-medium text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-white">{formatCompact(value)}</div>
      {sublabel && <div className="mt-0.5 text-xs text-white/40">{sublabel}</div>}
    </div>
  );
}

function TrendChart({ trend }: { trend: DailyPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const W = 720;
  const H = 220;
  const padLeft = 34;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 24;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;
  const n = trend.length;

  const rawMax = Math.max(1, ...trend.flatMap((p) => [p.boards, p.songs, p.mathCompletions]));
  const max = niceCeiling(rawMax);

  const xAt = (i: number) => padLeft + (n <= 1 ? 0 : (i * plotW) / (n - 1));
  const yAt = (v: number) => padTop + plotH - (v / max) * plotH;

  const paths = SERIES.map((s) => ({
    ...s,
    d: trend.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p[s.key])}`).join(" "),
  }));

  function handleMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    setHoverIndex(Math.min(n - 1, Math.max(0, Math.round(fraction * (n - 1)))));
  }

  const yTicks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const hovered = hoverIndex !== null ? trend[hoverIndex] : null;
  const tooltipLeftPct = hoverIndex !== null ? Math.min(88, Math.max(12, (xAt(hoverIndex) / W) * 100)) : 0;

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white/80">Daily activity — last 30 days</h2>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-semibold text-white/40 underline decoration-dotted underline-offset-2 transition hover:text-yellow-400"
        >
          {showTable ? "Show chart" : "View as table"}
        </button>
      </div>

      {showTable ? (
        <div className="mt-3 max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-white/40">
                <th className="py-1 pr-3 font-medium">Date</th>
                <th className="py-1 pr-3 font-medium">Boards</th>
                <th className="py-1 pr-3 font-medium">Songs</th>
                <th className="py-1 font-medium">Math solved</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((p) => (
                <tr key={p.date} className="border-t border-white/5 text-white/70">
                  <td className="py-1 pr-3">{formatDay(p.date)}</td>
                  <td className="py-1 pr-3 tabular-nums">{p.boards}</td>
                  <td className="py-1 pr-3 tabular-nums">{p.songs}</td>
                  <td className="py-1 tabular-nums">{p.mathCompletions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily activity over the last 30 days">
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={padLeft} x2={W - padRight} y1={yAt(t)} y2={yAt(t)} stroke="#2c2c2a" strokeWidth={1} />
                <text x={padLeft - 6} y={yAt(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#898781">
                  {t}
                </text>
              </g>
            ))}
            {n > 0 && (
              <>
                <text x={xAt(0)} y={H - 6} textAnchor="start" fontSize={10} fill="#898781">
                  {formatDay(trend[0].date)}
                </text>
                <text x={xAt(n - 1)} y={H - 6} textAnchor="end" fontSize={10} fill="#898781">
                  {formatDay(trend[n - 1].date)}
                </text>
              </>
            )}
            {paths.map((s) => (
              <path key={s.key} d={s.d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {hoverIndex !== null && (
              <line
                x1={xAt(hoverIndex)}
                x2={xAt(hoverIndex)}
                y1={padTop}
                y2={padTop + plotH}
                stroke="#c3c2b7"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            )}
            {hovered &&
              paths.map((s) => (
                <circle key={s.key} cx={xAt(hoverIndex!)} cy={yAt(hovered[s.key])} r={4} fill={s.color} stroke="#0b1220" strokeWidth={2} />
              ))}
            <rect
              x={padLeft}
              y={padTop}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={handleMove}
              onPointerLeave={() => setHoverIndex(null)}
            />
          </svg>

          {hovered && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-xs shadow-lg"
              style={{ left: `${tooltipLeftPct}%` }}
            >
              <div className="font-semibold text-white/80">{formatDay(hovered.date)}</div>
              {SERIES.map((s) => (
                <div key={s.key} className="mt-1 flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="font-semibold tabular-nums text-white">{hovered[s.key]}</span>
                  <span className="whitespace-nowrap text-white/50">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-white/60">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// One grade's worth of RockBlocks Math lessons, in curriculum order, as a
// completions-per-lesson bar chart — a funnel across the sequence rather
// than a single grade-level total, since that's what actually shows where
// kids stop progressing partway through a curriculum.
function LessonFunnel({ grade, lessons }: { grade: number; lessons: LessonCompletionRow[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const max = Math.max(1, ...lessons.map((l) => l.completions));
  const barW = 22;
  const gap = 6;
  const H = 180;
  const padTop = 12;
  const padBottom = 22;
  const plotH = H - padTop - padBottom;
  const W = lessons.length * (barW + gap) + gap;
  const hovered = hoverIdx !== null ? lessons[hoverIdx] : null;

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-semibold text-white/80">{gradeLabel(grade)}: question completions by lesson</h2>
      <p className="mt-1 text-xs text-white/40">
        Each lesson has 4 questions (slots A–D). A steep drop partway through the sequence usually marks where kids
        give up.
      </p>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-full" role="img" aria-label={`Question completions per ${gradeLabel(grade)} lesson`}>
          {lessons.map((l, i) => {
            const barH = l.completions === 0 ? 0 : Math.max(2, (l.completions / max) * plotH);
            const x = gap + i * (barW + gap);
            const y = padTop + plotH - barH;
            const active = hoverIdx === i;
            return (
              <g key={l.slug}>
                <rect x={x} y={y} width={barW} height={barH} rx={4} fill={active ? "#5598e7" : "#3987e5"} />
                <rect
                  x={x}
                  y={padTop}
                  width={barW}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setHoverIdx(i)}
                  onPointerLeave={() => setHoverIdx(null)}
                />
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#898781">
                  {l.lessonNumber}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 min-h-[2.5rem] rounded-md border border-white/10 bg-slate-900 px-3 py-2 text-xs">
        {hovered ? (
          <>
            <div className="font-semibold text-white">
              Lesson {hovered.lessonNumber}: {hovered.title}
            </div>
            <div className="mt-1 text-white/60">
              <span className="font-semibold tabular-nums text-white">{hovered.completions}</span> questions solved by{" "}
              <span className="font-semibold tabular-nums text-white">{hovered.learners}</span> learner
              {hovered.learners === 1 ? "" : "s"}
            </div>
          </>
        ) : (
          <span className="text-white/30">Hover a bar for lesson detail.</span>
        )}
      </div>
    </div>
  );
}

function ModerationList({
  title,
  emptyLabel,
  items,
}: {
  title: string;
  emptyLabel: string;
  items: { key: string; message: string; meta: string }[];
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-4">
      <h2 className="text-sm font-semibold text-white/80">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-white/40">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 max-h-72 overflow-y-auto">
          {items.map((item) => (
            <li key={item.key} className="border-t border-white/5 py-2 first:border-t-0">
              <p className="break-words text-sm text-white/80">{item.message}</p>
              <p className="mt-0.5 truncate text-xs text-white/40">{item.meta}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminDashboard({ data }: { data: AdminAnalytics }) {
  const { kpis, trend, lessonCompletions, recentComplaints, recentWallMessages } = data;

  const gradeGroups = useMemo(() => {
    const map = new Map<number, LessonCompletionRow[]>();
    for (const lesson of lessonCompletions) {
      const group = map.get(lesson.grade) ?? [];
      group.push(lesson);
      map.set(lesson.grade, group);
    }
    return [...map.entries()];
  }, [lessonCompletions]);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label="Active right now"
          value={kpis.activeVisitorsNow}
          sublabel={`across ${kpis.activeBoardsNow} board${kpis.activeBoardsNow === 1 ? "" : "s"}`}
        />
        <StatTile label="Boards" value={kpis.totalBoards} sublabel={`+${kpis.boardsLast30} in last 30d`} />
        <StatTile label="Saved songs" value={kpis.totalUserSongs} sublabel={`+${kpis.songsLast30} in last 30d`} />
        <StatTile
          label="Math questions solved"
          value={kpis.totalMathCompletions}
          sublabel={`+${kpis.mathCompletionsLast30} in last 30d`}
        />
        <StatTile label="Math learners" value={kpis.distinctMathLearners} sublabel="signed-in accounts with progress" />
        <StatTile label="Wall messages" value={kpis.totalWallMessages} sublabel={`+${kpis.wallMessagesLast30} in last 30d`} />
        <StatTile label="Complaints" value={kpis.totalComplaints} sublabel={`+${kpis.complaintsLast30} in last 30d`} />
      </div>

      <TrendChart trend={trend} />

      {gradeGroups.map(([grade, lessons]) => (
        <LessonFunnel key={grade} grade={grade} lessons={lessons} />
      ))}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ModerationList
          title="Recent complaints"
          emptyLabel="No complaints yet."
          items={recentComplaints.map((c) => ({
            key: String(c.id),
            message: c.message,
            meta: `${c.url} · ${new Date(c.createdAt).toLocaleString()}`,
          }))}
        />
        <ModerationList
          title="Recent wall messages"
          emptyLabel="No wall messages yet."
          items={recentWallMessages.map((w) => ({
            key: String(w.id),
            message: w.message,
            meta: `/${w.boardSlug} · ${new Date(w.createdAt).toLocaleString()}`,
          }))}
        />
      </div>
    </div>
  );
}
