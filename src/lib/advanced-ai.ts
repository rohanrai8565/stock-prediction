export type ConversationMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export type ConversationContext = {
  symbol: string;
  symbolName: string;
  currentPrice: number;
  dailyChange: number;
  rsi: number | null;
  sentiment: number;
  indicators: {
    sma20: number | null;
    macd: number | null;
    bbUpper: number | null;
    bbLower: number | null;
  };
  prediction: {
    predictedPrice: number;
    percentChange: number;
    direction: 'UP' | 'DOWN' | 'FLAT';
    confidence: number;
  } | null;
};

export type ConversationMemory = {
  userId: string;
  conversations: Map<string, ConversationMessage[]>;
  context: ConversationContext | null;
  lastUpdated: string;
};

class AdvancedAIAssistant {
  private memory: Map<string, ConversationMemory> = new Map();
  private maxConversationLength = 20;
  private maxMemoryAge = 24 * 60 * 60 * 1000; // 24 hours

  private getConversationKey(userId: string, symbol: string): string {
    return `${userId}_${symbol}`;
  }

  private cleanOldMessages(messages: ConversationMessage[]): ConversationMessage[] {
    const now = Date.now();
    return messages.filter(msg => now - new Date(msg.timestamp).getTime() < this.maxMemoryAge);
  }

  private trimConversation(messages: ConversationMessage[]): ConversationMessage[] {
    if (messages.length <= this.maxConversationLength) {
      return messages;
    }
    const systemMessage = messages.find(m => m.role === 'system');
    const recentMessages = messages.slice(-this.maxConversationLength + 1);
    return systemMessage ? [systemMessage, ...recentMessages.filter(m => m.role !== 'system')] : recentMessages;
  }

  addToConversation(userId: string, symbol: string, message: ConversationMessage): void {
    const key = this.getConversationKey(userId, symbol);
    let memory = this.memory.get(key);

    if (!memory) {
      memory = {
        userId,
        conversations: new Map(),
        context: null,
        lastUpdated: new Date().toISOString(),
      };
      this.memory.set(key, memory);
    }

    let messages = memory.conversations.get(symbol) || [];
    messages.push(message);
    messages = this.cleanOldMessages(messages);
    messages = this.trimConversation(messages);
    memory.conversations.set(symbol, messages);
    memory.lastUpdated = new Date().toISOString();
  }

  getConversation(userId: string, symbol: string): ConversationMessage[] {
    const key = this.getConversationKey(userId, symbol);
    const memory = this.memory.get(key);
    return memory?.conversations.get(symbol) || [];
  }

  updateContext(userId: string, symbol: string, context: ConversationContext): void {
    const key = this.getConversationKey(userId, symbol);
    let memory = this.memory.get(key);

    if (!memory) {
      memory = {
        userId,
        conversations: new Map(),
        context: null,
        lastUpdated: new Date().toISOString(),
      };
      this.memory.set(key, memory);
    }

    memory.context = context;
    memory.lastUpdated = new Date().toISOString();
  }

  getContext(userId: string, symbol: string): ConversationContext | null {
    const key = this.getConversationKey(userId, symbol);
    return this.memory.get(key)?.context || null;
  }

  clearConversation(userId: string, symbol: string): void {
    const key = this.getConversationKey(userId, symbol);
    const memory = this.memory.get(key);
    if (memory) {
      memory.conversations.delete(symbol);
      memory.lastUpdated = new Date().toISOString();
    }
  }

  clearAllUserMemory(userId: string): void {
    for (const [key, memory] of this.memory.entries()) {
      if (memory.userId === userId) {
        this.memory.delete(key);
      }
    }
  }

