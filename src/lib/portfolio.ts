export type PortfolioHolding = {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  currency: string;
  purchaseDate: string;
};

export type Portfolio = {
  holdings: PortfolioHolding[];
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercentage: number;
  lastUpdated: string;
};

export type PortfolioTransaction = {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  currency: string;
  timestamp: string;
};

export function createEmptyPortfolio(): Portfolio {
  return {
    holdings: [],
    totalValue: 0,
    totalCost: 0,
    totalPnL: 0,
    totalPnLPercentage: 0,
    lastUpdated: new Date().toISOString(),
  };
}

export function calculatePortfolioMetrics(
  holdings: PortfolioHolding[],
  currentPrices: Map<string, number>
): Portfolio {
  let totalValue = 0;
  let totalCost = 0;

  const updatedHoldings = holdings.map((holding) => {
    const currentPrice = currentPrices.get(holding.symbol) || holding.currentPrice;
    const currentValue = holding.quantity * currentPrice;
    const cost = holding.quantity * holding.averageCost;

    totalValue += currentValue;
    totalCost += cost;

    return {
      ...holding,
      currentPrice,
    };
  });

  const totalPnL = totalValue - totalCost;
  const totalPnLPercentage = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  return {
    holdings: updatedHoldings,
    totalValue,
    totalCost,
    totalPnL,
    totalPnLPercentage,
    lastUpdated: new Date().toISOString(),
  };
}

export function addHolding(
  portfolio: Portfolio,
  symbol: string,
  name: string,
  quantity: number,
  price: number,
  currency: string
): Portfolio {
  const existingHolding = portfolio.holdings.find((h) => h.symbol === symbol);

  let updatedHoldings: PortfolioHolding[];

  if (existingHolding) {
    // Average down/up calculation
    const totalQuantity = existingHolding.quantity + quantity;
    const totalCost = existingHolding.quantity * existingHolding.averageCost + quantity * price;
    const newAverageCost = totalCost / totalQuantity;

    updatedHoldings = portfolio.holdings.map((h) =>
      h.symbol === symbol
        ? {
            ...h,
            quantity: totalQuantity,
            averageCost: newAverageCost,
            currentPrice: price,
          }
        : h
    );
  } else {
    updatedHoldings = [
      ...portfolio.holdings,
      {
        symbol,
        name,
        quantity,
        averageCost: price,
        currentPrice: price,
        currency,
        purchaseDate: new Date().toISOString(),
      },
    ];
  }

  const currentPrices = new Map(updatedHoldings.map((h) => [h.symbol, h.currentPrice]));
  return calculatePortfolioMetrics(updatedHoldings, currentPrices);
}

export function removeHolding(
  portfolio: Portfolio,
  symbol: string,
  quantity: number,
  sellPrice: number
): Portfolio {
  const holding = portfolio.holdings.find((h) => h.symbol === symbol);
  
  if (!holding) {
    throw new Error(`Holding ${symbol} not found in portfolio`);
  }

  if (quantity > holding.quantity) {
    throw new Error(`Cannot sell more than owned. Owned: ${holding.quantity}, Attempted: ${quantity}`);
  }

  let updatedHoldings: PortfolioHolding[];

  if (quantity === holding.quantity) {
    // Remove entire holding
    updatedHoldings = portfolio.holdings.filter((h) => h.symbol !== symbol);
  } else {
    // Partial sell - keep same average cost
    updatedHoldings = portfolio.holdings.map((h) =>
      h.symbol === symbol
        ? {
            ...h,
            quantity: h.quantity - quantity,
            currentPrice: sellPrice,
          }
        : h
    );
  }

  const currentPrices = new Map(updatedHoldings.map((h) => [h.symbol, h.currentPrice]));
  return calculatePortfolioMetrics(updatedHoldings, currentPrices);
}

export function getPortfolioDiversification(portfolio: Portfolio): {
  bySymbol: Array<{ symbol: string; value: number; percentage: number }>;
  bySector: Array<{ sector: string; value: number; percentage: number }>;
} {
  const bySymbol = portfolio.holdings.map((holding) => ({
    symbol: holding.symbol,
    value: holding.quantity * holding.currentPrice,
    percentage:
      portfolio.totalValue > 0
        ? ((holding.quantity * holding.currentPrice) / portfolio.totalValue) * 100
        : 0,
  }));

  // Simple sector classification based on symbol patterns
  const sectorMap: Map<string, number> = new Map();
  
  portfolio.holdings.forEach((holding) => {
    const value = holding.quantity * holding.currentPrice;
    let sector = 'Other';
    
    if (holding.symbol.includes('.NS')) {
      if (['RELIANCE', 'TATA', 'INFY', 'HDFC'].some(s => holding.symbol.includes(s))) {
        sector = 'Indian Large Cap';
      } else {
        sector = 'Indian Stocks';
      }
    } else if (['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA'].includes(holding.symbol)) {
      sector = 'US Tech';
    } else if (holding.symbol.startsWith('^')) {
      sector = 'Indices';
    } else if (['BTC', 'ETH'].some(s => holding.symbol.includes(s))) {
      sector = 'Cryptocurrency';
    } else if (holding.symbol.includes('=X')) {
      sector = 'Forex';
    }
    
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
  });

  const bySector = Array.from(sectorMap.entries()).map(([sector, value]) => ({
    sector,
    value,
    percentage: portfolio.totalValue > 0 ? (value / portfolio.totalValue) * 100 : 0,
  }));

  return { bySymbol, bySector };
}

export function getPortfolioPerformance(
  portfolio: Portfolio,
  historicalPrices: Map<string, Array<{ date: string; price: number }>>
): {
  dailyReturns: Array<{ date: string; value: number; return: number }>;
  bestPerforming: { symbol: string; return: number };
  worstPerforming: { symbol: string; return: number };
} {
  // Simplified performance calculation
  const holdingReturns = portfolio.holdings.map((holding) => {
    const cost = holding.quantity * holding.averageCost;
    const currentValue = holding.quantity * holding.currentPrice;
    const returnPct = cost > 0 ? ((currentValue - cost) / cost) * 100 : 0;
    return { symbol: holding.symbol, return: returnPct };
  });

  holdingReturns.sort((a, b) => b.return - a.return);

  return {
    dailyReturns: [], // Would need historical portfolio values
    bestPerforming: holdingReturns[0] || { symbol: 'N/A', return: 0 },
    worstPerforming: holdingReturns[holdingReturns.length - 1] || { symbol: 'N/A', return: 0 },
  };
}

export function validatePortfolio(portfolio: Portfolio): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (portfolio.holdings.length === 0) {
    errors.push('Portfolio is empty');
  }

  portfolio.holdings.forEach((holding) => {
    if (holding.quantity <= 0) {
      errors.push(`Invalid quantity for ${holding.symbol}`);
    }
    if (holding.averageCost <= 0) {
      errors.push(`Invalid average cost for ${holding.symbol}`);
    }
    if (holding.currentPrice <= 0) {
      errors.push(`Invalid current price for ${holding.symbol}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
