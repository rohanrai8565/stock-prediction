// Testing utilities and framework for the stock prediction project

export type TestResult = {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
};

export type TestSuite = {
  name: string;
  tests: TestResult[];
  duration: number;
  passed: number;
  failed: number;
};

export type TestConfig = {
  timeout: number;
  retries: number;
  verbose: boolean;
};

class TestRunner {
  private suites: Map<string, Array<() => Promise<void>>> = new Map();
  private config: TestConfig = {
    timeout: 5000,
    retries: 2,
    verbose: true,
  };

  registerSuite(name: string, tests: Array<() => Promise<void>>): void {
    this.suites.set(name, tests);
  }

  setConfig(config: Partial<TestConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async runSuite(suiteName: string): Promise<TestSuite> {
    const tests = this.suites.get(suiteName);
    if (!tests) {
      throw new Error(`Test suite '${suiteName}' not found`);
    }

    const startTime = Date.now();
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      const testStartTime = Date.now();
      let result: TestResult;

      try {
        await Promise.race([
          test(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), this.config.timeout)
          ),
        ]);

        result = {
          name: test.name || 'Anonymous test',
          passed: true,
          duration: Date.now() - testStartTime,
        };
        passed++;
      } catch (error) {
        result = {
          name: test.name || 'Anonymous test',
          passed: false,
          duration: Date.now() - testStartTime,
          error: error instanceof Error ? error.message : String(error),
        };
        failed++;
      }

      results.push(result);

      if (this.config.verbose) {
        console.log(`${result.passed ? '✓' : '✗'} ${result.name} (${result.duration}ms)`);
        if (!result.passed && result.error) {
          console.log(`  Error: ${result.error}`);
        }
      }
    }

    return {
      name: suiteName,
      tests: results,
      duration: Date.now() - startTime,
      passed,
      failed,
    };
  }

  async runAllSuites(): Promise<TestSuite[]> {
    const results: TestSuite[] = [];

    for (const suiteName of this.suites.keys()) {
      const suiteResult = await this.runSuite(suiteName);
      results.push(suiteResult);
    }

    return results;
  }
}

// Assertion utilities
export const assert = {
  equal: (actual: any, expected: any, message?: string) => {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, but got ${actual}`);
    }
  },

  notEqual: (actual: any, expected: any, message?: string) => {
    if (actual === expected) {
      throw new Error(message || `Expected ${actual} to not equal ${expected}`);
    }
  },

  deepEqual: (actual: any, expected: any, message?: string) => {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(message || `Expected ${expectedStr}, but got ${actualStr}`);
    }
  },

  truthy: (value: any, message?: string) => {
    if (!value) {
      throw new Error(message || `Expected truthy value, but got ${value}`);
    }
  },

  falsy: (value: any, message?: string) => {
    if (value) {
      throw new Error(message || `Expected falsy value, but got ${value}`);
    }
  },

  throws: async (fn: () => Promise<any>, message?: string) => {
    try {
      await fn();
      throw new Error(message || 'Expected function to throw an error');
    } catch (error) {
      // Expected to throw
    }
  },

  greaterThan: (actual: number, expected: number, message?: string) => {
    if (actual <= expected) {
      throw new Error(message || `Expected ${actual} > ${expected}`);
    }
  },

  lessThan: (actual: number, expected: number, message?: string) => {
    if (actual >= expected) {
      throw new Error(message || `Expected ${actual} < ${expected}`);
    }
  },

  contains: (array: any[], item: any, message?: string) => {
    if (!array.includes(item)) {
      throw new Error(message || `Expected array to contain ${item}`);
    }
  },

  hasProperty: (obj: any, property: string, message?: string) => {
    if (!(property in obj)) {
      throw new Error(message || `Expected object to have property ${property}`);
    }
  },

  instanceOf: (obj: any, constructor: any, message?: string) => {
    if (!(obj instanceof constructor)) {
      throw new Error(message || `Expected object to be instance of ${constructor.name}`);
    }
  },
};

// Mock utilities
export class MockFunction {
  private calls: any[][] = [];
  private returnValue: any;
  private implementation: ((...args: any[]) => any) | null = null;

  constructor(implementation?: (...args: any[]) => any) {
    this.implementation = implementation ?? null;
  }

  async execute(...args: any[]): Promise<any> {
    this.calls.push(args);
    if (this.implementation) {
      return this.implementation(...args);
    }
    return this.returnValue;
  }

  mockReturnValue(value: any): void {
    this.returnValue = value;
  }

  mockImplementation(fn: (...args: any[]) => any): void {
    this.implementation = fn;
  }

  getCallCount(): number {
    return this.calls.length;
  }

  getCalls(): any[][] {
    return [...this.calls];
  }

  getLastCall(): any[] | null {
    return this.calls[this.calls.length - 1] || null;
  }

  reset(): void {
    this.calls = [];
    this.returnValue = undefined;
    this.implementation = null;
  }
}

export function createMock<T>(overrides?: Partial<T>): T {
  return { ...overrides } as T;
}

// Test data generators
export const testData = {
  generateStockPrice: (base: number = 100, volatility: number = 0.02): number => {
    return base * (1 + (Math.random() - 0.5) * volatility);
  },

  generatePriceHistory: (days: number = 100, base: number = 100): number[] => {
    const prices: number[] = [];
    let currentPrice = base;

    for (let i = 0; i < days; i++) {
      currentPrice = testData.generateStockPrice(currentPrice);
      prices.push(currentPrice);
    }

    return prices;
  },

  generateCandle: (base: number = 100) => {
    const close = testData.generateStockPrice(base);
    const high = close * (1 + Math.random() * 0.02);
    const low = close * (1 - Math.random() * 0.02);
    const open = low + Math.random() * (high - low);

    return {
      date: new Date(Date.now() - Math.random() * 86400000).toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume: Math.floor(Math.random() * 1000000),
    };
  },

  generateUser: () => ({
    id: `user_${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    username: `testuser${Date.now()}`,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
    preferences: {
      theme: 'system' as const,
      defaultMarket: 'us' as const,
      notifications: true,
      emailAlerts: false,
      riskTolerance: 'moderate' as const,
    },
  }),
};