  buildSystemPrompt(context: ConversationContext): string {
    const { symbol, symbolName, currentPrice, dailyChange, rsi, sentiment, indicators, prediction } = context;
    
    let prompt = `You are an advanced AI-powered stock research assistant with expertise in technical analysis, fundamental analysis, and market sentiment analysis. Your role is to provide comprehensive, educational, and actionable insights while maintaining strict adherence to financial compliance guidelines.

CURRENT MARKET DATA FOR ${symbol} (${symbolName}):
- Current Price: ${currentPrice}
- Daily Change: ${dailyChange.toFixed(2)}%
- RSI (14): ${rsi ? rsi.toFixed(1) : 'N/A'} ${rsi ? (rsi > 70 ? '(Overbought)' : rsi < 30 ? '(Oversold)' : '(Neutral)') : ''}
- News Sentiment: ${sentiment.toFixed(3)} ${sentiment > 0.2 ? '(Bullish)' : sentiment < -0.2 ? '(Bearish)' : '(Neutral)'}
- Technical Indicators:
  * SMA20: ${indicators.sma20 ? indicators.sma20.toFixed(2) : 'N/A'}
  * MACD: ${indicators.macd ? indicators.macd.toFixed(4) : 'N/A'}
  * Bollinger Bands: ${indicators.bbUpper && indicators.bbLower ? `Upper: ${indicators.bbUpper.toFixed(2)}, Lower: ${indicators.bbLower.toFixed(2)}` : 'N/A'}`;

    if (prediction) {
      prompt += `- AI Prediction: ${prediction.predictedPrice.toFixed(2)} (${prediction.direction}) with ${prediction.confidence.toFixed(1)}% confidence`;
    }

    prompt += `

CAPABILITIES:
1. Technical Analysis: Explain chart patterns, indicators, and technical signals
2. Fundamental Analysis: Discuss valuation metrics, financial health, and business fundamentals
3. Sentiment Analysis: Interpret news sentiment and social media trends
4. Risk Assessment: Evaluate investment risks, volatility, and position sizing
5. Strategy Discussion: Explain trading strategies, backtesting, and performance metrics
6. Educational Content: Teach financial concepts, market mechanics, and investment principles

GUIDELINES:
- Provide detailed, well-structured responses with clear sections
- Use specific data points from the market data provided
- Explain the reasoning behind your analysis
- Highlight uncertainties and limitations in your analysis
- Never provide specific investment advice or recommendations
- Always include appropriate disclaimers
- Be conversational but professional in tone
- Ask follow-up questions to better understand the user's needs
- Provide context and background information when relevant

Remember: You are an educational tool, not a financial advisor. Always emphasize that your analysis is for informational purposes only and should not be considered as investment advice.`;

    return prompt;
  }

  generateLocalResponse(message: string, context: ConversationContext): string {
    const question = message.toLowerCase();
    const { symbol, symbolName, currentPrice, dailyChange, rsi, sentiment, prediction } = context;
    
    if (question.includes('buy') || question.includes('sell') || question.includes('invest') || question.includes('trade')) {
      return this.generateInvestmentAdviceResponse(message, context);
    }
    
    if (question.includes('predict') || question.includes('forecast') || question.includes('price target')) {
      return this.generatePredictionResponse(message, context);
    }
    
    if (question.includes('technical') || question.includes('indicator') || question.includes('rsi') || question.includes('macd')) {
      return this.generateTechnicalAnalysisResponse(message, context);
    }
    
    if (question.includes('sentiment') || question.includes('news') || question.includes('bullish') || question.includes('bearish')) {
      return this.generateSentimentAnalysisResponse(message, context);
    }
    
    if (question.includes('risk') || question.includes('safe') || question.includes('dangerous') || question.includes('volatile')) {
      return this.generateRiskAnalysisResponse(message, context);
    }
    
    if (question.includes('fundamental') || question.includes('valuation') || question.includes('pe ratio') || question.includes('earnings')) {
      return this.generateFundamentalAnalysisResponse(message, context);
    }
    
    if (question.includes('strategy') || question.includes('backtest') || question.includes('trading strategy')) {
      return this.generateStrategyResponse(message, context);
    }
    
    return this.generateComprehensiveResponse(message, context);
  }

