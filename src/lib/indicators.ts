export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type IndicatorRow = {
  date: string;
  close: number;
  sma10: number | null;
  sma20: number | null;
  ema12: number | null;
  ema26: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  bbUpper: number | null;
  bbLower: number | null;
  ret1: number | null;
  vol10: number | null;
};

const sma = (v: number[], n: number) =>
  v.map((_, i) => (i + 1 < n ? null : v.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n));

function ema(v: number[], n: number): (number | null)[] {
  const k = 2 / (n + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < v.length; i++) {
    if (i + 1 < n) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      prev = v.slice(0, n).reduce((a, b) => a + b, 0) / n;
    } else {
      prev = (v[i] as number) * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

function rsi(v: number[], n = 14): (number | null)[] {
  const out: (number | null)[] = [null];
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < v.length; i++) {
    const d = (v[i] as number) - (v[i - 1] as number);
    const g = Math.max(d, 0);
    const l = Math.max(-d, 0);
    if (i <= n) {
      gain += g / n;
      loss += l / n;
      out.push(i === n ? 100 - 100 / (1 + (loss === 0 ? Infinity : gain / loss)) : null);
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
      out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
    }
  }
  return out.map((x) => (x === null || Number.isNaN(x) ? null : Math.min(100, Math.max(0, x))));
}

function stdev(v: number[], n: number): (number | null)[] {
  return v.map((_, i) => {
    if (i + 1 < n) return null;
    const w = v.slice(i + 1 - n, i + 1);
    const m = w.reduce((a, b) => a + b, 0) / n;
    return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / n);
  });
}

/** Causal indicators only — every value uses data up to and including its own bar. */
export function addIndicators(candles: Candle[]): IndicatorRow[] {
  const close = candles.map((c) => c.close);
  const s10 = sma(close, 10);
  const s20 = sma(close, 20);
  const e12 = ema(close, 12);
  const e26 = ema(close, 26);
  const r14 = rsi(close, 14);
  const sd20 = stdev(close, 20);
  const macdLine = close.map((_, i) =>
    (e12[i] ?? null) !== null && (e26[i] ?? null) !== null ? ((e12[i] ?? null) as number) - ((e26[i] ?? null) as number) : null,
  );
  const macdVals = macdLine.map((x) => x ?? 0);
  const sig = ema(macdVals, 9);
  const rets = close.map((c, i) => (i === 0 ? null : c / (close[i - 1] as number) - 1));
  const retVals = rets.map((x) => x ?? 0);
  const vol10 = stdev(retVals, 10);

  return candles.map((c, i) => ({
    date: c.date,
    close: c.close,
    sma10: (s10[i] ?? null),
    sma20: (s20[i] ?? null),
    ema12: (e12[i] ?? null),
    ema26: (e26[i] ?? null),
    rsi14: (r14[i] ?? null),
    macd: (macdLine[i] ?? null),
    macdSignal: (macdLine[i] ?? null) === null ? null : (sig[i] ?? null),
    bbUpper: (s20[i] ?? null) !== null && (sd20[i] ?? null) !== null ? ((s20[i] ?? null) as number) + 2 * ((sd20[i] ?? null) as number) : null,
    bbLower: (s20[i] ?? null) !== null && (sd20[i] ?? null) !== null ? ((s20[i] ?? null) as number) - 2 * ((sd20[i] ?? null) as number) : null,
    ret1: (rets[i] ?? null),
    vol10: (vol10[i] ?? null),
  }));
}