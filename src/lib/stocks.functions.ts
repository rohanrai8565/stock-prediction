import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { advancedAI, callOpenAIWithMemory, type ConversationContext, type ConversationMessage } from "./advanced-ai";

const symbolSchema = z.object({
  symbol: z.string().min(1).max(16),
  range: z.enum(["6mo", "1y", "2y", "5y"]).default("2y"),
});

const forecastSchema = symbolSchema.extend({
  useSentiment: z.boolean().default(true),
  horizon: z.union([z.literal(1), z.literal(7), z.literal(15), z.literal(30)]).default(15),
});

export const searchStocks = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ q: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { searchSymbols } = await import("./market.server");
    return { results: await searchSymbols(data.q) };
  });

export const getOverview = createServerFn({ method: "GET" })
  .validator((d: unknown) => symbolSchema.parse(d))
  .handler(async ({ data }) => {
    const { loadHistory } = await import("./market.server");
    const { addIndicators } = await import("./indicators");
    const { generateNews, dailySentiment } = await import("./sentiment");

    const quote = await loadHistory(data.symbol, data.range);
    const indicators = addIndicators(quote.candles);
    const label = quote.name.split(" ").slice(0, 2).join(" ") || quote.symbol;
    const articles = generateNews(label, 30).slice(0, 24);
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
  .validator((d: unknown) => forecastSchema.parse(d))
  .handler(async ({ data }) => {
    const { loadHistory } = await import("./market.server");
    const { generateNews } = await import("./sentiment");
    const { runForecast } = await import("./forecast.server");

    const quote = await loadHistory(data.symbol, data.range);
    const label = quote.name.split(" ").slice(0, 2).join(" ") || quote.symbol;
    const articles = generateNews(label, 400, 2);
    const options = { horizon: data.horizon };
    const fused = runForecast(quote.candles, articles, true, options);
    const marketOnly = runForecast(quote.candles, articles, false, options);
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

const chatSchema = z.object({
  message: z.string().trim().min(1).max(1_500),
  symbol: z.string().trim().min(1).max(16),
  context: z.string().max(2_000).optional(),
  userId: z.string().optional(),
  currentPrice: z.number().optional(),
  dailyChange: z.number().optional(),
  rsi: z.number().nullable().optional(),
  sentiment: z.number().optional(),
  sma20: z.number().nullable().optional(),
  macd: z.number().nullable().optional(),
  bbUpper: z.number().nullable().optional(),
  bbLower: z.number().nullable().optional(),
  predictedPrice: z.number().optional(),
  percentChange: z.number().optional(),
  direction: z.enum(['UP', 'DOWN', 'FLAT']).optional(),
  confidence: z.number().optional(),
});

function buildLocalAssistantAnswer(message: string, symbol: string, context?: string) {
  const question = message.toLowerCase();
  const snapshot = context || `No live dashboard snapshot is available for ${symbol}.`;

  if (question.includes("sentiment") || question.includes("news")) {
    return `For ${symbol}, the dashboard snapshot is: ${snapshot}\n\nUse the sentiment and news panels to distinguish the current tone from confirmed fundamentals. News sentiment can change quickly and is not a reliable standalone forecast.`;
  }
  if (question.includes("risk") || question.includes("safe") || question.includes("buy") || question.includes("sell")) {
    return `For ${symbol}, the dashboard snapshot is: ${snapshot}\n\nThe main risks are volatility, changing news, model uncertainty, and incomplete fundamental information. This tool cannot determine whether an investment is suitable or tell you to buy or sell.`;
  }
  if (question.includes("price") || question.includes("forecast") || question.includes("predict")) {
    return `For ${symbol}, the dashboard snapshot is: ${snapshot}\n\nTreat any model projection as an uncertain scenario, not a guaranteed price target. Compare it with the backtest metrics and review the forecast horizon before drawing conclusions.`;
  }
  return `For ${symbol}, the dashboard snapshot is: ${snapshot}\n\nThe dashboard combines market indicators and generated news sentiment for educational research. Ask about the forecast, sentiment, news, or risks for a more focused explanation.`;
}

/** Keeps the API key on the server while giving the assistant current web-search capability. */
export const askStockAssistant = createServerFn({ method: "POST" })
  .validator((d: unknown) => chatSchema.parse(d))
  .handler(async ({ data }) => {
    const assistantMode = process.env["ASSISTANT_MODE"] || "auto";
    const userId = data.userId || "default_user";
    
    // Build conversation context
    const context: ConversationContext = {
      symbol: data.symbol,
      symbolName: data.symbol, // Will be populated from overview data if available
      currentPrice: data.currentPrice || 0,
      dailyChange: data.dailyChange || 0,
      rsi: data.rsi ?? null,
      sentiment: data.sentiment || 0,
      indicators: {
        sma20: data.sma20 ?? null,
        macd: data.macd ?? null,
        bbUpper: data.bbUpper ?? null,
        bbLower: data.bbLower ?? null,
      },
      prediction: data.predictedPrice && data.percentChange && data.direction && data.confidence ? {
        predictedPrice: data.predictedPrice,
        percentChange: data.percentChange,
        direction: data.direction,
        confidence: data.confidence,
      } : null,
    };

    // Update AI context
    advancedAI.updateContext(userId, data.symbol, context);

    // Add user message to conversation
    advancedAI.addToConversation(userId, data.symbol, {
      role: 'user',
      content: data.message,
      timestamp: new Date().toISOString(),
    });

    if (assistantMode === "local") {
      const response = advancedAI.generateLocalResponse(data.message, context);
      advancedAI.addToConversation(userId, data.symbol, {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      });
      return { answer: response };
    }

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey || apiKey === "your_openai_api_key_here") {
      if (assistantMode === "auto") {
        const response = advancedAI.generateLocalResponse(data.message, context);
        advancedAI.addToConversation(userId, data.symbol, {
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        });
        return { answer: response };
      }
      throw new Error(
        "AI assistant is not configured. Add OPENAI_API_KEY to your server environment and restart the app.",
      );
    }

    try {
      const conversationHistory = advancedAI.getConversation(userId, data.symbol);
      const response = await callOpenAIWithMemory(
        data.message,
        context,
        conversationHistory,
        apiKey,
        process.env["OPENAI_MODEL"] || "gpt-4o-mini"
      );
      
      advancedAI.addToConversation(userId, data.symbol, {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      });
      
      return { answer: response };
    } catch (error) {
      if (assistantMode === "auto") {
        const response = advancedAI.generateLocalResponse(data.message, context);
        advancedAI.addToConversation(userId, data.symbol, {
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        });
        return { answer: response };
      }
      throw error;
    }
  });
