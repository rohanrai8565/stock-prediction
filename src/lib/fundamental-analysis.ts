export type FinancialMetrics = {
  symbol: string;
  marketCap: number;
  revenue: number;
  revenueGrowth: number;
  netIncome: number;
  profitMargin: number;
  peRatio: number;
  pbRatio: number;
  debtToEquity: number;
  roe: number;
  dividendYield: number;
  eps: number;
  beta: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  avgVolume: number;
  currency: string;
};

export type EarningsReport = {
  symbol: string;
  quarter: string;
  earningsPerShare: number;
  estimatedEPS: number;
  revenue: number;
  estimatedRevenue: number;
  surprise: number;
  surprisePercentage: number;
  reportDate: string;
};

export type FinancialHealth = {
  symbol: string;
  overallScore: number; // 0-100
  profitabilityScore: number;
  growthScore: number;
  financialStrengthScore: number;
  valuationScore: number;
  efficiencyScore: number;
  rating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  analysis: string;
};

export type ValuationModel = {
  symbol: string;
  intrinsicValue: number;
  currentPrice: number;
  upside: number;
  method: string;
  confidence: number;
};

// Calculate fundamental scores based on financial metrics
export function calculateFinancialHealth(metrics: FinancialMetrics): FinancialHealth {
  let profitabilityScore = 0;
  let growthScore = 0;
  let financialStrengthScore = 0;
  let valuationScore = 0;
  let efficiencyScore = 0;

  // Profitability Score (0-20)
  if (metrics.profitMargin > 20) profitabilityScore += 5;
  else if (metrics.profitMargin > 10) profitabilityScore += 3;
  else if (metrics.profitMargin > 5) profitabilityScore += 1;

  if (metrics.roe > 20) profitabilityScore += 5;
  else if (metrics.roe > 15) profitabilityScore += 3;
  else if (metrics.roe > 10) profitabilityScore += 1;

  if (metrics.eps > 0) profitabilityScore += 5;
  if (metrics.netIncome > 0) profitabilityScore += 5;

  // Growth Score (0-20)
  if (metrics.revenueGrowth > 20) growthScore += 10;
  else if (metrics.revenueGrowth > 10) growthScore += 7;
  else if (metrics.revenueGrowth > 5) growthScore += 4;
  else if (metrics.revenueGrowth > 0) growthScore += 2;

  if (metrics.revenue > 0) growthScore += 5;
  if (metrics.netIncome > metrics.revenue * 0.1) growthScore += 5;

  // Financial Strength Score (0-20)
  if (metrics.debtToEquity < 0.5) financialStrengthScore += 8;
  else if (metrics.debtToEquity < 1) financialStrengthScore += 5;
  else if (metrics.debtToEquity < 2) financialStrengthScore += 2;

  if (metrics.marketCap > 1e9) financialStrengthScore += 6;
  else if (metrics.marketCap > 1e8) financialStrengthScore += 3;
  else if (metrics.marketCap > 1e7) financialStrengthScore += 1;

  if (metrics.avgVolume > 1e6) financialStrengthScore += 6;
  else if (metrics.avgVolume > 5e5) financialStrengthScore += 3;

  // Valuation Score (0-20)
  if (metrics.peRatio > 0 && metrics.peRatio < 15) valuationScore += 8;
  else if (metrics.peRatio > 0 && metrics.peRatio < 25) valuationScore += 5;
  else if (metrics.peRatio > 0 && metrics.peRatio < 40) valuationScore += 2;

  if (metrics.pbRatio > 0 && metrics.pbRatio < 1.5) valuationScore += 6;
  else if (metrics.pbRatio > 0 && metrics.pbRatio < 3) valuationScore += 3;
  else if (metrics.pbRatio > 0 && metrics.pbRatio < 5) valuationScore += 1;

  if (metrics.dividendYield > 3) valuationScore += 6;
  else if (metrics.dividendYield > 1) valuationScore += 3;

  // Efficiency Score (0-20)
  if (metrics.profitMargin > 15 && metrics.roe > 15) efficiencyScore += 10;
  else if (metrics.profitMargin > 10 && metrics.roe > 10) efficiencyScore += 6;
  else if (metrics.profitMargin > 5 && metrics.roe > 5) efficiencyScore += 3;

  if (metrics.revenueGrowth > 10 && metrics.profitMargin > 10) efficiencyScore += 5;
  else if (metrics.revenueGrowth > 5 && metrics.profitMargin > 5) efficiencyScore += 3;

  if (metrics.debtToEquity < 1) efficiencyScore += 5;
  else if (metrics.debtToEquity < 2) efficiencyScore += 2;

  const overallScore = profitabilityScore + growthScore + financialStrengthScore + valuationScore + efficiencyScore;

  let rating: FinancialHealth['rating'];
  let analysis: string;

  if (overallScore >= 80) {
    rating = 'Strong Buy';
    analysis = 'Excellent fundamentals across all metrics. Strong profitability, growth, and financial health.';
  } else if (overallScore >= 65) {
    rating = 'Buy';
    analysis = 'Strong fundamentals with good growth prospects and solid financial position.';
  } else if (overallScore >= 45) {
    rating = 'Hold';
    analysis = 'Mixed fundamentals. Some strengths balanced by weaknesses in key areas.';
  } else if (overallScore >= 30) {
    rating = 'Sell';
    analysis = 'Weak fundamentals with concerning metrics in multiple areas.';
  } else {
    rating = 'Strong Sell';
    analysis = 'Poor fundamentals across most metrics. Significant risks present.';
  }

  return {
    symbol: metrics.symbol,
    overallScore,
    profitabilityScore,
    growthScore,
    financialStrengthScore,
    valuationScore,
    efficiencyScore,
    rating,
    analysis,
  };
}