  private generateInvestmentAdviceResponse(message: string, context: ConversationContext): string {
    const { symbol, symbolName, currentPrice, dailyChange, rsi, sentiment, prediction } = context;
    
    return `## Investment Analysis for ${symbol} (${symbolName})

⚠️ IMPORTANT DISCLAIMER: I cannot provide investment advice or tell you whether to buy or sell ${symbol}. The following analysis is for educational purposes only.

### Current Market Status
- Current Price: ${currentPrice.toFixed(2)}
- Daily Change: ${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)}%
- RSI (14): ${rsi ? rsi.toFixed(1) : 'N/A'} ${rsi ? (rsi > 70 ? '(Overbought - potential reversal signal)' : rsi < 30 ? '(Oversold - potential bounce opportunity)' : '(Neutral - no clear signal)') : ''}
- Sentiment: ${sentiment.toFixed(3)} ${sentiment > 0.2 ? '(Bullish)' : sentiment < -0.2 ? '(Bearish)' : '(Neutral)'}

### Technical Analysis
${rsi ? `RSI Analysis: ${rsi > 70 ? 'The RSI indicates the stock may be overbought, suggesting a potential pullback.' : rsi < 30 ? 'The RSI indicates the stock may be oversold, suggesting a potential bounce.' : 'The RSI is in neutral territory, indicating no clear directional signal.'}` : ''}

### Risk Considerations
- Market Risk: Stock prices are inherently volatile and can move significantly in short periods
- Model Risk: AI predictions have uncertainty and should not be relied upon for trading decisions
- Sentiment Risk: News sentiment can change rapidly and may not reflect fundamental value
- Timing Risk: Even if the long-term direction is correct, short-term timing can be challenging

### What You Should Consider
1. Your Risk Tolerance: Only invest what you can afford to lose
2. Diversification: Don't concentrate your portfolio in a single stock
3. Research: Conduct thorough fundamental and technical analysis
4. Professional Advice: Consult with a licensed financial advisor
5. Position Sizing: Use proper risk management (typically 1-2% per trade)

### Recommendation
I cannot recommend buying or selling ${symbol}. You should:
- Conduct your own research
- Consider your financial situation and risk tolerance
- Consult with a qualified financial advisor
- Never make investment decisions based solely on AI predictions

Remember: This analysis is educational only and not financial advice. Past performance does not guarantee future results.`;
  }

