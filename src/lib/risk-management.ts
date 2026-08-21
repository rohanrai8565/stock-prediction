export type RiskMetrics = {
  symbol: string;
  volatility: number;
  beta: number;
  valueAtRisk: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  riskScore: number; // 0-100
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High';
};

export type PositionSize = {
  symbol: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPerShare: number;
  rewardPerShare: number;
  riskRewardRatio: number;
  suggestedPositionSize: number;
  positionValue: number;
  portfolioPercentage: number;
};

export type PortfolioRisk = {
  totalValue: number;
  totalRisk: number;
  diversifiedRisk: number;
  concentrationRisk: number;
  largestPosition: number;
  betaWeighted: number;
  overallRiskScore: number;
  recommendations: string[];
};

// Calculate risk metrics from price history
export function calculateRiskMetrics(
  prices: number[],
  riskFreeRate: number = 0.02
): Omit<RiskMetrics, 'symbol' | 'riskLevel'> {
  if (prices.length < 20) {
    return {
      volatility: 0,
      beta: 1,
      valueAtRisk: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      riskScore: 50,
    };
  }

  // Calculate daily returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i]! - prices[i - 1]!) / prices[i - 1]!);
  }

  // Volatility (annualized standard deviation)
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized

  // Beta (simplified - would need market returns for accurate calculation)
  const beta = 1 + (Math.random() * 0.5 - 0.25); // Mock beta around 1

  // Value at Risk (95% confidence)
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const var95 = sortedReturns[Math.floor(sortedReturns.length * 0.05)] || 0;
  const valueAtRisk = Math.abs(var95);

  // Maximum Drawdown
  let maxDrawdown = 0;
  let peak = prices[0]!;
  for (const price of prices) {
    if (price > peak) peak = price;
    const drawdown = (peak - price) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Sharpe Ratio
  const excessReturns = returns.map((r) => r - riskFreeRate / 252);
  const excessMean = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length;
  const excessStd = Math.sqrt(
    excessReturns.reduce((sum, r) => sum + Math.pow(r - excessMean, 2), 0) / excessReturns.length
  );
  const sharpeRatio = excessStd > 0 ? (excessMean * Math.sqrt(252)) / excessStd : 0;

  // Sortino Ratio (downside deviation)
  const downsideReturns = returns.filter((r) => r < 0);
  const downsideMean =
    downsideReturns.length > 0 ? downsideReturns.reduce((sum, r) => sum + r, 0) / downsideReturns.length : 0;
  const downsideDeviation =
    downsideReturns.length > 0
      ? Math.sqrt(
          downsideReturns.reduce((sum, r) => sum + Math.pow(r - downsideMean, 2), 0) / downsideReturns.length
        )
      : 0;
  const sortinoRatio = downsideDeviation > 0 ? (excessMean * Math.sqrt(252)) / downsideDeviation : 0;

  // Risk Score (0-100, higher = riskier)
  let riskScore = 0;
  riskScore += Math.min(volatility * 100, 30); // Volatility contribution
  riskScore += Math.min(maxDrawdown * 100, 25); // Drawdown contribution
  riskScore += Math.abs(beta - 1) * 10; // Beta contribution
  riskScore += valueAtRisk * 100; // VaR contribution
  riskScore = Math.min(riskScore, 100);

  return {
    volatility,
    beta,
    valueAtRisk,
    maxDrawdown,
    sharpeRatio,
    sortinoRatio,
    riskScore,
  };
}

export function getRiskLevel(riskScore: number): RiskMetrics['riskLevel'] {
  if (riskScore < 25) return 'Low';
  if (riskScore < 50) return 'Medium';
  if (riskScore < 75) return 'High';
  return 'Very High';
}

// Calculate optimal position size based on risk
export function calculatePositionSize(
  entryPrice: number,
  stopLoss: number,
  portfolioValue: number,
  riskPerTrade: number = 0.02, // 2% risk per trade
  maxPositionSize: number = 0.1 // Max 10% of portfolio
): PositionSize {
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const rewardPerShare = entryPrice * 1.2 - entryPrice; // Default 20% target
  const takeProfit = entryPrice + rewardPerShare;
  const riskRewardRatio = rewardPerShare / riskPerShare;

  // Calculate position size based on risk
  const riskAmount = portfolioValue * riskPerTrade;
  const suggestedShares = Math.floor(riskAmount / riskPerShare);
  const positionValue = suggestedShares * entryPrice;
  const portfolioPercentage = positionValue / portfolioValue;

  // Cap position size
  const cappedShares = Math.min(suggestedShares, Math.floor((portfolioValue * maxPositionSize) / entryPrice));
  const cappedPositionValue = cappedShares * entryPrice;
  const cappedPortfolioPercentage = cappedPositionValue / portfolioValue;

  return {
    symbol: '',
    entryPrice,
    stopLoss,
    takeProfit,
    riskPerShare,
    rewardPerShare,
    riskRewardRatio,
    suggestedPositionSize: cappedShares,
    positionValue: cappedPositionValue,
    portfolioPercentage: cappedPortfolioPercentage * 100,
  };
}

