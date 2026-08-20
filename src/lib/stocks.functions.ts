import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const symbolSchema = z.object({
  symbol: z.string().min(1).max(16),
  range: z.enum(["6mo", "1y", "2y", "5y"]).default("2y"),
});

export const searchStocks = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ q: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { searchSymbols } = await import("./market.server");
    return { results: await searchSymbols(data.q) };
  });

export const getOverview = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => symbolSchema.parse(d))
  .handler(async ({ data }) => {
    const { loadHistory } = await import("./market.server");
    const { addIndicators } = await import("./indicators");
    const { generateNews, dailySentiment } = await import("./sentiment");

    const quote = await loadHistory(data.symbol, data.range);
    const indicators = addIndicators(quote.candles);
    const articles = generateNews(quote.symbol, 30).slice(0, 24);
    const daily = dailySentiment(articles);
    const counts = {
      positive: articles.filter((a) => a.label === "positive").length,
      neutral: articles.filter((a) => a.label === "neutral").length,
      negative: articles.filter((a) => a.label === "negative").length,
    };
    return {
      symbol: quote.symbol,
      name: quote.name,
      currency: quote.currency,
      exchange: quote.exchange,
      price: quote.price,
      rows: quote.candles.length,
      indicators,
      articles,
      daily,
      counts,
      averageSentiment: articles.length
        ? Number((articles.reduce((a, b) => a + b.score, 0) / articles.length).toFixed(4))
        : 0,
    };
  });

export const predictPrice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    symbolSchema.extend({ useSentiment: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { loadHistory } = await import("./market.server");
    const { generateNews } = await import("./sentiment");
    const { runForecast } = await import("./forecast.server");

    const quote = await loadHistory(data.symbol, data.range);
    const articles = generateNews(quote.symbol, 400, 2);
    const fused = runForecast(quote.candles, articles, true);
    const marketOnly = runForecast(quote.candles, articles, false);
    return {
      symbol: quote.symbol,
      primary: data.useSentiment ? fused : marketOnly,
      comparison: [
        { name: marketOnly.model, metrics: marketOnly.metrics },
        { name: fused.model, metrics: fused.metrics },
        { name: "baseline_previous_close", metrics: fused.baseline },
      ],
    };
  });