  private generatePredictionResponse(message: string, context: ConversationContext): string {
    const { symbol, symbolName, currentPrice, prediction } = context;
    
    if (!prediction) {
      return `## Price Prediction for ${symbol} (${symbolName})

To generate a price prediction for ${symbol}, please click the "Train & predict" button in the dashboard. This will load historical data, calculate technical indicators, analyze news sentiment, and train an LSTM model to generate price forecasts.

### Prediction Methodology
The system uses a Long Short-Term Memory (LSTM) neural network that combines:
- Technical Indicators: Price patterns, momentum, volatility measures
- News Sentiment: Financial news sentiment analysis
- Backtesting: Historical accuracy metrics to evaluate model performance

### Important Notes
- Predictions are uncertain and should not be used for trading decisions
- The model is trained on historical data and may not capture current market conditions
- Backtest accuracy doesn't guarantee future performance
- Market conditions can change rapidly, making historical patterns less relevant

### How to Use Predictions
1. Educational Tool: Use predictions to understand ML applications in finance
2. Research Aid: Compare predictions with your own analysis
3. Strategy Testing: Use predictions to test trading strategies (paper trading only)
4. Learning: Study how different factors affect price movements

### Disclaimer
⚠️ This is not financial advice. Never make investment decisions based solely on AI predictions. Always conduct your own research and consult with financial professionals.`;
    }
    
    return `## Price Prediction for ${symbol} (${symbolName})

### AI Model Prediction
- Current Price: ${currentPrice.toFixed(2)}
- Predicted Price: ${prediction.predictedPrice.toFixed(2)}
- Expected Change: ${prediction.percentChange >= 0 ? '+' : ''}${prediction.percentChange.toFixed(2)}%
- Direction: ${prediction.direction}
- Model Confidence: ${prediction.confidence.toFixed(1)}%

### Analysis
The AI model predicts that ${symbol} will move ${prediction.direction} by ${Math.abs(prediction.percentChange).toFixed(2)}% over the forecast period.

### Technical Context
${prediction.direction === 'UP' ? 'The bullish prediction is based on the model\'s analysis of technical indicators and market sentiment. However, this should be validated against your own technical analysis.' : 'The bearish prediction suggests potential downside based on the model\'s analysis. Consider this alongside your own research and risk tolerance.'}

### Confidence Assessment
The model has ${prediction.confidence.toFixed(1)}% confidence in this prediction. This means:
- Higher confidence suggests the model has seen similar patterns in historical data
- Lower confidence indicates higher uncertainty in the prediction
- Confidence does not guarantee accuracy - it's a measure of model certainty, not prediction quality

### Important Limitations
- Historical Bias: The model is trained on past data, which may not predict future events
- Market Changes: Sudden market events (earnings, news, economic changes) can invalidate predictions
- Model Uncertainty: Even high-confidence predictions can be wrong
- Time Horizon: Predictions become less accurate over longer time periods

### Risk Warning
⚠️ This prediction is for educational purposes only and should not be used for trading decisions. The stock market is inherently unpredictable, and AI models cannot account for all factors that affect prices.

### Recommended Actions
1. Use as Research: Treat this as one data point among many in your analysis
2. Validate Independently: Conduct your own technical and fundamental analysis
3. Paper Trade First: Test strategies without real money
4. Risk Management: Never risk more than you can afford to lose
5. Professional Advice: Consult with financial advisors before making investment decisions

Remember: This is not financial advice. Past performance does not guarantee future results.`;
  }

  private generateTechnicalAnalysisResponse(message: string, context: ConversationContext): string {
    const { symbol, symbolName, currentPrice, rsi, indicators } = context;
    
    return `## Technical Analysis for ${symbol} (${symbolName})

### Current Price: ${currentPrice.toFixed(2)}

### Key Technical Indicators

#### RSI (Relative Strength Index) - 14 Period
- Current: ${rsi ? rsi.toFixed(1) : 'N/A'}
- Signal: ${rsi ? (rsi > 70 ? '🔴 OVERBOUGHT - Potential pullback signal' : rsi < 30 ? '🟢 OVERSOLD - Potential bounce opportunity' : '🟡 NEUTRAL - No clear directional signal') : 'N/A'}
- Interpretation: ${rsi ? (rsi > 70 ? 'The RSI suggests the stock may be overextended to the upside. Traders often look for reversals when RSI exceeds 70.' : rsi < 30 ? 'The RSI suggests the stock may be oversold. This can present buying opportunities for contrarian traders.' : 'The RSI is in neutral territory, indicating balanced buying and selling pressure.') : ''}

#### Moving Averages
- SMA 20: ${indicators.sma20 ? indicators.sma20.toFixed(2) : 'N/A'}
- Interpretation: ${currentPrice > (indicators.sma20 || 0) ? 'Price is above the 20-day SMA, which is generally considered bullish for short-term trends.' : 'Price is below the 20-day SMA, which is generally considered bearish for short-term trends.'}

#### MACD (Moving Average Convergence Divergence)
- Current: ${indicators.macd ? indicators.macd.toFixed(4) : 'N/A'}
- Interpretation: ${indicators.macd && indicators.macd > 0 ? 'Positive MACD suggests bullish momentum.' : indicators.macd && indicators.macd < 0 ? 'Negative MACD suggests bearish momentum.' : 'MACD is neutral, indicating no clear momentum signal.'}

#### Bollinger Bands
- Upper Band: ${indicators.bbUpper ? indicators.bbUpper.toFixed(2) : 'N/A'}
- Lower Band: ${indicators.bbLower ? indicators.bbLower.toFixed(2) : 'N/A'}
- Position: ${currentPrice > (indicators.bbUpper || 0) ? 'Price is above the upper Bollinger Band, suggesting overbought conditions.' : currentPrice < (indicators.bbLower || 0) ? 'Price is below the lower Bollinger Band, suggesting oversold conditions.' : 'Price is within the Bollinger Bands, indicating normal trading range.'}

### Advanced Indicators Available
The system also calculates:
- ATR (14): Average True Range for volatility measurement
- Stochastic Oscillator: Momentum indicator with %K and %D lines
- Williams %R: Overbought/oversold indicator
- Ichimoku Cloud: Trend-following system

### Technical Analysis Summary
Based on the current indicators:
- Trend: ${currentPrice > (indicators.sma20 || 0) ? 'Short-term uptrend (price above SMA20)' : 'Short-term downtrend (price below SMA20)'}
- Momentum: ${rsi && rsi > 50 ? 'Bullish momentum (RSI > 50)' : rsi && rsi < 50 ? 'Bearish momentum (RSI < 50)' : 'Neutral momentum'}
- Volatility: Check the ATR indicator in the Advanced Indicators section for volatility levels

### Trading Considerations
- Multiple Indicators: Always consider multiple indicators, not just one
- False Signals: Technical indicators can generate false signals, especially in choppy markets
- Confirmation: Look for confirmation across different timeframes and indicators
- Risk Management: Always use stop-losses and proper position sizing

### Disclaimer
⚠️ Technical analysis is not a guarantee of future performance. Always combine technical analysis with fundamental analysis and proper risk management. This is for educational purposes only and not financial advice.`;
  }

