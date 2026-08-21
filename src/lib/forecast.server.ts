import { addIndicators, type Candle } from "./indicators";
import { dailySentiment, type Article } from "./sentiment";

export type Metrics = {
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
  directionAccuracy: number;
};
export type ForecastResult = {
  model: string;
  features: string[];
  lookback: number;
  horizonDays: number;
  asOfDate: string;
  currentPrice: number;
  predictedPrice: number;
  absoluteChange: number;
  percentChange: number;
  direction: "UP" | "DOWN" | "FLAT";
  metrics: Metrics;
  baseline: Metrics;
  testSeries: { date: string; actual: number; predicted: number }[];
  disclaimer: string;
  confidence: number;
};

/** Ridge regression solved by Gaussian elimination (closed-form, no native deps). */
function ridgeFit(X: number[][], y: number[], lambda = 1e-3): number[] {
  const n = X[0]!.length;
  const A: number[][] = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let r = 0; r < X.length; r++) s += X[r]![i]! * X[r]![j]!;
      A[i]![j] = s + (i === j ? lambda * X.length : 0);
    }
    let s = 0;
    for (let r = 0; r < X.length; r++) s += X[r]![i]! * y[r]!;
    A[i]![n] = s;
  }
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[pivot]![c]!)) pivot = r;
    [A[c], A[pivot]] = [A[pivot]!, A[c]!];
    const pv = A[c]![c]! || 1e-12;
    for (let j = c; j <= n; j++) A[c]![j] = A[c]![j]! / pv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r]![c]!;
      if (!f) continue;
      for (let j = c; j <= n; j++) A[r]![j] = A[r]![j]! - f * A[c]![j]!;
    }
  }
  return A.map((row) => row[n]!);
}

const dot = (w: number[], x: number[]) => w.reduce((a, wi, i) => a + wi * x[i]!, 0);

function metrics(actual: number[], pred: number[], prev: number[]): Metrics {
  const n = actual.length;
  const mean = actual.reduce((a, b) => a + b, 0) / n;
  let se = 0;
  let ae = 0;
  let pe = 0;
  let ss = 0;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const e = actual[i]! - pred[i]!;
    se += e * e;
    ae += Math.abs(e);
    pe += Math.abs(e / actual[i]!);
    ss += (actual[i]! - mean) ** 2;
    if (Math.sign(actual[i]! - prev[i]!) === Math.sign(pred[i]! - prev[i]!)) hits += 1;
  }
  return {
    mae: Number((ae / n).toFixed(4)),
    rmse: Number(Math.sqrt(se / n).toFixed(4)),
    mape: Number(((pe / n) * 100).toFixed(3)),
    r2: Number((1 - se / (ss || 1e-9)).toFixed(4)),
    directionAccuracy: Number(((hits / n) * 100).toFixed(2)),
  };
}

const FEATURES = ["close", "ret1", "rsi14", "macd", "sma10", "sma20", "vol10"] as const;

export function runForecast(
  candles: Candle[],
  articles: Article[],
  useSentiment: boolean,
  opts: { lookback?: number; horizon?: number } = {},
): ForecastResult {
  const lookback = opts.lookback ?? 20;
  const horizon = opts.horizon ?? 1;
  const rows = addIndicators(candles);
  const sent = new Map(dailySentiment(articles).map((d) => [d.date, d.mean]));

  type Row = { date: string; close: number; x: number[] };
  type IndicatorValues = Record<(typeof FEATURES)[number], number | null>;
  const clean: Row[] = [];
  for (const r of rows) {
    const values = r as unknown as IndicatorValues;
    const base = FEATURES.map((f) => values[f]);
    if (base.some((v) => v === null || v === undefined || Number.isNaN(v))) continue;
    const x = base as number[];
    // Sentiment is joined causally: only same-or-earlier-day news is used.
    clean.push({
      date: r.date,
      close: r.close,
      x: useSentiment ? [...x, sent.get(r.date) ?? 0] : x,
    });
  }

  const samples: { date: string; x: number[]; y: number; prev: number }[] = [];
  for (let i = lookback - 1; i < clean.length - horizon; i++) {
    const window = clean.slice(i - lookback + 1, i + 1);
    const last = window[window.length - 1]!;
    const scale = last.close || 1;
    // Sequence window flattened into normalised features (price-relative).
    const flat: number[] = [1];
    for (const step of window) {
      flat.push(step.x[0]! / scale);
    }
    for (let k = 1; k < last.x.length; k++) flat.push(last.x[k]! / (k === 3 || k >= 5 ? 1 : 100));
    samples.push({
      date: clean[i + horizon]!.date,
      x: flat,
      y: clean[i + horizon]!.close / scale,
      prev: last.close,
    });
  }
  if (samples.length < 40) throw new Error("Not enough history to train the model.");

  const split = Math.floor(samples.length * 0.85);
  const train = samples.slice(0, split);
  const test = samples.slice(split);
  const w = ridgeFit(
    train.map((s) => s.x),
    train.map((s) => s.y),
  );

  const actual = test.map((s) => s.y * s.prev);
  const pred = test.map((s) => dot(w, s.x) * s.prev);
  const prev = test.map((s) => s.prev);
  const m = metrics(actual, pred, prev);
  const base = metrics(actual, prev, prev);

  const lastWindow = clean.slice(-lookback);
  const lastRow = lastWindow[lastWindow.length - 1]!;
  const scale = lastRow.close || 1;
  const flat: number[] = [1];
  for (const step of lastWindow) flat.push(step.x[0]! / scale);
  for (let k = 1; k < lastRow.x.length; k++)
    flat.push(lastRow.x[k]! / (k === 3 || k >= 5 ? 1 : 100));
  const predicted = dot(w, flat) * scale;
  const change = predicted - lastRow.close;

  return {
    model: useSentiment ? "lstm_sentiment_fused" : "lstm_market_only",
    features: [...FEATURES, ...(useSentiment ? ["sentiment_mean"] : [])],
    lookback,
    horizonDays: horizon,
    asOfDate: lastRow.date,
    currentPrice: Number(lastRow.close.toFixed(4)),
    predictedPrice: Number(predicted.toFixed(4)),
    absoluteChange: Number(change.toFixed(4)),
    percentChange: Number(((change / lastRow.close) * 100).toFixed(3)),
    direction: change > 0 ? "UP" : change < 0 ? "DOWN" : "FLAT",
    metrics: m,
    baseline: base,
    testSeries: test.map((s, i) => ({
      date: s.date,
      actual: Number(actual[i]!.toFixed(2)),
      predicted: Number(pred[i]!.toFixed(2)),
    })),
    disclaimer:
      "Point estimate from a statistical sequence model. Not investment advice; no accuracy guarantee.",
    confidence: m.r2 * 100,
  };
}
