export type BacktestStrategy = {
  name: string;
  description: string;
  parameters: Record<string, number>;
};

export type BacktestResult = {
  strategy: BacktestStrategy;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  equityCurve: Array<{ date: string; equity: number }>;
  trades: Array<{
    date: string;
    type: 'buy' | 'sell';
    price: number;
    quantity: number;
    pnl: number;
  }>;
};

export type OptimizationResult = {
  strategy: BacktestStrategy;
  results: BacktestResult;
  parameterCombination: Record<string, number>;
  rank: number;
};

// Simple moving average crossover strategy
export function smaCrossoverStrategy(
  prices: Array<{ date: string; close: number }>,
  shortPeriod: number = 10,
  longPeriod: number = 20,
  initialCapital: number = 10000
): BacktestResult {
  const trades: BacktestResult['trades'] = [];
  let position = 0;
  let cash = initialCapital;
  let equity = initialCapital;
  const equityCurve: Array<{ date: string; equity: number }> = [];

  // Calculate SMAs
  const shortSMA: (number | null)[] = [];
  const longSMA: (number | null)[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < shortPeriod - 1) {
      shortSMA.push(null);
    } else {
      const sum = prices.slice(i - shortPeriod + 1, i + 1).reduce((sum, p) => sum + p.close, 0);
      shortSMA.push(sum / shortPeriod);
    }

    if (i < longPeriod - 1) {
      longSMA.push(null);
    } else {
      const sum = prices.slice(i - longPeriod + 1, i + 1).reduce((sum, p) => sum + p.close, 0);
      longSMA.push(sum / longPeriod);
    }
  }

  // Generate trading signals
  for (let i = 1; i < prices.length; i++) {
    const prevShort = shortSMA[i - 1]!;
    const prevLong = longSMA[i - 1]!;
    const currShort = shortSMA[i]!;
    const currLong = longSMA[i]!;

    if (prevShort === null || prevLong === null || currShort === null || currLong === null) {
      equityCurve.push({ date: prices[i]!.date, equity: cash + position * prices[i]!.close });
      continue;
    }

    // Buy signal: short SMA crosses above long SMA
    if (prevShort <= prevLong && currShort > currLong && position === 0) {
      const shares = Math.floor(cash / prices[i]!.close);
      if (shares > 0) {
        position = shares;
        cash -= shares * prices[i]!.close;
        trades.push({
          date: prices[i]!.date,
          type: 'buy',
          price: prices[i]!.close,
          quantity: shares,
          pnl: 0,
        });
      }
    }
    // Sell signal: short SMA crosses below long SMA
    else if (prevShort >= prevLong && currShort < currLong && position > 0) {
      const pnl = (prices[i]!.close - trades[trades.length - 1]!.price) * position;
      cash += position * prices[i]!.close;
      trades[trades.length - 1]!.pnl = pnl;
      position = 0;
      trades.push({
        date: prices[i]!.date,
        type: 'sell',
        price: prices[i]!.close,
        quantity: trades[trades.length - 1]!.quantity,
        pnl,
      });
    }

    equity = cash + position * prices[i]!.close;
    equityCurve.push({ date: prices[i]!.date, equity });
  }

  // Close final position
  if (position > 0) {
    const lastPrice = prices[prices.length - 1]!.close;
    const pnl = (lastPrice - trades[trades.length - 1]!.price) * position;
    cash += position * lastPrice;
    trades[trades.length - 1]!.pnl = pnl;
    position = 0;
    trades.push({
      date: prices[prices.length - 1]!.date,
      type: 'sell',
      price: lastPrice,
      quantity: trades[trades.length - 1]!.quantity,
      pnl,
    });
  }

  return calculateBacktestMetrics(
    {
      name: 'SMA Crossover',
      description: 'Simple moving average crossover strategy',
      parameters: { shortPeriod, longPeriod },
    },
    trades,
    equityCurve,
    initialCapital
  );
}

