export type WebSocketMessage = {
  type: 'price' | 'quote' | 'trade' | 'error' | 'connected' | 'disconnected';
  symbol: string;
  data: any;
  timestamp: string;
};

export type WebSocketConfig = {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  enableHeartbeat: boolean;
  heartbeatInterval: number;
};

export type Subscription = {
  symbol: string;
  types: Array<'price' | 'quote' | 'trade'>;
  subscribed: boolean;
};

class WebSocketManager {
  protected ws: WebSocket | null = null;
  protected config: WebSocketConfig;
  protected subscriptions: Map<string, Subscription> = new Map();
  protected messageHandlers: Map<string, ((message: WebSocketMessage) => void)[]> = new Map();
  protected reconnectAttempts = 0;
  protected heartbeatTimer: NodeJS.Timeout | null = null;
  protected reconnectTimer: NodeJS.Timeout | null = null;
  protected isConnected = false;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: config.url || 'wss://stream.data-api.example.com/v1/stream',
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      enableHeartbeat: config.enableHeartbeat !== false,
      heartbeatInterval: config.heartbeatInterval || 30000,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Resubscribe to previous subscriptions
          this.resubscribeAll();
          
          // Start heartbeat if enabled
          if (this.config.enableHeartbeat) {
            this.startHeartbeat();
          }
          
          this.broadcastMessage({
            type: 'connected',
            symbol: '',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
          });
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage;
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.stopHeartbeat();
          
          this.broadcastMessage({
            type: 'disconnected',
            symbol: '',
            data: { timestamp: new Date().toISOString() },
            timestamp: new Date().toISOString(),
          });
          
          // Attempt to reconnect
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.broadcastMessage({
            type: 'error',
            symbol: '',
            data: { error: 'WebSocket connection error' },
            timestamp: new Date().toISOString(),
          });
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isConnected = false;
  }

  subscribe(symbol: string, types: Array<'price' | 'quote' | 'trade'> = ['price']): void {
    const subscription: Subscription = {
      symbol,
      types,
      subscribed: true,
    };

    this.subscriptions.set(symbol, subscription);

    if (this.isConnected && this.ws) {
      const message = {
        action: 'subscribe',
        symbol,
        types,
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  unsubscribe(symbol: string): void {
    const subscription = this.subscriptions.get(symbol);
    if (subscription) {
      subscription.subscribed = false;
      this.subscriptions.set(symbol, subscription);

      if (this.isConnected && this.ws) {
        const message = {
          action: 'unsubscribe',
          symbol,
        };
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  unsubscribeAll(): void {
    this.subscriptions.forEach((subscription, symbol) => {
      this.unsubscribe(symbol);
    });
  }

  onMessage(handler: (message: WebSocketMessage) => void): () => void {
    const handlerId = `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.messageHandlers.has(handlerId)) {
      this.messageHandlers.set(handlerId, []);
    }
    
    this.messageHandlers.get(handlerId)!.push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(handlerId);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  onPrice(symbol: string, handler: (price: number) => void): () => void {
    return this.onMessage((message) => {
      if (message.type === 'price' && message.symbol === symbol) {
        handler(message.data.price);
      }
    });
  }

  onQuote(symbol: string, handler: (quote: any) => void): () => void {
    return this.onMessage((message) => {
      if (message.type === 'quote' && message.symbol === symbol) {
        handler(message.data);
      }
    });
  }

  onTrade(symbol: string, handler: (trade: any) => void): () => void {
    return this.onMessage((message) => {
      if (message.type === 'trade' && message.symbol === symbol) {
        handler(message.data);
      }
    });
  }

  protected handleMessage(message: WebSocketMessage): void {
    this.messageHandlers.forEach((handlers) => {
      handlers.forEach(handler => handler(message));
    });
  }

  protected broadcastMessage(message: WebSocketMessage): void {
    this.handleMessage(message);
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach((subscription, symbol) => {
      if (subscription.subscribed) {
        this.subscribe(symbol, subscription.types);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, this.config.reconnectInterval);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.ws.send(JSON.stringify({ action: 'heartbeat' }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSubscriptions(): Subscription[] {
    return Array.from(this.subscriptions.values());
  }
}

// Mock WebSocket for development (simulates real-time data)
class MockWebSocketManager extends WebSocketManager {
  private mockDataInterval: NodeJS.Timeout | null = null;
  private mockPrices: Map<string, number> = new Map();

  constructor() {
    super({ url: 'mock://websocket' });
  }

  override async connect(): Promise<void> {
    console.log('Mock WebSocket connected');
    this.isConnected = true;
    
    // Start generating mock data
    this.startMockData();
    
    this.broadcastMessage({
      type: 'connected',
      symbol: '',
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });
  }

  override disconnect(): void {
    super.disconnect();
    this.stopMockData();
  }

  private startMockData(): void {
    this.mockDataInterval = setInterval(() => {
      this.subscriptions.forEach((subscription, symbol) => {
        if (!subscription.subscribed) return;

        // Generate mock price data
        const currentPrice = this.mockPrices.get(symbol) || 100 + Math.random() * 50;
        const priceChange = (Math.random() - 0.5) * 2;
        const newPrice = currentPrice + priceChange;
        this.mockPrices.set(symbol, newPrice);

        // Broadcast price update
        this.broadcastMessage({
          type: 'price',
          symbol,
          data: {
            price: newPrice,
            change: priceChange,
            changePercent: (priceChange / currentPrice) * 100,
            volume: Math.floor(Math.random() * 10000),
          },
          timestamp: new Date().toISOString(),
        });

        // Occasionally send quote data
        if (Math.random() > 0.7) {
          this.broadcastMessage({
            type: 'quote',
            symbol,
            data: {
              bid: newPrice - 0.01,
              ask: newPrice + 0.01,
              bidSize: Math.floor(Math.random() * 1000),
              askSize: Math.floor(Math.random() * 1000),
            },
            timestamp: new Date().toISOString(),
          });
        }
      });
    }, 1000); // Update every second
  }

  private stopMockData(): void {
    if (this.mockDataInterval) {
      clearInterval(this.mockDataInterval);
      this.mockDataInterval = null;
    }
  }
}

// Factory function
export function createWebSocketManager(useMock: boolean = true): WebSocketManager {
  if (useMock) {
    return new MockWebSocketManager();
  }
  return new WebSocketManager();
}