// DCF Valuation Model (simplified)
export function calculateDCFValuation(
  metrics: FinancialMetrics,
  discountRate: number = 0.1,
  growthRate: number = 0.05,
  years: number = 5
): ValuationModel {
  const currentPrice = metrics.fiftyTwoWeekHigh * 0.8 + metrics.fiftyTwoWeekLow * 0.2; // Approximation
  
  // Simplified DCF calculation
  let presentValue = 0;
  const freeCashFlow = metrics.netIncome * 0.8; // Approximation

  for (let i = 1; i <= years; i++) {
    const futureCashFlow = freeCashFlow * Math.pow(1 + growthRate, i);
    presentValue += futureCashFlow / Math.pow(1 + discountRate, i);
  }

  // Terminal value
  const terminalValue = (freeCashFlow * Math.pow(1 + growthRate, years)) / (discountRate - growthRate);
  presentValue += terminalValue / Math.pow(1 + discountRate, years);

  const sharesOutstanding = metrics.marketCap / currentPrice;
  const intrinsicValue = presentValue / sharesOutstanding;
  const upside = ((intrinsicValue - currentPrice) / currentPrice) * 100;

  return {
    symbol: metrics.symbol,
    intrinsicValue,
    currentPrice,
    upside,
    method: 'Discounted Cash Flow (DCF)',
    confidence: 0.7, // Simplified model has moderate confidence
  };
}

// PEG Ratio Valuation
export function calculatePEGValuation(metrics: FinancialMetrics): ValuationModel {
  const currentPrice = metrics.fiftyTwoWeekHigh * 0.8 + metrics.fiftyTwoWeekLow * 0.2;
  
  if (metrics.peRatio <= 0 || metrics.revenueGrowth <= 0) {
    return {
      symbol: metrics.symbol,
      intrinsicValue: currentPrice,
      currentPrice,
      upside: 0,
      method: 'PEG Ratio',
      confidence: 0,
    };
  }

  const pegRatio = metrics.peRatio / metrics.revenueGrowth;
  const fairPE = metrics.revenueGrowth; // PEG = 1 is fair value
  const intrinsicValue = (fairPE * metrics.eps);
  const upside = ((intrinsicValue - currentPrice) / currentPrice) * 100;

  return {
    symbol: metrics.symbol,
    intrinsicValue,
    currentPrice,
    upside,
    method: 'PEG Ratio',
    confidence: pegRatio < 1 ? 0.8 : pegRatio < 1.5 ? 0.6 : 0.4,
  };
}

