export type BrokerType = 'alpaca' | 'ibkr';

export type Order = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price: number | undefined;
  stopPrice: number | undefined;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number | undefined;
  averagePrice: number | undefined;
  createdAt: string;
  updatedAt: string;
};

export type AccountInfo = {
  accountId: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  daytradingBuyingPower: number;
  equity: number;
  lastEquity: number;
  multiplier: number;
  longMarketValue: number;
  shortMarketValue: number;
  initialMargin: number;
  maintenanceMargin: number;
  lastMaintenanceMargin: number;
  marginCall: boolean;
  daytradeCount: number;
};

export type Position = {
  symbol: string;
  quantity: number;
  side: 'long' | 'short';
  marketValue: number;
  averageEntryPrice: number;
  currentPrice: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  costBasis: number;
};

export type OrderRequest = {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
};

// Base Broker Interface
abstract class BrokerAPI {
  protected apiKey: string;
  protected apiSecret?: string;
  protected baseUrl: string;

  constructor(apiKey: string, apiSecret?: string, baseUrl: string = '') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
  }

  abstract getAccountInfo(): Promise<AccountInfo>;
  abstract getPositions(): Promise<Position[]>;
  abstract placeOrder(order: OrderRequest): Promise<Order>;
  abstract cancelOrder(orderId: string): Promise<boolean>;
  abstract getOrders(): Promise<Order[]>;
  abstract getOrder(orderId: string): Promise<Order | null>;
}