  private generateSentimentAnalysisResponse(message: string, context: ConversationContext): string {
    const { symbol, symbolName, sentiment, dailyChange } = context;
    
    return `## Sentiment Analysis for ${symbol} (${symbolName})

### Current Sentiment Score: ${sentiment.toFixed(3)}
Classification: ${sentiment > 0.2 ? '🟢 BULLISH - Positive market sentiment' : sentiment < -0.2 ? '🔴 BEARISH - Negative market sentiment' : '🟡 NEUTRAL - Balanced market sentiment'}

### What Sentiment Analysis Tells Us
Sentiment analysis measures the emotional tone of news and social media discussions about ${symbol}:

#### Positive Sentiment
- Suggests optimism among investors and analysts
- May indicate positive news flow or strong fundamentals
- Can be a leading indicator but can also signal excessive optimism

#### Negative Sentiment
- Indicates pessimism or fear in the market
- May result from negative news, earnings disappointments, or broader market concerns
- Can present buying opportunities if fundamentals remain strong

#### Neutral Sentiment
- Suggests balanced information flow
- May indicate consolidation phase or lack of strong catalysts
- Often precedes significant moves when new information emerges

### Price vs Sentiment Correlation
- Current Price Change: ${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)}%
- Sentiment: ${sentiment > 0 ? 'Positive' : sentiment < 0 ? 'Negative' : 'Neutral'}
- Alignment: ${dailyChange > 0 && sentiment > 0 ? 'Price and sentiment are aligned (both positive)' : dailyChange < 0 && sentiment < 0 ? 'Price and sentiment are aligned (both negative)' : 'Price and sentiment are diverging - this could indicate a reversal opportunity'}

### Limitations of Sentiment Analysis
1. Noise: Social media sentiment can be noisy and not representative
2. Lag: News sentiment often lags price movements
3. Manipulation: Sentiment can be manipulated or influenced by coordinated campaigns
4. Context: Same sentiment score can have different implications in different market conditions

### Using Sentiment in Your Analysis
- Confluence: Look for sentiment confirmation with technical signals
- Divergence: Price-sentiment divergences can signal reversals
- Trend: Monitor sentiment trends over time, not just current levels
- Context: Consider sentiment in the context of broader market conditions

### Disclaimer
⚠️ Sentiment analysis is a supplementary tool and should not be used in isolation. Always combine sentiment analysis with fundamental and technical analysis. This is educational content only and not financial advice.`;
  }