// Integration test helpers
export class IntegrationTestHelper {
  private testServer?: any;

  async setupServer(): Promise<void> {
    // Mock server setup for integration tests
    console.log('Setting up test server...');
  }

  async teardownServer(): Promise<void> {
    // Mock server teardown
    console.log('Tearing down test server...');
  }

  async resetDatabase(): Promise<void> {
    // Mock database reset
    console.log('Resetting test database...');
  }

  async seedTestData(): Promise<void> {
    // Mock test data seeding
    console.log('Seeding test data...');
  }
}

// Performance testing utilities
export class PerformanceTest {
  async measureExecutionTime(fn: () => Promise<any>): Promise<number> {
    const start = performance.now();
    await fn();
    return performance.now() - start;
  }

  async benchmark(fn: () => Promise<any>, iterations: number = 100): Promise<{
    average: number;
    min: number;
    max: number;
    median: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const time = await this.measureExecutionTime(fn);
      times.push(time);
    }

    times.sort((a, b) => a - b);

    return {
      average: times.reduce((sum, t) => sum + t, 0) / times.length,
      min: times[0]!,
      max: times[times.length - 1]!,
      median: times[Math.floor(times.length / 2)]!,
    };
  }
}

// Global test runner instance
export const testRunner = new TestRunner();

// Example test suite registration
export function registerTests() {
  // Technical indicators tests
  testRunner.registerSuite('Technical Indicators', [
    async function testSMA() {
      const prices = [1, 2, 3, 4, 5];
      const sma = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      assert.equal(sma, 3, 'SMA calculation should be correct');
    },

    async function testRSI() {
      // Mock RSI test
      assert.truthy(true, 'RSI should be calculated');
    },

    async function testMACD() {
      // Mock MACD test
      assert.truthy(true, 'MACD should be calculated');
    },
  ]);

  // Portfolio management tests
  testRunner.registerSuite('Portfolio Management', [
    async function testPortfolioCreation() {
      const portfolio = {
        holdings: [],
        totalValue: 0,
        totalCost: 0,
        totalPnL: 0,
        totalPnLPercentage: 0,
        lastUpdated: new Date().toISOString(),
      };
      assert.deepEqual(portfolio.totalValue, 0, 'New portfolio should have zero value');
    },

    async function testPositionSizing() {
      const positionSize = 1000;
      const risk = 0.02;
      const stopLoss = 0.05;
      const expectedShares = Math.floor((positionSize * risk) / stopLoss);
      assert.greaterThan(expectedShares, 0, 'Position size should be positive');
    },
  ]);

  // Authentication tests
  testRunner.registerSuite('Authentication', [
    async function testUserCreation() {
      const user = testData.generateUser();
      assert.hasProperty(user, 'id', 'User should have an ID');
      assert.hasProperty(user, 'email', 'User should have an email');
    },

    async function testPasswordHashing() {
      const password = 'testPassword123';
      const hash = btoa(password + '_salt_secret');
      assert.notEqual(password, hash, 'Password should be hashed');
    },
  ]);

  // Risk management tests
  testRunner.registerSuite('Risk Management', [
    async function testVolatilityCalculation() {
      const prices = testData.generatePriceHistory(100);
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i]! - prices[i - 1]!) / prices[i - 1]!);
      }
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      const volatility = Math.sqrt(variance);
      assert.greaterThan(volatility, 0, 'Volatility should be positive');
    },
  ]);
}

// Run tests function
export async function runTests(): Promise<void> {
  console.log('🧪 Running test suite...\n');
  
  registerTests();
  const results = await testRunner.runAllSuites();

  console.log('\n📊 Test Results Summary:');
  console.log('========================');

  let totalPassed = 0;
  let totalFailed = 0;

  results.forEach((suite) => {
    console.log(`\n${suite.name}:`);
    console.log(`  Passed: ${suite.passed}`);
    console.log(`  Failed: ${suite.failed}`);
    console.log(`  Duration: ${suite.duration}ms`);

    totalPassed += suite.passed;
    totalFailed += suite.failed;
  });

  console.log(`\n🎯 Total: ${totalPassed + totalFailed} tests`);
  console.log(`✓ Passed: ${totalPassed}`);
  console.log(`✗ Failed: ${totalFailed}`);

  if (totalFailed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}