// Alpaca API Implementation
class AlpacaAPI extends BrokerAPI {
  constructor(apiKey: string, apiSecret: string, paper: boolean = true) {
    const baseUrl = paper 
      ? 'https://paper-api.alpaca.markets' 
      : 'https://api.alpaca.markets';
    super(apiKey, apiSecret, baseUrl);
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'APCA-API-KEY-ID': this.apiKey,
      'APCA-API-SECRET-KEY': this.apiSecret!,
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('Alpaca API request failed:', error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const data = await this.request('/v2/account');
    return {
      accountId: data.id,
      buyingPower: parseFloat(data.buying_power),
      cash: parseFloat(data.cash),
      portfolioValue: parseFloat(data.portfolio_value),
      daytradingBuyingPower: parseFloat(data.daytrading_buying_power),
      equity: parseFloat(data.equity),
      lastEquity: parseFloat(data.last_equity),
      multiplier: parseFloat(data.multiplier),
      longMarketValue: parseFloat(data.long_market_value),
      shortMarketValue: parseFloat(data.short_market_value),
      initialMargin: parseFloat(data.initial_margin),
      maintenanceMargin: parseFloat(data.maintenance_margin),
      lastMaintenanceMargin: parseFloat(data.last_maintenance_margin),
      marginCall: data.margin_call,
      daytradeCount: data.daytrade_count,
    };
  }

  async getPositions(): Promise<Position[]> {
    const data = await this.request('/v2/positions');
    return data.map((pos: any) => ({
      symbol: pos.symbol,
      quantity: parseFloat(pos.qty),
      side: pos.side,
      marketValue: parseFloat(pos.market_value),
      averageEntryPrice: parseFloat(pos.avg_entry_price),
      currentPrice: parseFloat(pos.current_price),
      unrealizedPL: parseFloat(pos.unrealized_pl),
      unrealizedPLPercent: parseFloat(pos.unrealized_plpc),
      costBasis: parseFloat(pos.cost_basis),
    }));
  }

  async placeOrder(orderRequest: OrderRequest): Promise<Order> {
    const payload = {
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type,
      qty: orderRequest.quantity.toString(),
      time_in_force: orderRequest.timeInForce || 'day',
      ...(orderRequest.price && { limit_price: orderRequest.price.toString() }),
      ...(orderRequest.stopPrice && { stop_price: orderRequest.stopPrice.toString() }),
    };

    const data = await this.request('/v2/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const apiOrder = data;

    const order: Order = {
      id: data.id,
      symbol: data.symbol,
      side: data.side,
      type: data.type,
      quantity: parseFloat(data.qty),
      price: undefined,
      stopPrice: undefined,
      status: data.status,
      filledQuantity: undefined,
      averagePrice: undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    if (apiOrder.limit_price) order.price = parseFloat(apiOrder.limit_price);
    if (apiOrder.stop_price) order.stopPrice = parseFloat(apiOrder.stop_price);
    if (apiOrder.filled_qty) order.filledQuantity = parseFloat(apiOrder.filled_qty);
    if (apiOrder.filled_avg_price) order.averagePrice = parseFloat(apiOrder.filled_avg_price);
    
    return order;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.request(`/v2/orders/${orderId}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async getOrders(): Promise<Order[]> {
    const data = await this.request('/v2/orders');
    return data.map((apiOrder: any) => {
      const mappedOrder: Order = {
        id: apiOrder.id,
        symbol: apiOrder.symbol,
        side: apiOrder.side,
        type: apiOrder.type,
        quantity: parseFloat(apiOrder.qty),
        price: undefined,
        stopPrice: undefined,
        status: apiOrder.status,
        filledQuantity: undefined,
        averagePrice: undefined,
        createdAt: apiOrder.created_at,
        updatedAt: apiOrder.updated_at,
      };
      
      if (apiOrder.limit_price) mappedOrder.price = parseFloat(apiOrder.limit_price);
      if (apiOrder.stop_price) mappedOrder.stopPrice = parseFloat(apiOrder.stop_price);
      if (apiOrder.filled_qty) mappedOrder.filledQuantity = parseFloat(apiOrder.filled_qty);
      if (apiOrder.filled_avg_price) mappedOrder.averagePrice = parseFloat(apiOrder.filled_avg_price);
      
      return mappedOrder;
    });
  }

  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const data = await this.request(`/v2/orders/${orderId}`);
      const apiOrder = data;
      const order: Order = {
        id: apiOrder.id,
        symbol: apiOrder.symbol,
        side: apiOrder.side,
        type: apiOrder.type,
        quantity: parseFloat(apiOrder.qty),
        price: undefined,
        stopPrice: undefined,
        status: apiOrder.status,
        filledQuantity: undefined,
        averagePrice: undefined,
        createdAt: apiOrder.created_at,
        updatedAt: apiOrder.updated_at,
      };
      
      if (apiOrder.limit_price) order.price = parseFloat(apiOrder.limit_price);
      if (apiOrder.stop_price) order.stopPrice = parseFloat(apiOrder.stop_price);
      if (apiOrder.filled_qty) order.filledQuantity = parseFloat(apiOrder.filled_qty);
      if (apiOrder.filled_avg_price) order.averagePrice = parseFloat(apiOrder.filled_avg_price);
      
      return order;
    } catch {
      return null;
    }
  }
}

// Interactive Brokers API Implementation (simplified)
class IBKRAPI extends BrokerAPI {
  constructor(apiKey: string, apiSecret: string) {
    super(apiKey, apiSecret, 'https://api.ibkr.com/v1/portal');
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        throw new Error(`IBKR API error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error('IBKR API request failed:', error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    // Mock implementation - IBKR API is more complex
    return {
      accountId: 'ibkr_mock_account',
      buyingPower: 100000,
      cash: 50000,
      portfolioValue: 150000,
      daytradingBuyingPower: 200000,
      equity: 150000,
      lastEquity: 148000,
      multiplier: 2,
      longMarketValue: 100000,
      shortMarketValue: 0,
      initialMargin: 25000,
      maintenanceMargin: 20000,
      lastMaintenanceMargin: 19500,
      marginCall: false,
      daytradeCount: 0,
    };
  }

  async getPositions(): Promise<Position[]> {
    // Mock implementation
    return [];
  }

  async placeOrder(order: OrderRequest): Promise<Order> {
    // Mock implementation
    return {
      id: `ibkr_${Date.now()}`,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price ?? undefined,
      stopPrice: order.stopPrice ?? undefined,
      status: 'pending',
      filledQuantity: undefined,
      averagePrice: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    // Mock implementation
    return true;
  }

  async getOrders(): Promise<Order[]> {
    // Mock implementation
    return [];
  }

  async getOrder(orderId: string): Promise<Order | null> {
    // Mock implementation
    return null;
  }
}

// Factory function
export function createBrokerAPI(
  type: BrokerType,
  apiKey: string,
  apiSecret?: string,
  options?: { paper?: boolean }
): BrokerAPI {
  switch (type) {
    case 'alpaca':
      return new AlpacaAPI(apiKey, apiSecret!, options?.paper ?? true);
    case 'ibkr':
      return new IBKRAPI(apiKey, apiSecret!);
    default:
      throw new Error(`Unsupported broker type: ${type}`);
  }
}

// Mock Broker for testing
class MockBrokerAPI extends BrokerAPI {
  private orders: Map<string, Order> = new Map();
  private positions: Position[] = [];
  private accountInfo: AccountInfo = {
    accountId: 'mock_account',
    buyingPower: 100000,
    cash: 50000,
    portfolioValue: 150000,
    daytradingBuyingPower: 200000,
    equity: 150000,
    lastEquity: 148000,
    multiplier: 2,
    longMarketValue: 100000,
    shortMarketValue: 0,
    initialMargin: 25000,
    maintenanceMargin: 20000,
    lastMaintenanceMargin: 19500,
    marginCall: false,
    daytradeCount: 0,
  };

  constructor() {
    super('mock_key', 'mock_secret', 'mock://api');
  }

  async getAccountInfo(): Promise<AccountInfo> {
    return { ...this.accountInfo };
  }

  async getPositions(): Promise<Position[]> {
    return [...this.positions];
  }

  async placeOrder(order: OrderRequest): Promise<Order> {
    const newOrder: Order = {
      id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      quantity: order.quantity,
      price: order.price ?? undefined,
      stopPrice: order.stopPrice ?? undefined,
      status: 'pending',
      filledQuantity: undefined,
      averagePrice: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(newOrder.id, newOrder);

    // Simulate order execution
    setTimeout(() => {
      const executedOrder = this.orders.get(newOrder.id);
      if (executedOrder) {
        executedOrder.status = 'filled';
        executedOrder.filledQuantity = order.quantity;
        executedOrder.averagePrice = order.price ?? (100 + Math.random() * 50);
        executedOrder.updatedAt = new Date().toISOString();
        
        // Update positions
        this.updatePositions(executedOrder);
      }
    }, 1000);

    return newOrder;
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);
    if (order && order.status === 'pending') {
      order.status = 'cancelled';
      order.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  private updatePositions(order: Order): void {
    const existingPosition = this.positions.find(p => p.symbol === order.symbol);
    
    if (existingPosition) {
      if (order.side === 'buy') {
        existingPosition.quantity += order.filledQuantity || 0;
        existingPosition.costBasis += (order.averagePrice || 0) * (order.filledQuantity || 0);
      } else {
        existingPosition.quantity -= order.filledQuantity || 0;
      }
      
      if (existingPosition.quantity === 0) {
        this.positions = this.positions.filter(p => p.symbol !== order.symbol);
      }
    } else if (order.side === 'buy') {
      this.positions.push({
        symbol: order.symbol,
        quantity: order.filledQuantity || 0,
        side: 'long',
        marketValue: (order.filledQuantity || 0) * (order.averagePrice || 0),
        averageEntryPrice: order.averagePrice || 0,
        currentPrice: order.averagePrice || 0,
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
        costBasis: (order.filledQuantity || 0) * (order.averagePrice || 0),
      });
    }
  }
}

export function createMockBrokerAPI(): BrokerAPI {
  return new MockBrokerAPI();
}
