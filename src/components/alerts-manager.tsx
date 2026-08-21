import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertCondition,
  createAlert,
  checkAlerts,
  acknowledgeAlert,
  deleteAlert,
  getTriggeredAlerts,
  createDefaultAlerts,
  validateAlertCondition,
  AlertHistory,
  addToAlertHistory,
  getAlertStatistics,
  NotificationSettings,
  createDefaultNotificationSettings,
} from '@/lib/alerts';
import { Bell, Plus, Check, Trash2, Settings, AlertTriangle } from 'lucide-react';

interface AlertsManagerProps {
  alerts: Alert[];
  onUpdateAlerts: (alerts: Alert[]) => void;
  alertHistory: AlertHistory[];
  onUpdateAlertHistory: (history: AlertHistory[]) => void;
  currentData: Map<string, { price: number; rsi?: number; macd?: number; volume?: number; sentiment?: number }>;
  notificationSettings: NotificationSettings;
  onUpdateNotificationSettings: (settings: NotificationSettings) => void;
}

export function AlertsManager({
  alerts,
  onUpdateAlerts,
  alertHistory,
  onUpdateAlertHistory,
  currentData,
  notificationSettings,
  onUpdateNotificationSettings,
}: AlertsManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState<Partial<AlertCondition>>({
    type: 'price_above',
    value: 0,
    enabled: true,
  });
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const triggeredAlerts = getTriggeredAlerts(alerts);
  const statistics = getAlertStatistics(alerts);

  const handleCreateAlert = () => {
    if (!selectedSymbol || !newAlertCondition.type || newAlertCondition.value === undefined) {
      return;
    }

    const condition = {
      type: newAlertCondition.type as AlertCondition['type'],
      value: newAlertCondition.value,
      enabled: true,
    };

    const validation = validateAlertCondition({ ...condition, symbol: selectedSymbol });
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    const newAlert = createAlert(selectedSymbol.toUpperCase(), condition);
    onUpdateAlerts([...alerts, newAlert]);
    setNewAlertCondition({ type: 'price_above', value: 0, enabled: true });
    setSelectedSymbol('');
    setIsCreateDialogOpen(false);
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    const updatedAlerts = acknowledgeAlert(alertId, alerts);
    onUpdateAlerts(updatedAlerts);
  };

  const handleDeleteAlert = (alertId: string) => {
    const updatedAlerts = deleteAlert(alertId, alerts);
    onUpdateAlerts(updatedAlerts);
  };

  const handleCheckAlerts = () => {
    const updatedAlerts = checkAlerts(alerts, currentData);
    
    // Add newly triggered alerts to history
    updatedAlerts.forEach((alert) => {
      if (alert.triggered && !alerts.find(a => a.id === alert.id)?.triggered) {
        const data = currentData.get(alert.symbol);
        if (data) {
          const updatedHistory = addToAlertHistory(alertHistory, alert, data.price);
          onUpdateAlertHistory(updatedHistory);
        }
      }
    });

    onUpdateAlerts(updatedAlerts);
  };

  const handleCreateDefaultAlerts = (symbol: string) => {
    const defaultConditions = createDefaultAlerts(symbol);
    const newAlerts = defaultConditions
      .filter((condition) => condition.enabled)
      .map((condition) => createAlert(symbol, condition));

    onUpdateAlerts([...alerts, ...newAlerts]);
  };

  const handleToggleAlert = (alertId: string) => {
    const updatedAlerts = alerts.map((alert) =>
      alert.id === alertId
        ? {
            ...alert,
            condition: { ...alert.condition, enabled: !alert.condition.enabled },
          }
        : alert
    );
    onUpdateAlerts(updatedAlerts);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Triggered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{statistics.triggered}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics.acknowledged}</div>
          </CardContent>
        </Card>
      </div>

      {/* Triggered Alerts */}
      {triggeredAlerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-5 w-5" /> Triggered Alerts
            </CardTitle>
            <CardDescription>
              {triggeredAlerts.length} alert(s) need your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {triggeredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{alert.symbol}</Badge>
                      <span className="font-medium">{alert.message}</span>
                    </div>
                    {alert.triggeredAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Triggered at {new Date(alert.triggeredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteAlert(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>Manage your price and indicator alerts</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCheckAlerts}>
                <Bell className="mr-2 h-4 w-4" /> Check Alerts
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" /> Create Alert
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Alert</DialogTitle>
                    <DialogDescription>
                      Set up a custom alert for any stock
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium">Symbol</label>
                      <Input
                        placeholder="AAPL"
                        value={selectedSymbol}
                        onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Alert Type</label>
                      <select
                        className="w-full mt-1 p-2 border rounded-md"
                        value={newAlertCondition.type}
                        onChange={(e) =>
                          setNewAlertCondition({
                            ...newAlertCondition,
                            type: e.target.value as AlertCondition['type'],
                          })
                        }
                      >
                        <option value="price_above">Price Above</option>
                        <option value="price_below">Price Below</option>
                        <option value="rsi_above">RSI Above (Overbought)</option>
                        <option value="rsi_below">RSI Below (Oversold)</option>
                        <option value="macd_crossover">MACD Crossover</option>
                        <option value="volume_spike">Volume Spike</option>
                        <option value="sentiment_change">Sentiment Change</option>
                        <option value="percent_change">Percent Change</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Threshold Value</label>
                      <Input
                        type="number"
                        placeholder="100"
                        value={newAlertCondition.value || ''}
                        onChange={(e) =>
                          setNewAlertCondition({
                            ...newAlertCondition,
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <Button onClick={handleCreateAlert} className="w-full">
                      Create Alert
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Notification Settings</DialogTitle>
                    <DialogDescription>
                      Configure how you want to receive alerts
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Enable Notifications</label>
                      <Switch
                        checked={notificationSettings.enabled}
                        onCheckedChange={(checked) =>
                          onUpdateNotificationSettings({
                            ...notificationSettings,
                            enabled: checked,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email Address</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={notificationSettings.email}
                        onChange={(e) =>
                          onUpdateNotificationSettings({
                            ...notificationSettings,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Push Notifications</label>
                      <Switch
                        checked={notificationSettings.pushEnabled}
                        onCheckedChange={(checked) =>
                          onUpdateNotificationSettings({
                            ...notificationSettings,
                            pushEnabled: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Price Alerts</label>
                      <Switch
                        checked={notificationSettings.priceAlerts}
                        onCheckedChange={(checked) =>
                          onUpdateNotificationSettings({
                            ...notificationSettings,
                            priceAlerts: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Indicator Alerts</label>
                      <Switch
                        checked={notificationSettings.indicatorAlerts}
                        onCheckedChange={(checked) =>
                          onUpdateNotificationSettings({
                            ...notificationSettings,
                            indicatorAlerts: checked,
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Sentiment Alerts</label>
                      <Switch
                        checked={notificationSettings.sentimentAlerts}
                        onCheckedChange={(checked) =>
                          onUpdateNotificationSettings({
                            ...notificationSettings,
                            sentimentAlerts: checked,
                          })
                        }
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No alerts configured. Create your first alert to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    alert.triggered && !alert.acknowledged ? 'bg-orange-50 dark:bg-orange-950' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.condition.enabled ? 'default' : 'secondary'}>
                        {alert.symbol}
                      </Badge>
                      <span className="font-medium">{alert.message}</span>
                      {!alert.condition.enabled && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Switch
                      checked={alert.condition.enabled}
                      onCheckedChange={() => handleToggleAlert(alert.id)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteAlert(alert.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert History */}
      {alertHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alert History</CardTitle>
            <CardDescription>Recent triggered alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alertHistory.slice(0, 20).map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-2 border-b text-sm">
                  <div>
                    <span className="font-medium">{entry.symbol}</span>
                    <span className="text-muted-foreground ml-2">{entry.alertType}</span>
                  </div>
                  <div className="text-right">
                    <div>{entry.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.date).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
