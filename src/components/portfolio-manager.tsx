import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Portfolio,
  PortfolioHolding,
  addHolding,
  removeHolding,
  getPortfolioDiversification,
  getPortfolioPerformance,
  validatePortfolio,
} from '@/lib/portfolio';
import { Plus, Trash2, TrendingUp, TrendingDown, PieChart } from 'lucide-react';

interface PortfolioManagerProps {
  portfolio: Portfolio;
  onUpdatePortfolio: (portfolio: Portfolio) => void;
  currentPrices: Map<string, number>;
}

export function PortfolioManager({ portfolio, onUpdatePortfolio, currentPrices }: PortfolioManagerProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newHolding, setNewHolding] = useState({
    symbol: '',
    name: '',
    quantity: 0,
    price: 0,
    currency: 'USD',
  });
  const [sellQuantity, setSellQuantity] = useState<Record<string, number>>({});

  const diversification = getPortfolioDiversification(portfolio);
  const performance = getPortfolioPerformance(portfolio, new Map());
  const validation = validatePortfolio(portfolio);

  const handleAddHolding = () => {
    if (!newHolding.symbol || !newHolding.name || newHolding.quantity <= 0 || newHolding.price <= 0) {
      return;
    }

    const updatedPortfolio = addHolding(
      portfolio,
      newHolding.symbol.toUpperCase(),
      newHolding.name,
      newHolding.quantity,
      newHolding.price,
      newHolding.currency
    );

    onUpdatePortfolio(updatedPortfolio);
    setNewHolding({ symbol: '', name: '', quantity: 0, price: 0, currency: 'USD' });
    setIsAddDialogOpen(false);
  };

  const handleSellHolding = (symbol: string) => {
    const quantity = sellQuantity[symbol] || 0;
    if (quantity <= 0) return;

    const holding = portfolio.holdings.find((h) => h.symbol === symbol);
    if (!holding) return;

    try {
      const updatedPortfolio = removeHolding(portfolio, symbol, quantity, holding.currentPrice);
      onUpdatePortfolio(updatedPortfolio);
      setSellQuantity({ ...sellQuantity, [symbol]: 0 });
    } catch (error) {
      console.error('Error selling holding:', error);
    }
  };

  const formatCurrency = (value: number, currency?: string) => {
    const currencyCode = currency || portfolio.holdings[0]?.currency || 'USD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(portfolio.totalValue, portfolio.holdings[0]?.currency || 'USD')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(portfolio.totalCost, portfolio.holdings[0]?.currency || 'USD')}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${portfolio.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(portfolio.totalPnL, portfolio.holdings[0]?.currency || 'USD')}
            </div>
            <div className={`text-sm ${portfolio.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(portfolio.totalPnLPercentage)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.holdings.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="holdings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="diversification">Diversification</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Portfolio Holdings</CardTitle>
                  <CardDescription>Manage your stock positions</CardDescription>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Add Position
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Holding</DialogTitle>
                      <DialogDescription>
                        Add a new stock position to your portfolio
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium">Symbol</label>
                        <Input
                          placeholder="AAPL"
                          value={newHolding.symbol}
                          onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Company Name</label>
                        <Input
                          placeholder="Apple Inc."
                          value={newHolding.name}
                          onChange={(e) => setNewHolding({ ...newHolding, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Quantity</label>
                        <Input
                          type="number"
                          placeholder="10"
                          value={newHolding.quantity || ''}
                          onChange={(e) => setNewHolding({ ...newHolding, quantity: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Purchase Price</label>
                        <Input
                          type="number"
                          placeholder="150.00"
                          value={newHolding.price || ''}
                          onChange={(e) => setNewHolding({ ...newHolding, price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Currency</label>
                        <Input
                          placeholder="USD"
                          value={newHolding.currency}
                          onChange={(e) => setNewHolding({ ...newHolding, currency: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleAddHolding} className="w-full">
                        Add to Portfolio
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {portfolio.holdings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No holdings in portfolio. Add your first position to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {portfolio.holdings.map((holding) => {
                    const pnl = (holding.currentPrice - holding.averageCost) * holding.quantity;
                    const pnlPercentage = ((holding.currentPrice - holding.averageCost) / holding.averageCost) * 100;
                    const currentValue = holding.quantity * holding.currentPrice;

                    return (
                      <div
                        key={holding.symbol}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{holding.symbol}</h3>
                            <Badge variant="outline">{holding.quantity} shares</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{holding.name}</p>
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">Avg Cost: </span>
                            {formatCurrency(holding.averageCost, holding.currency)}
                            <span className="ml-4 text-muted-foreground">Current: </span>
                            {formatCurrency(holding.currentPrice, holding.currency)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(currentValue, holding.currency)}</div>
                          <div className={`text-sm ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {pnl >= 0 ? <TrendingUp className="inline h-4 w-4" /> : <TrendingDown className="inline h-4 w-4" />}
                            {formatCurrency(pnl, holding.currency)} ({formatPercentage(pnlPercentage)})
                          </div>
                        </div>
                        <div className="ml-4 flex gap-2">
                          <Input
                            type="number"
                            placeholder="Qty"
                            className="w-20"
                            value={sellQuantity[holding.symbol] || ''}
                            onChange={(e) =>
                              setSellQuantity({
                                ...sellQuantity,
                                [holding.symbol]: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleSellHolding(holding.symbol)}
                            disabled={(sellQuantity[holding.symbol] || 0) <= 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diversification">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" /> Portfolio Diversification
              </CardTitle>
              <CardDescription>Allocation by symbol and sector</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">By Symbol</h3>
                  <div className="space-y-2">
                    {diversification.bySymbol.map((item) => (
                      <div key={item.symbol} className="flex items-center justify-between">
                        <span className="text-sm">{item.symbol}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{item.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">By Sector</h3>
                  <div className="space-y-2">
                    {diversification.bySector.map((item) => (
                      <div key={item.sector} className="flex items-center justify-between">
                        <span className="text-sm">{item.sector}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-secondary rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12 text-right">{item.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>Best and worst performing holdings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-green-600 mb-2">Best Performer</h3>
                  <div className="text-2xl font-bold">{performance.bestPerforming.symbol}</div>
                  <div className="text-green-600">{formatPercentage(performance.bestPerforming.return)}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-red-600 mb-2">Worst Performer</h3>
                  <div className="text-2xl font-bold">{performance.worstPerforming.symbol}</div>
                  <div className="text-red-600">{formatPercentage(performance.worstPerforming.return)}</div>
                </div>
              </div>
              {!validation.isValid && (
                <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <h3 className="font-semibold text-destructive mb-2">Validation Errors</h3>
                  <ul className="list-disc list-inside text-sm text-destructive">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
