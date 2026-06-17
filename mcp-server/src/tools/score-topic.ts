import { getDb } from "../db/client.js";
import type { Trend } from "../types.js";

interface ScoreResult {
  topic: string;
  score: number;
  grade: "S" | "A" | "B" | "C" | "D";
  breakdown: {
    mentions: number;
    growth_pct: number;
    sentiment: string;
    recency_bonus: number;
  };
  recommendation: string;
  existing: boolean;
}

export function scoreTopic(topic: string): ScoreResult {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM trends WHERE topic = ? COLLATE NOCASE")
    .get(topic) as Trend | undefined;

  if (!row) {
    return {
      topic,
      score: 0,
      grade: "D",
      breakdown: { mentions: 0, growth_pct: 0, sentiment: "unknown", recency_bonus: 0 },
      recommendation: `"${topic}" not in the trend DB yet. If you've seen this name heating up in groups, drop it manually with upsert or run the hunter.`,
      existing: false,
    };
  }

  const hoursSinceSeen =
    (Date.now() - new Date(row.last_seen).getTime()) / 3_600_000;
  const recency_bonus = hoursSinceSeen < 24 ? 20 : hoursSinceSeen < 72 ? 10 : 0;
  const finalScore = row.score + recency_bonus;

  const grade =
    finalScore >= 500 ? "S" :
    finalScore >= 300 ? "A" :
    finalScore >= 150 ? "B" :
    finalScore >= 50  ? "C" : "D";

  const recs: Record<string, string> = {
    S: `HOT — make this now. Multiple products (shirt + hoodie + hat). Ride it hard.`,
    A: `Strong — at least 2 product types. Use bold_emblem or distressed_racing style.`,
    B: `Solid — one shirt, test the market. Vintage_western style tends to work here.`,
    C: `Emerging — worth a single design but don't over-invest yet. Watch for growth.`,
    D: `Too early or fading — hold off. Re-check in 48h.`,
  };

  return {
    topic: row.topic,
    score: finalScore,
    grade,
    breakdown: {
      mentions: row.mentions,
      growth_pct: row.growth_pct,
      sentiment: row.sentiment,
      recency_bonus,
    },
    recommendation: recs[grade],
    existing: true,
  };
}
