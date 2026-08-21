import type { Candle } from "./indicators";

export type Quote = {
  symbol: string;
  name: string;
  currency: string;
  exchange: string;
  price: number;
  candles: Candle[];
};

const UA = "Mozilla/5.0 (compatible; StockLSTMDashboard/1.0)";

async function fetchJson(url: string, attempts = 3): Promise<unknown> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.status === 404) throw new Error("NOT_FOUND");
      if (!res.ok) throw new Error(`Upstream responded ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if ((err as Error).message === "NOT_FOUND") break;
      await new Promise((r) => setTimeout(r, 300 * 2 ** i));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function searchSymbols(query: string) {
  if (!query.trim()) return [];
  const data = (await fetchJson(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`,
  )) as {
    quotes?: Array<{
      symbol?: unknown;
      shortname?: unknown;
      longname?: unknown;
      exchDisp?: unknown;
    }>;
  };
  const quotes = data.quotes ?? [];
  return quotes
    .filter((q) => q?.symbol)
    .map((q) => ({
      symbol: String(q.symbol),
      name: String(q.shortname ?? q.longname ?? q.symbol),
      exchange: String(q.exchDisp ?? ""),
    }));
}

/** Loads daily OHLCV history, retrying transient upstream failures. */
export async function loadHistory(symbol: string, range = "2y"): Promise<Quote> {
  const clean = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.\-^=]{1,16}$/.test(clean)) {
    throw new Error(`'${symbol}' is not a valid ticker symbol.`);
  }
  const data = (await fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(clean)}?range=${range}&interval=1d`,
  ).catch((err: Error) => {
    if (err.message === "NOT_FOUND") {
      throw new Error(`Symbol '${clean}' was not found — it may be delisted or misspelled.`);
    }
    throw new Error(`Market data provider is unavailable right now (${err.message}).`);
  })) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: number[];
            high?: number[];
            low?: number[];
            close?: number[];
            volume?: number[];
          }>;
          adjclose?: Array<{ adjclose?: number[] }>;
        };
        meta?: {
          longName?: unknown;
          shortName?: unknown;
          currency?: unknown;
          fullExchangeName?: unknown;
          regularMarketPrice?: unknown;
        };
      }>;
    };
  };

  const result = data?.chart?.result?.[0];
  if (!result?.timestamp) {
    throw new Error(`No price history returned for '${clean}'. Try another symbol.`);
  }
  const q = result.indicators?.quote?.[0] ?? {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const candles: Candle[] = [];
  (result.timestamp as number[]).forEach((ts, i) => {
    const close = adj?.[i] ?? q.close?.[i];
    if (close == null || q.open?.[i] == null) return;
    candles.push({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: Number(q.open[i]),
      high: Number(q.high?.[i] ?? close),
      low: Number(q.low?.[i] ?? close),
      close: Number(close),
      volume: Number(q.volume?.[i] ?? 0),
    });
  });
  if (candles.length < 60) {
    throw new Error(`Only ${candles.length} usable rows for '${clean}' — need at least 60.`);
  }
  return {
    symbol: clean,
    name: String(result.meta?.longName ?? result.meta?.shortName ?? clean),
    currency: String(result.meta?.currency ?? "USD"),
    exchange: String(result.meta?.fullExchangeName ?? ""),
    price: Number(result.meta?.regularMarketPrice ?? candles[candles.length - 1]!.close),
    candles,
  };
}
