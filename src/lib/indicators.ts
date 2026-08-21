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
  // Advanced indicators
  atr14: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  williamsR: number | null;
  ichimokuTenkan: number | null;
  ichimokuKijun: number | null;
  fib236: number | null;
  fib382: number | null;
  fib500: number | null;
  fib618: number | null;
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

// Average True Range (ATR)
function atr(candles: Candle[], n = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let prevAtr: number | null = null;
  
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }
    
    const high = candles[i]!.high;
    const low = candles[i]!.low;
    const prevClose = candles[i - 1]!.close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    if (i < n) {
      out.push(null);
      if (i === n - 1) {
        const trValues = candles.slice(0, n).map((c, idx) => {
          if (idx === 0) return c.high - c.low;
          const prevC = candles[idx - 1]!;
          return Math.max(
            c.high - c.low,
            Math.abs(c.high - prevC.close),
            Math.abs(c.low - prevC.close)
          );
        });
        prevAtr = trValues.reduce((a, b) => a + b, 0) / n;
      }
    } else {
      prevAtr = ((prevAtr ?? 0) * (n - 1) + tr) / n;
      out.push(prevAtr);
    }
  }
  return out;
}

// Stochastic Oscillator
function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): { k: (number | null)[]; d: (number | null)[] } {
  const k: (number | null)[] = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) {
      k.push(null);
      continue;
    }
    
    const window = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...window.map(c => c.high));
    const low = Math.min(...window.map(c => c.low));
    
    if (high === low) {
      k.push(50);
    } else {
      k.push(((candles[i]!.close - low) / (high - low)) * 100);
    }
  }
  
  const d = sma(k.filter(x => x !== null) as number[], dPeriod);
  const dPadded: (number | null)[] = [];
  let dIdx = 0;
  for (let i = 0; i < k.length; i++) {
    if (k[i] === null) {
      dPadded.push(null);
    } else {
      dPadded.push(d[dIdx++] ?? null);
    }
  }
  
  return { k, d: dPadded };
}

// Williams %R
function williamsR(candles: Candle[], n = 14): (number | null)[] {
  return candles.map((_, i) => {
    if (i < n - 1) return null;
    const window = candles.slice(i - n + 1, i + 1);
    const high = Math.max(...window.map(c => c.high));
    const low = Math.min(...window.map(c => c.low));
    
    if (high === low) return -50;
    return ((high - candles[i]!.close) / (high - low)) * -100;
  });
}

// Ichimoku Cloud
function ichimoku(candles: Candle[]): { tenkan: (number | null)[]; kijun: (number | null)[] } {
  const tenkanPeriod = 9;
  const kijunPeriod = 26;
  
  const tenkan: (number | null)[] = candles.map((_, i) => {
    if (i < tenkanPeriod - 1) return null;
    const window = candles.slice(i - tenkanPeriod + 1, i + 1);
    const high = Math.max(...window.map(c => c.high));
    const low = Math.min(...window.map(c => c.low));
    return (high + low) / 2;
  });
  
  const kijun: (number | null)[] = candles.map((_, i) => {
    if (i < kijunPeriod - 1) return null;
    const window = candles.slice(i - kijunPeriod + 1, i + 1);
    const high = Math.max(...window.map(c => c.high));
    const low = Math.min(...window.map(c => c.low));
    return (high + low) / 2;
  });
  
  return { tenkan, kijun };
}

// Fibonacci Retracement Levels
function fibonacci(candles: Candle[]): { 
  fib236: number | null; 
  fib382: number | null; 
  fib500: number | null; 
  fib618: number | null; 
} {
  if (candles.length < 50) {
    return { fib236: null, fib382: null, fib500: null, fib618: null };
  }
  
  const recent = candles.slice(-50);
  const high = Math.max(...recent.map(c => c.high));
  const low = Math.min(...recent.map(c => c.low));
  const diff = high - low;
  
  return {
    fib236: high - diff * 0.236,
    fib382: high - diff * 0.382,
    fib500: high - diff * 0.5,
    fib618: high - diff * 0.618,
  };
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
    (e12[i] ?? null) !== null && (e26[i] ?? null) !== null
      ? ((e12[i] ?? null) as number) - ((e26[i] ?? null) as number)
      : null,
  );
  const macdVals = macdLine.map((x) => x ?? 0);
  const sig = ema(macdVals, 9);
  const rets = close.map((c, i) => (i === 0 ? null : c / (close[i - 1] as number) - 1));
  const retVals = rets.map((x) => x ?? 0);
  const vol10 = stdev(retVals, 10);
  
  // Advanced indicators
  const atr14 = atr(candles, 14);
  const stoch = stochastic(candles, 14, 3);
  const willR = williamsR(candles, 14);
  const ichimokuValues = ichimoku(candles);
  const fibLevels = fibonacci(candles);

  return candles.map((c, i) => ({
    date: c.date,
    close: c.close,
    sma10: s10[i] ?? null,
    sma20: s20[i] ?? null,
    ema12: e12[i] ?? null,
    ema26: e26[i] ?? null,
    rsi14: r14[i] ?? null,
    macd: macdLine[i] ?? null,
    macdSignal: (macdLine[i] ?? null) === null ? null : (sig[i] ?? null),
    bbUpper:
      (s20[i] ?? null) !== null && (sd20[i] ?? null) !== null
        ? ((s20[i] ?? null) as number) + 2 * ((sd20[i] ?? null) as number)
        : null,
    bbLower:
      (s20[i] ?? null) !== null && (sd20[i] ?? null) !== null
        ? ((s20[i] ?? null) as number) - 2 * ((sd20[i] ?? null) as number)
        : null,
    ret1: rets[i] ?? null,
    vol10: vol10[i] ?? null,
    // Advanced indicators
    atr14: atr14[i] ?? null,
    stochasticK: stoch.k[i] ?? null,
    stochasticD: stoch.d[i] ?? null,
    williamsR: willR[i] ?? null,
    ichimokuTenkan: ichimokuValues.tenkan[i] ?? null,
    ichimokuKijun: ichimokuValues.kijun[i] ?? null,
    fib236: fibLevels.fib236,
    fib382: fibLevels.fib382,
    fib500: fibLevels.fib500,
    fib618: fibLevels.fib618,
  }));
}