// Calculate portfolio-level risk
export function calculatePortfolioRisk(
  positions: Array<{ symbol: string; value: number; beta: number }>,
  totalValue: number
): PortfolioRisk {
  const totalRisk = positions.reduce((sum, pos) => sum + pos.value * Math.abs(pos.beta), 0) / totalValue;
  
  // Concentration risk (largest position as % of portfolio)
  const largestPosition = Math.max(...positions.map((p) => p.value / totalValue));
  const concentrationRisk = largestPosition > 0.2 ? largestPosition * 100 : 0;

  // Diversified risk (inverse of concentration)
  const diversifiedRisk = 100 - concentrationRisk;

  // Beta-weighted portfolio
  const betaWeighted = positions.reduce((sum, pos) => sum + (pos.value / totalValue) * pos.beta, 0);

  // Overall risk score
  let overallRiskScore = 0;
  overallRiskScore += totalRisk * 30;
  overallRiskScore += concentrationRisk * 40;
  overallRiskScore += Math.abs(betaWeighted - 1) * 20;
  overallRiskScore = Math.min(overallRiskScore, 100);

  // Generate recommendations
  const recommendations: string[] = [];
  if (largestPosition > 0.25) {
    recommendations.push(`Consider reducing position in largest holding (${(largestPosition * 100).toFixed(1)}%) to improve diversification.`);
  }
  if (betaWeighted > 1.3) {
    recommendations.push('Portfolio beta is high. Consider adding defensive positions to reduce volatility.');
  } else if (betaWeighted < 0.7) {
    recommendations.push('Portfolio beta is low. Consider adding growth positions to improve returns.');
  }
  if (concentrationRisk > 30) {
    recommendations.push('High concentration risk. Diversify across different sectors and asset classes.');
  }
  if (overallRiskScore > 70) {
    recommendations.push('Overall portfolio risk is high. Review position sizes and consider reducing exposure.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Portfolio risk profile looks balanced. Continue monitoring.');
  }

  return {
    totalValue,
    totalRisk: totalRisk * 100,
    diversifiedRisk,
    concentrationRisk,
    largestPosition: largestPosition * 100,
    betaWeighted,
    overallRiskScore,
    recommendations,
  };
}

// Monte Carlo simulation for risk assessment
export function monteCarloRisk(
  initialPrice: number,
  drift: number,
  volatility: number,
  days: number = 252,
  simulations: number = 1000
): {
  expectedFinalPrice: number;
  medianFinalPrice: number;
  percentiles: Array<{ percentile: number; price: number }>;
  probabilityOfProfit: number;
} {
  const finalPrices: number[] = [];

  for (let i = 0; i < simulations; i++) {
    let price = initialPrice;
    for (let d = 0; d < days; d++) {
      const randomShock = (Math.random() - 0.5) * 2; // Standard normal approximation
      price = price * Math.exp((drift - 0.5 * volatility * volatility) + volatility * randomShock);
    }
    finalPrices.push(price);
  }

  finalPrices.sort((a, b) => a - b);

  const expectedFinalPrice = finalPrices.reduce((sum, p) => sum + p, 0) / finalPrices.length;
  const medianFinalPrice = finalPrices[Math.floor(finalPrices.length / 2)] || expectedFinalPrice;
  const probabilityOfProfit = finalPrices.filter((p) => p > initialPrice).length / finalPrices.length;

  const percentiles = [
    { percentile: 5, price: finalPrices[Math.floor(finalPrices.length * 0.05)] || initialPrice },
    { percentile: 25, price: finalPrices[Math.floor(finalPrices.length * 0.25)] || initialPrice },
    { percentile: 50, price: medianFinalPrice },
    { percentile: 75, price: finalPrices[Math.floor(finalPrices.length * 0.75)] || initialPrice },
    { percentile: 95, price: finalPrices[Math.floor(finalPrices.length * 0.95)] || initialPrice },
  ];

  return {
    expectedFinalPrice,
    medianFinalPrice,
    percentiles,
    probabilityOfProfit,
  };
}

// Correlation analysis (simplified)
export function calculateCorrelation(returns1: number[], returns2: number[]): number {
  if (returns1.length !== returns2.length || returns1.length === 0) return 0;

  const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
  const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;

  let covariance = 0;
  let variance1 = 0;
  let variance2 = 0;

  for (let i = 0; i < returns1.length; i++) {
    const diff1 = returns1[i]! - mean1;
    const diff2 = returns2[i]! - mean2;
    covariance += diff1 * diff2;
    variance1 += diff1 * diff1;
    variance2 += diff2 * diff2;
  }

  covariance /= returns1.length;
  variance1 /= returns1.length;
  variance2 /= returns1.length;

  if (variance1 === 0 || variance2 === 0) return 0;
  return covariance / Math.sqrt(variance1 * variance2);
}

// Stress testing scenarios
export function stressTestPortfolio(
  portfolioValue: number,
  positions: Array<{ symbol: string; value: number; beta: number }>,
  scenarios: Array<{ name: string; marketChange: number; description: string }>
): Array<{ name: string; description: string; portfolioImpact: number; worstPosition: string }> {
  return scenarios.map((scenario) => {
    let portfolioImpact = 0;
    let worstPosition = '';
    let worstImpact = 0;

    positions.forEach((position) => {
      const positionImpact = position.value * scenario.marketChange * position.beta;
      portfolioImpact += positionImpact;

      if (Math.abs(positionImpact) > worstImpact) {
        worstImpact = Math.abs(positionImpact);
        worstPosition = position.symbol;
      }
    });

    return {
      name: scenario.name,
      description: scenario.description,
      portfolioImpact: (portfolioImpact / portfolioValue) * 100,
      worstPosition,
    };
  });
}

export function getDefaultStressScenarios(): Array<{ name: string; marketChange: number; description: string }> {
  return [
    { name: 'Market Crash', marketChange: -0.3, description: '30% market decline' },
    { name: 'Bear Market', marketChange: -0.2, description: '20% market decline' },
    { name: 'Correction', marketChange: -0.1, description: '10% market decline' },
    { name: 'Moderate Growth', marketChange: 0.05, description: '5% market increase' },
    { name: 'Bull Market', marketChange: 0.15, description: '15% market increase' },
    { name: 'Market Boom', marketChange: 0.25, description: '25% market increase' },
  ];
}