  private generateRiskAnalysisResponse(message: string, context: ConversationContext): string {
    const { symbol, symbolName, currentPrice, dailyChange, rsi } = context;
    
    return `## Risk Analysis for ${symbol} (${symbolName})

### Current Risk Assessment

#### Price Volatility Risk
- Daily Change: ${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)}%
- Volatility Level: ${Math.abs(dailyChange) > 2 ? '🔴 HIGH - Large daily moves' : Math.abs(dailyChange) > 1 ? '🟡 MODERATE - Normal daily variation' : '🟢 LOW - Stable price action'}

#### Technical Risk
- RSI Risk: ${rsi ? (rsi > 70 ? 'Overbought conditions suggest potential pullback risk' : rsi < 30 ? 'Oversold conditions suggest potential bounce risk' : 'Neutral technical conditions') : 'N/A'}

### Key Risk Factors

#### 1. Market Risk
- Systematic Risk: Overall market movements affect all stocks
- Beta Risk: ${symbolName} may have different sensitivity to market movements
- Sector Risk: Sector-specific events can impact the stock

#### 2. Company-Specific Risk
- Earnings Risk: Quarterly earnings can cause significant price movements
- Guidance Risk: Management guidance can impact future expectations
- News Risk: Company-specific news can create volatility

#### 3. Model Risk
- Prediction Uncertainty: AI predictions have inherent uncertainty
- Historical Bias: Models trained on past data may not predict future events
- Overfitting Risk: Models may overfit to historical patterns

### Risk Management Strategies

#### Position Sizing
- 1-2% Rule: Risk only 1-2% of your portfolio per trade
- Volatility-Adjusted: Reduce position size for more volatile stocks
- Stop Losses: Always use stop-losses to limit downside risk

#### Portfolio Diversification
- Sector Diversification: Don't concentrate in one sector
- Asset Allocation: Combine stocks with other asset classes
- Geographic Diversification: Spread across different markets

#### Time Horizon
- Short-term: Higher risk due to volatility and noise
- Long-term: Lower risk but subject to business cycle risks
- Matching: Align your time horizon with your investment thesis

### Risk Disclaimer
⚠️ All investments carry risk. Past performance does not guarantee future results. The risk analysis provided is educational and should not be considered as investment advice. Always conduct your own risk assessment and consult with financial professionals.

### Professional Guidance
For personalized risk assessment, consider:
- Consulting with a licensed financial advisor
- Reviewing your overall financial situation
- Understanding your risk tolerance and investment objectives
- Considering tax implications of investment decisions`;
  }

