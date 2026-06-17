import { getDb } from "../db/client.js";
import type { Trend } from "../types.js";

interface GetTrendsParams {
  limit: number;
  type: "horse" | "cuadra" | "phrase" | "event" | "all";
  days: number;
}

export function getTrends({ limit, type, days }: GetTrendsParams): {
  trends: Trend[];
  updated_at: string;
  summary: string;
} {
  const db = getDb();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const rows = db
    .prepare(
      `SELECT * FROM trends
       WHERE last_seen >= ?
         AND (? = 'all' OR type = ?)
       ORDER BY score DESC
       LIMIT ?`
    )
    .all(since, type, type, limit) as Trend[];

  const topNames = rows
    .slice(0, 3)
    .map((r) => r.topic)
    .join(", ");

  return {
    trends: rows,
    updated_at: new Date().toISOString(),
    summary:
      rows.length > 0
        ? `Top ${rows.length} trends (last ${days}d): ${topNames}`
        : `No trends found in the last ${days} days. Seed data by running the Facebook Hunter or drop manual trends.`,
  };
}

export function upsertTrend(
  topic: string,
  type: Trend["type"],
  mentions: number,
  growth_pct: number,
  sentiment: Trend["sentiment"] = "neutral"
): Trend {
  const db = getDb();
  const score = calcScore(mentions, growth_pct, sentiment);

  db.prepare(
    `INSERT INTO trends (topic, type, score, mentions, growth_pct, sentiment, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(topic) DO UPDATE SET
       score       = excluded.score,
       mentions    = excluded.mentions,
       growth_pct  = excluded.growth_pct,
       sentiment   = excluded.sentiment,
       last_seen   = excluded.last_seen`
  ).run(topic, type, score, mentions, growth_pct, sentiment);

  return db
    .prepare("SELECT * FROM trends WHERE topic = ?")
    .get(topic) as Trend;
}

function calcScore(
  mentions: number,
  growth_pct: number,
  sentiment: Trend["sentiment"]
): number {
  const sentimentBonus = sentiment === "hype" ? 1.4 : sentiment === "positive" ? 1.1 : 1.0;
  return Math.round(mentions * sentimentBonus * (1 + growth_pct / 100));
}
