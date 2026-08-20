# 📈 Fin Sentinel Bot — LSTM + News Sentiment Stock Forecast Dashboard

> Live market data, technical indicators, financial-news sentiment analysis, and next-day price predictions — powered by a backtested LSTM sequence model.

🔗 **Live App:** [fin-sentinel-bot.lovable.app](https://fin-sentinel-bot.lovable.app/)
🛠️ **Built with:** [Lovable](https://lovable.dev/)

---

## Overview

**Fin Sentinel Bot** is an AI-powered stock market prediction dashboard that fuses:

- **Live daily OHLCV data** for stocks across multiple markets
- **Causal technical indicators** computed from historical price action
- **Financial news sentiment scoring** to capture market mood
- **An LSTM sequence model** trained on the combined feature set to forecast the next day's closing price
- **Backtested accuracy metrics** so predictions can be evaluated against historical performance

The goal is to see whether blending traditional technical analysis with real-time news sentiment improves short-term price forecasting versus either signal alone.

---

## Features

- 🌍 **Multi-market support** — India (NSE), US, and Global tickers
- 📊 **Ticker presets** — Reliance, TCS, Tata Steel, Tata Motors, Tata Power, Tata Consumer, Infosys, HDFC Bank, NIFTY 50, and more
- 🕒 **Flexible lookback windows** — 6 months, 1 year, 2 years, 5 years
- 🧠 **Sentiment fusion toggle** — turn financial-news sentiment scoring on/off to compare model performance
- 🔁 **Train & predict** — train the LSTM on the selected window and generate a next-day price forecast
- ✅ **Backtesting** — accuracy metrics computed against historical actuals

---

## How It Works

1. **Select a market and ticker** (e.g. `RELIANCE.NS`, `TCS.NS`, `^NSEI`)
2. **Choose a historical lookback window** (6mo – 5y)
3. **Toggle sentiment fusion** to include/exclude financial news sentiment as a model input
4. **Click "Train & predict"** — the app pulls OHLCV data, computes technical indicators, scores recent news sentiment, trains/updates the LSTM, and outputs a next-day forecast alongside backtested accuracy

---

## Tech Stack

| Layer | Details |
|---|---|
| App builder | [Lovable](https://lovable.dev/) |
| Model | LSTM (sequence model) |
| Data | Daily OHLCV market data, financial news sentiment |
| Indicators | Causal technical indicators (no lookahead bias) |
| Evaluation | Backtested prediction accuracy |

---

## Getting Started

This project was generated and is edited via **Lovable**.

### Edit in Lovable
Open the [Lovable project](https://lovable.dev/projects/lovp_3hm2kxj5tw8k68nkxr8t01mq0n) and start prompting. Changes are committed automatically to this repo.

### Edit locally
```bash
# Clone the repo
git clone <YOUR_GIT_URL>
cd fin-sentinel-bot

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Requires [Node.js](https://nodejs.org/) (nvm recommended) and npm.

### Edit directly on GitHub
Navigate to the file you want to edit, click the ✏️ (pencil) icon, make your changes, and commit.

### Edit via GitHub Codespaces
Open the repo → **Code** → **Codespaces** tab → **New codespace**, edit, commit, and push.

---

## Deployment

Open [Lovable](https://lovable.dev/) and use **Share → Publish** to deploy. Custom domains are supported via **Project → Settings → Domains → Connect Domain**.

---

## Disclaimer

⚠️ This dashboard is built for **educational and experimental purposes only**. Predictions from the model are **not financial advice**. Stock markets are influenced by many factors beyond historical price and news sentiment — always do your own research before making investment decisions.

---

## License

Add your preferred license here (e.g. MIT).