// Graham Number Valuation (defensive value investing)
export function calculateGrahamNumber(metrics: FinancialMetrics): ValuationModel {
  const currentPrice = metrics.fiftyTwoWeekHigh * 0.8 + metrics.fiftyTwoWeekLow * 0.2;
  
  if (metrics.eps <= 0 || metrics.pbRatio <= 0) {
    return {
      symbol: metrics.symbol,
      intrinsicValue: currentPrice,
      currentPrice,
      upside: 0,
      method: 'Graham Number',
      confidence: 0,
    };
  }

  const bookValuePerShare = currentPrice / metrics.pbRatio;
  const grahamNumber = Math.sqrt(22.5 * metrics.eps * bookValuePerShare);
  const upside = ((grahamNumber - currentPrice) / currentPrice) * 100;

  return {
    symbol: metrics.symbol,
    intrinsicValue: grahamNumber,
    currentPrice,
    upside,
    method: 'Graham Number',
    confidence: 0.75,
  };
}

// Aggregate multiple valuation models
export function getConsensusValuation(metrics: FinancialMetrics): {
  consensusValue: number;
  consensusUpside: number;
  models: ValuationModel[];
  confidence: number;
} {
  const models = [
    calculateDCFValuation(metrics),
    calculatePEGValuation(metrics),
    calculateGrahamNumber(metrics),
  ].filter((model) => model.confidence > 0);

  if (models.length === 0) {
    return {
      consensusValue: metrics.fiftyTwoWeekHigh * 0.8 + metrics.fiftyTwoWeekLow * 0.2,
      consensusUpside: 0,
      models: [],
      confidence: 0,
    };
  }

  const weightedSum = models.reduce((sum, model) => sum + model.intrinsicValue * model.confidence, 0);
  const totalWeight = models.reduce((sum, model) => sum + model.confidence, 0);
  const consensusValue = weightedSum / totalWeight;
  
  const currentPrice = metrics.fiftyTwoWeekHigh * 0.8 + metrics.fiftyTwoWeekLow * 0.2;
  const consensusUpside = ((consensusValue - currentPrice) / currentPrice) * 100;
  const confidence = totalWeight / models.length;

  return {
    consensusValue,
    consensusUpside,
    models,
    confidence,
  };
}