// RSI mean reversion strategy
export function rsiMeanReversionStrategy(
  prices: Array<{ date: string; close: number; rsi?: number }>,
  oversoldThreshold: number = 30,
  overboughtThreshold: number = 70,
  initialCapital: number = 10000
): BacktestResult {
  const trades: BacktestResult['trades'] = [];
  let position = 0;
  let cash = initialCapital;
  const equityCurve: Array<{ date: string; equity: number }> = [];

  // Calculate RSI if not provided
  const rsiValues = prices.map((p, i) => {
    if (p.rsi !== undefined) return p.rsi;
    
    // Simple RSI calculation
    if (i < 14) return null;
    
    let gains = 0;
    let losses = 0;
    for (let j = i - 13; j <= i; j++) {
      const change = prices[j]!.close - prices[j - 1]!.close;
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  });

  for (let i = 1; i < prices.length; i++) {
    const rsi = rsiValues[i]!;
    const prevRsi = rsiValues[i - 1]!;

    if (rsi === null || prevRsi === null) {
      equityCurve.push({ date: prices[i]!.date, equity: cash + position * prices[i]!.close });
      continue;
    }

    // Buy signal: RSI crosses above oversold threshold
    if (prevRsi <= oversoldThreshold && rsi > oversoldThreshold && position === 0) {
      const shares = Math.floor(cash / prices[i]!.close);
      if (shares > 0) {
        position = shares;
        cash -= shares * prices[i]!.close;
        trades.push({
          date: prices[i]!.date,
          type: 'buy',
          price: prices[i]!.close,
          quantity: shares,
          pnl: 0,
        });
      }
    }
    // Sell signal: RSI crosses below overbought threshold
    else if (prevRsi >= overboughtThreshold && rsi < overboughtThreshold && position > 0) {
      const pnl = (prices[i]!.close - trades[trades.length - 1]!.price) * position;
      cash += position * prices[i]!.close;
      trades[trades.length - 1]!.pnl = pnl;
      position = 0;
      trades.push({
        date: prices[i]!.date,
        type: 'sell',
        price: prices[i]!.close,
        quantity: trades[trades.length - 1]!.quantity,
        pnl,
      });
    }

    equityCurve.push({ date: prices[i]!.date, equity: cash + position * prices[i]!.close });
  }

  // Close final position
  if (position > 0) {
    const lastPrice = prices[prices.length - 1]!.close;
    const pnl = (lastPrice - trades[trades.length - 1]!.price) * position;
    cash += position * lastPrice;
    trades[trades.length - 1]!.pnl = pnl;
    position = 0;
    trades.push({
      date: prices[prices.length - 1]!.date,
      type: 'sell',
      price: lastPrice,
      quantity: trades[trades.length - 1]!.quantity,
      pnl,
    });
  }

  return calculateBacktestMetrics(
    {
      name: 'RSI Mean Reversion',
      description: 'RSI-based mean reversion strategy',
      parameters: { oversoldThreshold, overboughtThreshold },
    },
    trades,
    equityCurve,
    initialCapital
  );
}

// Bollinger Bands breakout strategy
export function bollingerBandsStrategy(
  prices: Array<{ date: string; close: number }>,
  period: number = 20,
  stdDev: number = 2,
  initialCapital: number = 10000
): BacktestResult {
  const trades: BacktestResult['trades'] = [];
  let position = 0;
  let cash = initialCapital;
  const equityCurve: Array<{ date: string; equity: number }> = [];

  // Calculate Bollinger Bands
  const upperBand: (number | null)[] = [];
  const lowerBand: (number | null)[] = [];
  const middleBand: (number | null)[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upperBand.push(null);
      lowerBand.push(null);
      middleBand.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((sum, p) => sum + p.close, 0) / period;
      const variance = slice.reduce((sum, p) => sum + Math.pow(p.close - mean, 2), 0) / period;
      const std = Math.sqrt(variance);

      middleBand.push(mean);
      upperBand.push(mean + stdDev * std);
      lowerBand.push(mean - stdDev * std);
    }
  }

  for (let i = 1; i < prices.length; i++) {
    const prevUpper = upperBand[i - 1]!;
    const prevLower = lowerBand[i - 1]!;
    const currUpper = upperBand[i]!;
    const currLower = lowerBand[i]!;
    const currClose = prices[i]!.close;

    if (prevUpper === null || prevLower === null || currUpper === null || currLower === null) {
      equityCurve.push({ date: prices[i]!.date, equity: cash + position * prices[i]!.close });
      continue;
    }

    // Buy signal: price breaks above upper band
    if (prices[i - 1]!.close <= prevUpper && currClose > currUpper && position === 0) {
      const shares = Math.floor(cash / currClose);
      if (shares > 0) {
        position = shares;
        cash -= shares * currClose;
        trades.push({
          date: prices[i]!.date,
          type: 'buy',
          price: currClose,
          quantity: shares,
          pnl: 0,
        });
      }
    }
    // Sell signal: price breaks below lower band
    else if (prices[i - 1]!.close >= prevLower && currClose < currLower && position > 0) {
      const pnl = (currClose - trades[trades.length - 1]!.price) * position;
      cash += position * currClose;
      trades[trades.length - 1]!.pnl = pnl;
      position = 0;
      trades.push({
        date: prices[i]!.date,
        type: 'sell',
        price: currClose,
        quantity: trades[trades.length - 1]!.quantity,
        pnl,
      });
    }

    equityCurve.push({ date: prices[i]!.date, equity: cash + position * prices[i]!.close });
  }

  // Close final position
  if (position > 0) {
    const lastPrice = prices[prices.length - 1]!.close;
    const pnl = (lastPrice - trades[trades.length - 1]!.price) * position;
    cash += position * lastPrice;
    trades[trades.length - 1]!.pnl = pnl;
    position = 0;
    trades.push({
      date: prices[prices.length - 1]!.date,
      type: 'sell',
      price: lastPrice,
      quantity: trades[trades.length - 1]!.quantity,
      pnl,
    });
  }

  return calculateBacktestMetrics(
    {
      name: 'Bollinger Bands Breakout',
      description: 'Bollinger Bands breakout strategy',
      parameters: { period, stdDev },
    },
    trades,
    equityCurve,
    initialCapital
  );
}

