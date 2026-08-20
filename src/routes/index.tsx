import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Brain, LineChart as LineIcon, Newspaper, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { getOverview, predictPrice } from "@/lib/stocks.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LSTM + News Sentiment Stock Forecast Dashboard" },
      {
        name: "description",
        content:
          "Forecast next-day stock prices with a sequence model fused with financial news sentiment, technical indicators and backtested accuracy metrics.",
      },
      { property: "og:title", content: "LSTM + News Sentiment Stock Forecast Dashboard" },
      {
        property: "og:description",
        content:
          "Live market data, technical indicators, news sentiment analysis and next-day price predictions with model accuracy metrics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const RANGES = ["6mo", "1y", "2y", "5y"] as const;
type Range = (typeof RANGES)[number];

const fmt = (n: number, d = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-lg font-semibold">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const chartTooltip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--muted-foreground)" },
};

function Dashboard() {
  const [input, setInput] = useState("AAPL");
  const [symbol, setSymbol] = useState("AAPL");
  const [range, setRange] = useState<Range>("2y");
  const [useSentiment, setUseSentiment] = useState(true);

  const fetchOverview = useServerFn(getOverview);
  const runPredict = useServerFn(predictPrice);

  const overview = useQuery({
    queryKey: ["overview", symbol, range],
    queryFn: () => fetchOverview({ data: { symbol, range } }),
    retry: false,
  });

  const prediction = useMutation({
    mutationFn: () => runPredict({ data: { symbol, range, useSentiment } }),
  });

  const data = overview.data;
  const rows = data?.indicators ?? [];
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2];
  const dayChange = last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;
  const result = prediction.data?.primary;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = input.trim().toUpperCase();
    if (!next) return;
    setSymbol(next);
    prediction.reset();
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-primary">
            LSTM · News Sentiment Fusion
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-4xl">
            AI Stock Market Prediction Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Live daily OHLCV data, causal technical indicators, financial-news sentiment scoring and a
            backtested sequence model that forecasts the next close.
          </p>
        </div>
        <form onSubmit={submit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ticker e.g. MSFT"
              aria-label="Ticker symbol"
              className="tabular w-44 pl-9 uppercase"
            />
          </div>
          <Button type="submit">Load</Button>
        </form>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={r === range ? "default" : "outline"}
            onClick={() => {
              setRange(r);
              prediction.reset();
            }}
          >
            {r}
          </Button>
        ))}
        <Button
          size="sm"
          variant={useSentiment ? "default" : "outline"}
          onClick={() => setUseSentiment((v) => !v)}
          className="ml-auto"
        >
          <Brain className="mr-1 h-4 w-4" />
          Sentiment fusion {useSentiment ? "on" : "off"}
        </Button>
        <Button
          size="sm"
          onClick={() => prediction.mutate()}
          disabled={prediction.isPending || !data}
        >
          {prediction.isPending ? "Training…" : "Train & predict"}
        </Button>
      </div>

      {overview.isError ? (
        <Card className="mt-6 border-destructive/60">
          <CardHeader>
            <CardTitle className="text-base">Could not load {symbol}</CardTitle>
            <CardDescription>{(overview.error as Error).message}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {overview.isPending ? (
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : null}

      {data && last ? (
        <>
          <section className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Stat
              label={`${data.symbol} last close`}
              value={`${fmt(last.close)} ${data.currency}`}
              hint={data.name}
            />
            <Stat
              label="Daily change"
              value={`${dayChange >= 0 ? "+" : ""}${fmt(dayChange)}%`}
              hint={data.exchange}
            />
            <Stat
              label="RSI (14)"
              value={last.rsi14 === null ? "—" : fmt(last.rsi14, 1)}
              hint={
                last.rsi14 === null
                  ? "warming up"
                  : last.rsi14 > 70
                    ? "overbought"
                    : last.rsi14 < 30
                      ? "oversold"
                      : "neutral"
              }
            />
            <Stat
              label="News sentiment"
              value={fmt(data.averageSentiment, 3)}
              hint={`${data.counts.positive}+ / ${data.counts.neutral}o / ${data.counts.negative}-`}
            />
          </section>

          {result ? (
            <Card className="mt-6 border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {result.direction === "DOWN" ? (
                    <ArrowDownRight className="h-4 w-4 text-bear" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-bull" />
                  )}
                  Forecast for the next {result.horizonDays} trading day
                </CardTitle>
                <CardDescription>
                  {result.model} · lookback {result.lookback} bars · as of {result.asOfDate}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <Stat label="Current" value={fmt(result.currentPrice)} />
                <Stat label="Predicted" value={fmt(result.predictedPrice)} />
                <Stat
                  label="Expected change"
                  value={`${result.percentChange >= 0 ? "+" : ""}${fmt(result.percentChange)}%`}
                  hint={`${fmt(result.absoluteChange)} ${data.currency}`}
                />
                <Stat
                  label="Test direction accuracy"
                  value={`${fmt(result.metrics.directionAccuracy, 1)}%`}
                  hint={`RMSE ${fmt(result.metrics.rmse)} · R² ${fmt(result.metrics.r2, 3)}`}
                />
                <p className="text-xs text-muted-foreground md:col-span-4">{result.disclaimer}</p>
              </CardContent>
            </Card>
          ) : null}

          <Tabs defaultValue="price" className="mt-6">
            <TabsList>
              <TabsTrigger value="price">
                <LineIcon className="mr-1 h-4 w-4" /> Price
              </TabsTrigger>
              <TabsTrigger value="indicators">Indicators</TabsTrigger>
              <TabsTrigger value="sentiment">
                <Newspaper className="mr-1 h-4 w-4" /> Sentiment
              </TabsTrigger>
              <TabsTrigger value="model">Model</TabsTrigger>
            </TabsList>

            <TabsContent value="price">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Close price with Bollinger bands</CardTitle>
                  <CardDescription>{data.rows} daily bars</CardDescription>
                </CardHeader>
                <CardContent className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={rows}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={48} />
                      <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={60} />
                      <Tooltip {...chartTooltip} />
                      <Area
                        dataKey="bbUpper"
                        stroke="var(--color-chart-2)"
                        fill="var(--color-chart-2)"
                        fillOpacity={0.06}
                        dot={false}
                      />
                      <Area
                        dataKey="bbLower"
                        stroke="var(--color-chart-2)"
                        fill="var(--background)"
                        fillOpacity={0.9}
                        dot={false}
                      />
                      <Area
                        dataKey="close"
                        stroke="var(--color-chart-1)"
                        strokeWidth={2}
                        fill="none"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="indicators">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Moving averages</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rows}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={48} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={60} />
                        <Tooltip {...chartTooltip} />
                        <Line dataKey="close" stroke="var(--color-chart-1)" dot={false} />
                        <Line dataKey="sma10" stroke="var(--color-chart-3)" dot={false} />
                        <Line dataKey="sma20" stroke="var(--color-chart-5)" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">RSI (14)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rows}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={48} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={40} />
                        <Tooltip {...chartTooltip} />
                        <Line dataKey="rsi14" stroke="var(--color-chart-4)" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">MACD (12, 26, 9)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rows}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={48} />
                        <YAxis tick={{ fontSize: 11 }} width={50} />
                        <Tooltip {...chartTooltip} />
                        <Line dataKey="macd" stroke="var(--color-chart-1)" dot={false} />
                        <Line dataKey="macdSignal" stroke="var(--color-chart-4)" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sentiment">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Daily mean sentiment</CardTitle>
                    <CardDescription>Lexicon scoring, joined causally to price bars</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.daily}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                        <YAxis domain={[-1, 1]} tick={{ fontSize: 11 }} width={50} />
                        <Tooltip {...chartTooltip} />
                        <Bar dataKey="mean" fill="var(--color-chart-1)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Latest headlines</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-[300px] space-y-3 overflow-y-auto">
                    {data.articles.map((a, i) => (
                      <div key={i} className="flex items-start gap-3 border-b border-border pb-2">
                        <Badge
                          variant={a.label === "neutral" ? "secondary" : "outline"}
                          className={
                            a.label === "positive"
                              ? "border-bull text-bull"
                              : a.label === "negative"
                                ? "border-bear text-bear"
                                : ""
                          }
                        >
                          {a.score.toFixed(2)}
                        </Badge>
                        <div>
                          <p className="text-sm leading-snug">{a.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.source} · {a.publishedAt.slice(0, 10)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="model">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Backtest: actual vs predicted</CardTitle>
                  <CardDescription>
                    Chronological hold-out split — the model never sees future bars during training.
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {result ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.testSeries}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={40} />
                        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={60} />
                        <Tooltip {...chartTooltip} />
                        <Line dataKey="actual" stroke="var(--color-chart-1)" dot={false} />
                        <Line
                          dataKey="predicted"
                          stroke="var(--color-chart-4)"
                          strokeDasharray="4 3"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Run “Train &amp; predict” to generate a backtest.
                    </p>
                  )}
                </CardContent>
              </Card>

              {prediction.data ? (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base">Model comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="tabular overflow-x-auto text-sm">
                      <table className="w-full text-left">
                        <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="py-2">Model</th>
                            <th className="py-2">MAE</th>
                            <th className="py-2">RMSE</th>
                            <th className="py-2">MAPE %</th>
                            <th className="py-2">R²</th>
                            <th className="py-2">Direction %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prediction.data.comparison.map((m) => (
                            <tr key={m.name} className="border-t border-border">
                              <td className="py-2">{m.name}</td>
                              <td className="py-2">{fmt(m.metrics.mae)}</td>
                              <td className="py-2">{fmt(m.metrics.rmse)}</td>
                              <td className="py-2">{fmt(m.metrics.mape, 3)}</td>
                              <td className="py-2">{fmt(m.metrics.r2, 3)}</td>
                              <td className="py-2">{fmt(m.metrics.directionAccuracy, 1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>

          {prediction.isError ? (
            <p className="mt-4 text-sm text-destructive">
              {(prediction.error as Error).message}
            </p>
          ) : null}

          <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
            Educational project — “AI-Based Stock Market Prediction Using LSTM and News Sentiment
            Analysis”. The full Python/TensorFlow implementation (FinBERT, Keras LSTM, FastAPI) lives in
            the <code className="tabular">python/</code> directory of this repository.
          </footer>
        </>
      ) : null}
    </main>
  );
}