// Compare with sector averages (mock data)
export function compareWithSector(
  metrics: FinancialMetrics,
  sector: string
): {
  symbol: string;
  sector: string;
  comparisons: Array<{ metric: string; value: number; sectorAverage: number; difference: string }>;
  overallComparison: 'Above Average' | 'Average' | 'Below Average';
} {
  // Mock sector averages (in production, fetch from database)
  const sectorAverages: Record<string, any> = {
    'Technology': { peRatio: 25, pbRatio: 5, profitMargin: 15, roe: 18, debtToEquity: 0.3 },
    'Healthcare': { peRatio: 20, pbRatio: 3, profitMargin: 12, roe: 15, debtToEquity: 0.4 },
    'Finance': { peRatio: 12, pbRatio: 1.2, profitMargin: 10, roe: 12, debtToEquity: 1.5 },
    'Consumer': { peRatio: 18, pbRatio: 2.5, profitMargin: 8, roe: 14, debtToEquity: 0.6 },
    'Energy': { peRatio: 15, pbRatio: 1.5, profitMargin: 6, roe: 10, debtToEquity: 0.8 },
    'Industrial': { peRatio: 16, pbRatio: 2, profitMargin: 7, roe: 11, debtToEquity: 0.7 },
  };

  const averages = sectorAverages[sector] || sectorAverages['Technology'];
  
  const comparisons = [
    {
      metric: 'P/E Ratio',
      value: metrics.peRatio,
      sectorAverage: averages.peRatio,
      difference: ((metrics.peRatio - averages.peRatio) / averages.peRatio * 100).toFixed(1) + '%',
    },
    {
      metric: 'P/B Ratio',
      value: metrics.pbRatio,
      sectorAverage: averages.pbRatio,
      difference: ((metrics.pbRatio - averages.pbRatio) / averages.pbRatio * 100).toFixed(1) + '%',
    },
    {
      metric: 'Profit Margin',
      value: metrics.profitMargin,
      sectorAverage: averages.profitMargin,
      difference: ((metrics.profitMargin - averages.profitMargin) / averages.profitMargin * 100).toFixed(1) + '%',
    },
    {
      metric: 'ROE',
      value: metrics.roe,
      sectorAverage: averages.roe,
      difference: ((metrics.roe - averages.roe) / averages.roe * 100).toFixed(1) + '%',
    },
    {
      metric: 'Debt/Equity',
      value: metrics.debtToEquity,
      sectorAverage: averages.debtToEquity,
      difference: ((metrics.debtToEquity - averages.debtToEquity) / averages.debtToEquity * 100).toFixed(1) + '%',
    },
  ];

  const aboveAverageCount = comparisons.filter(
    (c) => (c.metric === 'Profit Margin' || c.metric === 'ROE') && parseFloat(c.difference) > 0
  ).length;

  let overallComparison: 'Above Average' | 'Average' | 'Below Average';
  if (aboveAverageCount >= 3) overallComparison = 'Above Average';
  else if (aboveAverageCount >= 1) overallComparison = 'Average';
  else overallComparison = 'Below Average';

  return {
    symbol: metrics.symbol,
    sector,
    comparisons,
    overallComparison,
  };
}

// Generate mock financial data (replace with real API in production)
export function generateMockFinancialMetrics(symbol: string): FinancialMetrics {
  const basePrice = Math.random() * 200 + 50;
  const marketCap = basePrice * (Math.random() * 1e8 + 1e7);
  
  return {
    symbol,
    marketCap,
    revenue: marketCap * (Math.random() * 2 + 0.5),
    revenueGrowth: Math.random() * 30 - 5,
    netIncome: marketCap * (Math.random() * 0.2 - 0.02),
    profitMargin: Math.random() * 25 - 2,
    peRatio: Math.random() * 40 + 5,
    pbRatio: Math.random() * 5 + 0.5,
    debtToEquity: Math.random() * 2,
    roe: Math.random() * 25 - 2,
    dividendYield: Math.random() * 5,
    eps: basePrice / (Math.random() * 30 + 10),
    beta: Math.random() * 1.5 + 0.5,
    fiftyTwoWeekHigh: basePrice * 1.3,
    fiftyTwoWeekLow: basePrice * 0.7,
    avgVolume: Math.random() * 5e6 + 1e5,
    currency: 'USD',
  };
}

export function generateMockEarningsReport(symbol: string): EarningsReport {
  const estimatedEPS = Math.random() * 3 + 0.5;
  const actualEPS = estimatedEPS * (Math.random() * 0.4 - 0.15);
  const estimatedRevenue = Math.random() * 1e9 + 1e8;
  const actualRevenue = estimatedRevenue * (Math.random() * 0.3 - 0.1);

  return {
    symbol,
    quarter: `Q${Math.floor(Math.random() * 4) + 1} ${2024}`,
    earningsPerShare: actualEPS,
    estimatedEPS,
    revenue: actualRevenue,
    estimatedRevenue,
    surprise: actualEPS - estimatedEPS,
    surprisePercentage: ((actualEPS - estimatedEPS) / estimatedEPS) * 100,
    reportDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
