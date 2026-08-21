export type SocialSentimentSource = 'twitter' | 'reddit' | 'stocktwits';

export type SocialPost = {
  id: string;
  source: SocialSentimentSource;
  symbol: string;
  content: string;
  author: string;
  timestamp: string;
  likes?: number;
  comments?: number;
  url?: string;
};

export type SocialSentimentScore = {
  symbol: string;
  source: SocialSentimentSource;
  sentiment: number; // -1 to 1
  confidence: number; // 0 to 1
  postCount: number;
  averageSentiment: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  timestamp: string;
};

export type SocialSentimentAggregated = {
  symbol: string;
  overallSentiment: number;
  sourceBreakdown: Record<SocialSentimentSource, SocialSentimentScore>;
  trend: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
  volume: number;
  timestamp: string;
};

// Simple sentiment analysis using keyword matching (in production, use NLP/ML)
const BULLISH_KEYWORDS = [
  'buy', 'long', 'bull', 'bullish', 'moon', 'rocket', 'pump', 'gain', 'profit', 'up', 'rise',
  'growth', 'strong', 'positive', 'good', 'great', 'excellent', 'amazing', 'win', 'winner',
  'breakout', 'surge', 'rally', 'soar', 'jump', 'climb', 'higher', 'peak', 'record', 'high',
  'call', 'calls', 'accumulate', 'hold', 'diamond', 'hands', 'hodl', 'buying', 'bought',
];

const BEARISH_KEYWORDS = [
  'sell', 'short', 'bear', 'bearish', 'dump', 'crash', 'fall', 'drop', 'down', 'decline',
  'loss', 'bad', 'terrible', 'awful', 'poor', 'weak', 'negative', 'put', 'puts', 'avoid',
  'risk', 'danger', 'warning', 'caution', 'concern', 'fear', 'panic', 'collapse', 'plunge',
  'tumble', 'slide', 'lower', 'bottom', 'sell', 'selling', 'sold', 'recession', 'crisis',
];

function analyzeSentiment(text: string): { sentiment: number; confidence: number } {
  const lowerText = text.toLowerCase();
  let bullishCount = 0;
  let bearishCount = 0;

  BULLISH_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) bullishCount++;
  });

  BEARISH_KEYWORDS.forEach((keyword) => {
    if (lowerText.includes(keyword)) bearishCount++;
  });

  const totalMatches = bullishCount + bearishCount;
  
  if (totalMatches === 0) {
    return { sentiment: 0, confidence: 0 };
  }

  const sentiment = (bullishCount - bearishCount) / totalMatches;
  const confidence = Math.min(totalMatches / 5, 1); // More keywords = higher confidence

  return { sentiment, confidence };
}