function calculateBacktestMetrics(
  strategy: BacktestStrategy,
  trades: BacktestResult['trades'],
  equityCurve: Array<{ date: string; equity: number }>,
  initialCapital: number
): BacktestResult {
  const finalEquity = equityCurve[equityCurve.length - 1]!.equity;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

  // Calculate daily returns for volatility
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push((equityCurve[i]!.equity - equityCurve[i - 1]!.equity) / equityCurve[i - 1]!.equity);
  }

  const meanReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized

  // Sharpe Ratio (assuming 2% risk-free rate)
  const riskFreeRate = 0.02;
  const excessReturn = meanReturn * 252 - riskFreeRate;
  const sharpeRatio = volatility > 0 ? excessReturn / (volatility / 100) : 0;

  // Maximum Drawdown
  let maxDrawdown = 0;
  let peak = equityCurve[0]!.equity;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const drawdown = ((peak - point.equity) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Trade statistics
  const completedTrades = trades.filter((t) => t.type === 'sell');
  const winningTrades = completedTrades.filter((t) => t.pnl > 0);
  const losingTrades = completedTrades.filter((t) => t.pnl <= 0);
  const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;

  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  const averageWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const averageLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

  // Annualized return
  const days = equityCurve.length;
  const annualizedReturn = (Math.pow(finalEquity / initialCapital, 252 / days) - 1) * 100;

  return {
    strategy,
    totalReturn,
    annualizedReturn,
    volatility,
    sharpeRatio,
    maxDrawdown,
    winRate,
    profitFactor,
    totalTrades: completedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    averageWin,
    averageLoss,
    equityCurve,
    trades,
  };
}

// Strategy optimization
export function optimizeStrategy(
  prices: Array<{ date: string; close: number; rsi?: number }>,
  strategyType: 'sma' | 'rsi' | 'bollinger',
  parameterRanges: Record<string, { min: number; max: number; step: number }>,
  initialCapital: number = 10000
): OptimizationResult[] {
  const results: OptimizationResult[] = [];

  // Generate parameter combinations
  const generateCombinations = (
    ranges: Record<string, { min: number; max: number; step: number }>,
    current: Record<string, number> = {},
    keys: string[] = Object.keys(ranges)
  ): Record<string, number>[] => {
    if (keys.length === 0) return [current];

    const key = keys[0]!;
    const range = ranges[key]!;
    const combinations: Record<string, number>[] = [];

    for (let value = range.min; value <= range.max; value += range.step) {
      const newCurrent = { ...current, [key]: value };
      combinations.push(...generateCombinations(ranges, newCurrent, keys.slice(1)));
    }

    return combinations;
  };

  const combinations = generateCombinations(parameterRanges);

  // Run backtest for each combination
  combinations.forEach((params) => {
    let result: BacktestResult;

    switch (strategyType) {
      case 'sma':
        result = smaCrossoverStrategy(prices, params['shortPeriod'], params['longPeriod'], initialCapital);
        break;
      case 'rsi':
        result = rsiMeanReversionStrategy(prices, params['oversoldThreshold'], params['overboughtThreshold'], initialCapital);
        break;
      case 'bollinger':
        result = bollingerBandsStrategy(prices, params['period'], params['stdDev'], initialCapital);
        break;
    }

    results.push({
      strategy: result.strategy,
      results: result,
      parameterCombination: params,
      rank: 0, // Will be calculated after sorting
    });
  });

  // Rank by Sharpe Ratio
  results.sort((a, b) => b.results.sharpeRatio - a.results.sharpeRatio);
  results.forEach((r, i) => (r.rank = i + 1));

  return results.slice(0, 10); // Return top 10
}

// Compare multiple strategies
export function compareStrategies(results: BacktestResult[]): {
  bestByReturn: BacktestResult;
  bestBySharpe: BacktestResult;
  bestByWinRate: BacktestResult;
  comparison: Array<{
    strategy: string;
    return: number;
    sharpe: number;
    winRate: number;
    maxDrawdown: number;
  }>;
} {
  const bestByReturn = [...results].sort((a, b) => b.totalReturn - a.totalReturn)[0]!;
  const bestBySharpe = [...results].sort((a, b) => b.sharpeRatio - a.sharpeRatio)[0]!;
  const bestByWinRate = [...results].sort((a, b) => b.winRate - a.winRate)[0]!;

  const comparison = results.map((r) => ({
    strategy: r.strategy.name,
    return: r.totalReturn,
    sharpe: r.sharpeRatio,
    winRate: r.winRate,
    maxDrawdown: r.maxDrawdown,
  }));

  return { bestByReturn, bestBySharpe, bestByWinRate, comparison };
}