  private generateFundamentalAnalysisResponse(message: string, context: ConversationContext): string {
    const { symbol, symbolName, currentPrice } = context;
    
    return `## Fundamental Analysis Framework for ${symbol} (${symbolName})

### Current Price: ${currentPrice.toFixed(2)}

### Key Fundamental Metrics to Consider

#### Valuation Metrics
- P/E Ratio: Price-to-earnings ratio
- P/B Ratio: Price-to-book ratio
- PEG Ratio: P/E divided by earnings growth rate

#### Profitability Metrics
- Profit Margin: Net income as percentage of revenue
- Return on Equity (ROE): Net income divided by shareholder equity
- Return on Assets (ROA): Net income divided by total assets
- Operating Margin: Operating income as percentage of revenue

#### Financial Health
- Debt-to-Equity Ratio: Total debt divided by shareholder equity
- Current Ratio: Current assets divided by current liabilities
- Quick Ratio: (Current assets - inventory) divided by current liabilities

#### Growth Metrics
- Revenue Growth: Year-over-year revenue increase
- Earnings Growth: Year-over-year earnings increase
- EPS Growth: Earnings per share growth rate

### How to Analyze ${symbolName}

#### 1. Industry Comparison
Compare ${symbol}'s metrics to industry peers:
- Is the P/E ratio higher or lower than competitors?
- How does profit margin compare to industry average?
- Is growth rate above or below industry norms?

#### 2. Historical Comparison
Compare current metrics to historical averages:
- Is the current valuation above or below 5-year average?
- Are margins improving or deteriorating?
- Is growth accelerating or decelerating?

#### 3. Quality Assessment
Evaluate business quality:
- Competitive Advantage: Does ${symbolName} have sustainable competitive advantages?
- Management Quality: Track record of capital allocation
- Business Model: Is the business model sustainable and scalable?
- Market Position: Market share and competitive positioning

### Advanced Fundamental Tools Available
The system provides:
- DCF Valuation: Discounted cash flow intrinsic value calculation
- PEG Ratio Valuation: Growth-adjusted valuation
- Graham Number: Defensive value investing metric
- Financial Health Scoring: Comprehensive 100-point scoring system
- Sector Comparison: Compare metrics against sector averages

### Limitations
- Data Availability: Some fundamental data may not be available
- Timeliness: Financial statements are reported quarterly
- Estimates: Many metrics involve estimates and assumptions
- Forward-looking: Fundamental analysis relies on future projections

### Analysis Process
1. Gather Data: Collect all available fundamental metrics
2. Compare: Compare to industry peers and historical averages
3. Analyze Trends: Look for improving or deteriorating trends
4. Assess Quality: Evaluate business quality and competitive position
5. Valuation: Determine if current price is reasonable
6. Risks: Identify key risks and catalysts

### Disclaimer
⚠️ Fundamental analysis is complex and requires professional judgment. This educational overview should not replace professional financial analysis or advice. Always conduct thorough research and consult with financial professionals before making investment decisions.`;
  }

  private generateStrategyResponse(message: string, context: ConversationContext): string {
    return `## Trading Strategy Analysis

### Available Strategy Tools

The system provides several backtesting strategies to evaluate different approaches:

#### 1. SMA Crossover Strategy
- Logic: Buy when short SMA crosses above long SMA, sell when it crosses below
- Parameters: Short period (default: 10), Long period (default: 20)
- Best For: Trending markets with clear directional movement
- Risks: Whipsaws in choppy markets, lagging indicators

#### 2. RSI Mean Reversion Strategy
- Logic: Buy when RSI crosses above oversold level, sell when it crosses below overbought
- Parameters: Oversold threshold (default: 30), Overbought threshold (default: 70)
- Best For: Range-bound markets with clear support/resistance
- Risks: Can be caught in strong trends, false signals

#### 3. Bollinger Bands Breakout Strategy
- Logic: Buy when price breaks above upper band, sell when it breaks below lower band
- Parameters: Period (default: 20), Standard deviations (default: 2)
- Best For: Volatility breakouts and momentum trading
- Risks: False breakouts, volatility exhaustion

### Strategy Evaluation Metrics
When evaluating strategies, consider:
- Total Return: Overall profitability
- Sharpe Ratio: Risk-adjusted returns
- Maximum Drawdown: Largest peak-to-trough decline
- Win Rate: Percentage of profitable trades
- Profit Factor: Gross profit divided by gross loss

### Strategy Optimization
The system includes parameter optimization to find the best settings:
- Grid Search: Test multiple parameter combinations
- Walk-Forward Analysis: Test on out-of-sample data to avoid overfitting
- Performance Comparison: Compare different strategies side-by-side

### Risk Management in Trading
- Position Sizing: Risk only 1-2% per trade
- Stop Losses: Always use stop-losses to limit losses
- Take Profits: Take profits at predetermined levels
- Portfolio Heat: Don't overconcentrate in correlated positions

### Paper Trading
Before trading with real money:
1. Test Strategies: Paper trade for at least 3-6 months
2. Track Performance: Keep detailed records of all trades
3. Analyze Results: Review what worked and what didn't
4. Refine Approach: Continuously improve your strategy

### Important Considerations
- Past Performance: Backtested results don't guarantee future performance
- Market Regimes: Strategies that work in one market regime may fail in another
- Transaction Costs: Real trading involves commissions, slippage, and fees
- Psychology: Real trading involves emotions that paper trading doesn't capture

### Disclaimer
⚠️ Trading strategies are for educational purposes only. Past performance does not guarantee future results. Always paper trade extensively before risking real money. This is not financial advice.`;
  }