export function aggregateSocialSentiment(
  posts: SocialPost[],
  symbol: string
): SocialSentimentAggregated {
  const symbolPosts = posts.filter((post) => post.symbol === symbol);
  
  if (symbolPosts.length === 0) {
    return {
      symbol,
      overallSentiment: 0,
      sourceBreakdown: {} as Record<SocialSentimentSource, SocialSentimentScore>,
      trend: 'neutral',
      volume: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Group by source
  const bySource: Record<SocialSentimentSource, SocialPost[]> = {
    twitter: [],
    reddit: [],
    stocktwits: [],
  };

  symbolPosts.forEach((post) => {
    bySource[post.source].push(post);
  });

  // Calculate sentiment for each source
  const sourceBreakdown: Record<SocialSentimentSource, SocialSentimentScore> = {} as any;
  let totalWeightedSentiment = 0;
  let totalWeight = 0;

  Object.entries(bySource).forEach(([source, sourcePosts]) => {
    if (sourcePosts.length === 0) return;

    const sentiments = sourcePosts.map((post) => analyzeSentiment(post.content));
    const averageSentiment =
      sentiments.reduce((sum, s) => sum + s.sentiment, 0) / sentiments.length;
    const averageConfidence =
      sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length;

    const score: SocialSentimentScore = {
      symbol,
      source: source as SocialSentimentSource,
      sentiment: averageSentiment,
      confidence: averageConfidence,
      postCount: sourcePosts.length,
      averageSentiment,
      trend: averageSentiment > 0.2 ? 'bullish' : averageSentiment < -0.2 ? 'bearish' : 'neutral',
      timestamp: new Date().toISOString(),
    };

    sourceBreakdown[source as SocialSentimentSource] = score;

    // Weight by confidence and post count
    const weight = averageConfidence * Math.min(sourcePosts.length / 10, 1);
    totalWeightedSentiment += averageSentiment * weight;
    totalWeight += weight;
  });

  const overallSentiment = totalWeight > 0 ? totalWeightedSentiment / totalWeight : 0;

  let trend: SocialSentimentAggregated['trend'];
  if (overallSentiment > 0.5) trend = 'strong_bullish';
  else if (overallSentiment > 0.2) trend = 'bullish';
  else if (overallSentiment < -0.5) trend = 'strong_bearish';
  else if (overallSentiment < -0.2) trend = 'bearish';
  else trend = 'neutral';

  return {
    symbol,
    overallSentiment,
    sourceBreakdown,
    trend,
    volume: symbolPosts.length,
    timestamp: new Date().toISOString(),
  };
}

// Mock data generators for demonstration (replace with real API calls in production)
export function generateMockSocialPosts(symbol: string, count: number = 20): SocialPost[] {
  const mockPosts: SocialPost[] = [];
  const sources: SocialSentimentSource[] = ['twitter', 'reddit', 'stocktwits'];
  
  const bullishTemplates = [
    `Just bought more ${symbol}! This is going to the moon 🚀`,
    `${symbol} looking strong today. Technicals are bullish.`,
    `HODL ${symbol}! Diamond hands 💎🙌`,
    `${symbol} breakout imminent! Accumulating now.`,
    `Great earnings call for ${symbol}. Long term hold.`,
  ];

  const bearishTemplates = [
    `Selling my ${symbol} position. Risk is too high.`,
    `${symbol} showing weakness. Might be time to exit.`,
    `Bearish divergence on ${symbol}. Be careful.`,
    `${symbol} overvalued at current levels.`,
    `Avoiding ${symbol} until market conditions improve.`,
  ];

  const neutralTemplates = [
    `Watching ${symbol} closely. Waiting for clear signal.`,
    `${symbol} consolidating. Interesting setup forming.`,
    `What do you think about ${symbol} current levels?`,
    `${symbol} volatility is high today.`,
    `Mixed signals on ${symbol}. Need more data.`,
  ];

  for (let i = 0; i < count; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)]!;
    const sentimentBias = Math.random();
    
    let template: string;
    if (sentimentBias > 0.6 && bullishTemplates.length > 0) {
      template = bullishTemplates[Math.floor(Math.random() * bullishTemplates.length)]!;
    } else if (sentimentBias < 0.4 && bearishTemplates.length > 0) {
      template = bearishTemplates[Math.floor(Math.random() * bearishTemplates.length)]!;
    } else if (neutralTemplates.length > 0) {
      template = neutralTemplates[Math.floor(Math.random() * neutralTemplates.length)]!;
    } else {
      template = `Watching ${symbol} closely.`;
    }

    mockPosts.push({
      id: `post-${Date.now()}-${i}`,
      source,
      symbol,
      content: template,
      author: `user_${Math.random().toString(36).substr(2, 8)}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      likes: Math.floor(Math.random() * 100),
      comments: Math.floor(Math.random() * 50),
    });
  }

  return mockPosts;
}

export function getSentimentTrend(
  history: SocialSentimentAggregated[],
  window: number = 5
): {
  direction: 'up' | 'down' | 'stable';
  change: number;
  momentum: number;
} {
  if (history.length < 2) {
    return { direction: 'stable', change: 0, momentum: 0 };
  }

  const recent = history.slice(-window);
  const oldest = recent[0]!;
  const newest = recent[recent.length - 1]!;

  const change = newest.overallSentiment - oldest.overallSentiment;
  
  // Calculate momentum (rate of change)
  const momentum = recent.length > 1
    ? (newest.overallSentiment - recent[0]!.overallSentiment) / recent.length
    : 0;

  let direction: 'up' | 'down' | 'stable';
  if (Math.abs(change) < 0.1) {
    direction = 'stable';
  } else if (change > 0) {
    direction = 'up';
  } else {
    direction = 'down';
  }

  return { direction, change, momentum };
}

export function getTopMentions(
  posts: SocialPost[],
  limit: number = 10
): Array<{ symbol: string; count: number; avgSentiment: number }> {
  const symbolCounts: Map<string, { count: number; totalSentiment: number }> = new Map();

  posts.forEach((post) => {
    const sentiment = analyzeSentiment(post.content).sentiment;
    const existing = symbolCounts.get(post.symbol) || { count: 0, totalSentiment: 0 };
    symbolCounts.set(post.symbol, {
      count: existing.count + 1,
      totalSentiment: existing.totalSentiment + sentiment,
    });
  });

  return Array.from(symbolCounts.entries())
    .map(([symbol, data]) => ({
      symbol,
      count: data.count,
      avgSentiment: data.totalSentiment / data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getInfluentialPosts(
  posts: SocialPost[],
  limit: number = 5
): SocialPost[] {
  return [...posts]
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, limit);
}

export function compareSentimentWithNews(
  socialSentiment: SocialSentimentAggregated,
  newsSentiment: number
): {
  alignment: 'aligned' | 'divergent' | 'neutral';
  difference: number;
  interpretation: string;
} {
  const difference = socialSentiment.overallSentiment - newsSentiment;
  
  let alignment: 'aligned' | 'divergent' | 'neutral';
  if (Math.abs(difference) < 0.2) {
    alignment = 'neutral';
  } else if (Math.sign(socialSentiment.overallSentiment) === Math.sign(newsSentiment)) {
    alignment = 'aligned';
  } else {
    alignment = 'divergent';
  }

  let interpretation: string;
  if (alignment === 'aligned') {
    interpretation = 'Social sentiment and news sentiment are aligned, reinforcing the market signal.';
  } else if (alignment === 'divergent') {
    interpretation = 'Social sentiment diverges from news sentiment - retail and institutional views may differ.';
  } else {
    interpretation = 'Social and news sentiment are neutral - mixed signals in the market.';
  }

  return { alignment, difference, interpretation };
}
