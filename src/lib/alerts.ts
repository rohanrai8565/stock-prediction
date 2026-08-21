export type AlertCondition = {
  type: 'price_above' | 'price_below' | 'rsi_above' | 'rsi_below' | 
        'macd_crossover' | 'volume_spike' | 'sentiment_change' | 'percent_change';
  symbol: string;
  value: number;
  threshold?: number;
  enabled: boolean;
};

export type Alert = {
  id: string;
  symbol: string;
  condition: AlertCondition;
  triggered: boolean;
  triggeredAt?: string;
  message: string;
  createdAt: string;
  acknowledged: boolean;
};

export type NotificationSettings = {
  enabled: boolean;
  email: string;
  pushEnabled: boolean;
  priceAlerts: boolean;
  indicatorAlerts: boolean;
  sentimentAlerts: boolean;
};

export function createAlert(
  symbol: string,
  condition: Omit<AlertCondition, 'symbol' | 'enabled'>
): Alert {
  return {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    symbol,
    condition: { ...condition, symbol, enabled: true },
    triggered: false,
    message: generateAlertMessage(symbol, condition),
    createdAt: new Date().toISOString(),
    acknowledged: false,
  };
}

function generateAlertMessage(symbol: string, condition: Omit<AlertCondition, 'symbol' | 'enabled'>): string {
  switch (condition.type) {
    case 'price_above':
      return `${symbol} price above ${condition.value}`;
    case 'price_below':
      return `${symbol} price below ${condition.value}`;
    case 'rsi_above':
      return `${symbol} RSI above ${condition.value} (overbought)`;
    case 'rsi_below':
      return `${symbol} RSI below ${condition.value} (oversold)`;
    case 'macd_crossover':
      return `${symbol} MACD crossover detected`;
    case 'volume_spike':
      return `${symbol} volume spike detected`;
    case 'sentiment_change':
      return `${symbol} sentiment changed significantly`;
    case 'percent_change':
      return `${symbol} price changed by ${condition.value}%`;
    default:
      return `${symbol} alert triggered`;
  }
}

export function checkAlerts(
  alerts: Alert[],
  currentData: Map<string, { price: number; rsi?: number; macd?: number; volume?: number; sentiment?: number }>
): Alert[] {
  return alerts.map((alert) => {
    if (alert.triggered || !alert.condition.enabled) {
      return alert;
    }

    const data = currentData.get(alert.symbol);
    if (!data) return alert;

    let triggered = false;

    switch (alert.condition.type) {
      case 'price_above':
        triggered = data.price >= alert.condition.value;
        break;
      case 'price_below':
        triggered = data.price <= alert.condition.value;
        break;
      case 'rsi_above':
        triggered = data.rsi !== undefined && data.rsi >= alert.condition.value;
        break;
      case 'rsi_below':
        triggered = data.rsi !== undefined && data.rsi <= alert.condition.value;
        break;
      case 'percent_change':
        // Would need previous price for this
        break;
      case 'volume_spike':
        // Would need average volume for this
        break;
      case 'sentiment_change':
        triggered = data.sentiment !== undefined && Math.abs(data.sentiment) >= alert.condition.value;
        break;
    }

    return triggered
      ? { ...alert, triggered: true, triggeredAt: new Date().toISOString() }
      : alert;
  });
}

export function acknowledgeAlert(alertId: string, alerts: Alert[]): Alert[] {
  return alerts.map((alert) =>
    alert.id === alertId ? { ...alert, acknowledged: true } : alert
  );
}

export function deleteAlert(alertId: string, alerts: Alert[]): Alert[] {
  return alerts.filter((alert) => alert.id !== alertId);
}

export function getTriggeredAlerts(alerts: Alert[]): Alert[] {
  return alerts.filter((alert) => alert.triggered && !alert.acknowledged);
}

export function createDefaultAlerts(symbol: string): AlertCondition[] {
  return [
    {
      type: 'price_above',
      symbol,
      value: 0,
      enabled: false,
    },
    {
      type: 'price_below',
      symbol,
      value: 0,
      enabled: false,
    },
    {
      type: 'rsi_above',
      symbol,
      value: 70,
      enabled: true,
    },
    {
      type: 'rsi_below',
      symbol,
      value: 30,
      enabled: true,
    },
    {
      type: 'sentiment_change',
      symbol,
      value: 0.5,
      enabled: true,
    },
  ];
}

export type AlertHistory = {
  date: string;
  symbol: string;
  alertType: string;
  message: string;
  value: number;
};

export function addToAlertHistory(
  history: AlertHistory[],
  alert: Alert,
  currentValue: number
): AlertHistory[] {
  const entry: AlertHistory = {
    date: alert.triggeredAt || new Date().toISOString(),
    symbol: alert.symbol,
    alertType: alert.condition.type,
    message: alert.message,
    value: currentValue,
  };

  return [entry, ...history].slice(0, 100); // Keep last 100 entries
}

export function getAlertStatistics(alerts: Alert[]): {
  total: number;
  active: number;
  triggered: number;
  acknowledged: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};

  alerts.forEach((alert) => {
    const type = alert.condition.type;
    byType[type] = (byType[type] || 0) + 1;
  });

  return {
    total: alerts.length,
    active: alerts.filter((a) => a.condition.enabled && !a.triggered).length,
    triggered: alerts.filter((a) => a.triggered).length,
    acknowledged: alerts.filter((a) => a.acknowledged).length,
    byType,
  };
}

export function createDefaultNotificationSettings(): NotificationSettings {
  return {
    enabled: true,
    email: '',
    pushEnabled: false,
    priceAlerts: true,
    indicatorAlerts: true,
    sentimentAlerts: true,
  };
}

export function validateAlertCondition(condition: AlertCondition): {
  isValid: boolean;
  error?: string;
} {
  if (!condition.symbol || condition.symbol.trim() === '') {
    return { isValid: false, error: 'Symbol is required' };
  }

  if (condition.value < 0) {
    return { isValid: false, error: 'Value must be positive' };
  }

  if (condition.type === 'rsi_above' && condition.value > 100) {
    return { isValid: false, error: 'RSI cannot be above 100' };
  }

  if (condition.type === 'rsi_below' && condition.value > 70) {
    return { isValid: false, error: 'RSI below threshold should typically be 30 or lower' };
  }

  return { isValid: true };
}
