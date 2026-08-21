export type Article = {
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
  score: number;
  label: "positive" | "neutral" | "negative";
};

const POS = [
  "beat",
  "beats",
  "surge",
  "surges",
  "rally",
  "record",
  "upgrade",
  "upgraded",
  "growth",
  "strong",
  "profit",
  "outperform",
  "bullish",
  "expands",
  "wins",
  "raises",
  "optimistic",
  "breakthrough",
  "demand",
  "momentum",
];
const NEG = [
  "miss",
  "misses",
  "plunge",
  "plunges",
  "slump",
  "downgrade",
  "downgraded",
  "lawsuit",
  "probe",
  "weak",
  "loss",
  "losses",
  "recall",
  "bearish",
  "cuts",
  "warns",
  "layoffs",
  "decline",
  "selloff",
  "risk",
];

/** Lexicon sentiment scorer (FinBERT stand-in for the browser/edge runtime). */
export function scoreText(text: string): { score: number; label: Article["label"] } {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  let hits = 0;
  let raw = 0;
  for (const w of words) {
    if (POS.includes(w)) {
      raw += 1;
      hits += 1;
    } else if (NEG.includes(w)) {
      raw -= 1;
      hits += 1;
    }
  }
  const score = hits === 0 ? 0 : Math.max(-1, Math.min(1, raw / Math.sqrt(hits) / 1.5));
  const label = score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral";
  return { score: Number(score.toFixed(4)), label };
}

/** Deterministic pseudo-random generator so mock news is stable per symbol/day. */
function hash(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEMPLATES = [
  "{S} beats quarterly estimates as demand shows strong momentum",
  "Analysts upgrade {S} on record services growth",
  "{S} shares rally after bullish guidance raises targets",
  "{S} misses revenue expectations, shares decline in selloff",
  "Regulatory probe weighs on {S} amid lawsuit risk",
  "{S} announces layoffs and cuts spending outlook",
  "{S} holds steady as investors await the next earnings report",
  "Supply chain update from {S} keeps forecasts unchanged",
  "{S} expands product lineup in a breakthrough for its core market",
  "Weak sector data drags {S} lower in early trading",
];
const SOURCES = ["Market Wire", "Finance Daily", "The Ticker", "Global Business", "Street Notes"];

export function generateNews(symbol: string, days: number, perDay = 3): Article[] {
  const rand = hash(symbol);
  const out: Article[] = [];
  const today = new Date();
  for (let d = 0; d < days; d++) {
    const day = new Date(today.getTime() - d * 86400000);
    for (let i = 0; i < perDay; i++) {
      const t = TEMPLATES[Math.floor(rand() * TEMPLATES.length)] as string;
      const title = t.replaceAll("{S}", symbol);
      const { score, label } = scoreText(title);
      out.push({
        title,
        source: SOURCES[Math.floor(rand() * SOURCES.length)] as string,
        publishedAt: day.toISOString(),
        score,
        label,
      });
    }
  }
  return out;
}

export type DailySentiment = { date: string; mean: number; count: number };

export function dailySentiment(articles: Article[]): DailySentiment[] {
  const map = new Map<string, number[]>();
  for (const a of articles) {
    const key = a.publishedAt.slice(0, 10);
    map.set(key, [...(map.get(key) ?? []), a.score]);
  }
  return [...map.entries()]
    .map(([date, xs]) => ({
      date,
      mean: Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(4)),
      count: xs.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