  private generateComprehensiveResponse(message: string, context: ConversationContext): string {
    const { symbol, symbolName, currentPrice, dailyChange, rsi, sentiment, prediction } = context;
    
    return `## Comprehensive Analysis for ${symbol} (${symbolName})

### Current Market Overview
- Symbol: ${symbol}
- Company: ${symbolName}
- Current Price: ${currentPrice.toFixed(2)}
- Daily Change: ${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)}%
- RSI (14): ${rsi ? rsi.toFixed(1) : 'N/A'}
- Sentiment: ${sentiment.toFixed(3)} (${sentiment > 0.2 ? 'Bullish' : sentiment < -0.2 ? 'Bearish' : 'Neutral'})
${prediction ? `- AI Prediction: ${prediction.predictedPrice.toFixed(2)} (${prediction.direction}, ${prediction.confidence.toFixed(1)}% confidence)` : ''}

### Technical Analysis Summary
${rsi ? `RSI Signal: ${rsi > 70 ? 'Overbought - potential pullback' : rsi < 30 ? 'Oversold - potential bounce' : 'Neutral - no clear signal'}` : 'Check the Indicators tab for detailed technical analysis.'}

### Sentiment Analysis
Current sentiment is ${sentiment > 0.2 ? 'bullish' : sentiment < -0.2 ? 'bearish' : 'neutral'}, indicating ${sentiment > 0.2 ? 'positive market sentiment' : sentiment < -0.2 ? 'negative market sentiment' : 'balanced market sentiment'}.

### Available Analysis Tools
The dashboard provides comprehensive analysis tools:
- Technical Indicators: RSI, MACD, Bollinger Bands, Moving Averages, ATR, Stochastic, Williams %R, Ichimoku Cloud
- Fundamental Analysis: Financial health scoring, valuation models, sector comparisons
- Risk Management: Monte Carlo simulation, stress testing, position sizing
- Backtesting: Multiple trading strategies with optimization
- Portfolio Management: Track positions, analyze performance, manage diversification

### How to Use This Analysis
1. Review Technical Indicators: Check the Indicators tab for detailed technical analysis
2. Consider Fundamentals: Evaluate the company's financial health and valuation
3. Assess Risk: Review risk metrics and use proper position sizing
4. Test Strategies: Use backtesting to evaluate different approaches
5. Manage Portfolio: Track your positions and overall portfolio performance

### Important Reminders
- Educational Purpose: This analysis is for educational purposes only
- Not Financial Advice: This should not be considered as investment advice
- Do Your Own Research: Always conduct thorough independent analysis
- Risk Management: Never risk more than you can afford to lose
- Professional Guidance: Consult with financial advisors for personalized advice

### Next Steps
- Generate Prediction: Click "Train & predict" to get AI price forecasts
- Review Indicators: Explore the advanced technical indicators available
- Check Portfolio: Use the Portfolio tab to track your positions
- Set Alerts: Configure price and indicator alerts for notifications

### Disclaimer
⚠️ This analysis is educational only and not financial advice. Stock market investing involves significant risk, including the potential loss of principal. Always conduct your own research and consult with qualified financial professionals before making investment decisions.`;
  }
}

// Global instance
export const advancedAI = new AdvancedAIAssistant();

// Helper function for OpenAI API integration
export async function callOpenAIWithMemory(
  message: string,
  context: ConversationContext,
  conversationHistory: ConversationMessage[],
  apiKey: string,
  model: string = "gpt-4o-mini"
): Promise<string> {
  const systemPrompt = advancedAI.buildSystemPrompt(context);
  
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "No response generated";
  } catch (error) {
    console.error("OpenAI API call failed:", error);
    // Fallback to local response
    return advancedAI.generateLocalResponse(message, context);
  }
}
