# Stock Prediction Dashboard

An educational stock research dashboard that combines market data, technical indicators, financial-news sentiment, and machine-learning forecasts in one interface.

**Live application:** [stock-prediction-6zuz.onrender.com](https://stock-prediction-6zuz.onrender.com/)

> This project is for research and education. Forecasts are not financial advice, and no model can guarantee investment returns.

## What It Does

- Displays daily OHLCV market data for supported stock and index symbols.
- Calculates technical indicators from historical price data.
- Analyzes financial-news sentiment and optionally includes it in the forecast.
- Trains an LSTM sequence model and generates a next-day closing-price forecast.
- Shows backtesting metrics so forecasts can be evaluated against historical results.
- Provides portfolio, alerts, risk-management, backtesting, and market-analysis utilities in the TypeScript application layer.

## How A Forecast Works

1. Select a market and ticker, such as `RELIANCE.NS`, `TCS.NS`, or `^NSEI`.
2. Choose a historical lookback period.
3. Enable or disable news-sentiment features.
4. Start training and prediction.
5. Review the forecast, indicators, sentiment, and historical evaluation metrics together.

The model output is an estimate based on historical data and selected features. It should be treated as an experiment, not a trading signal.

## Technology

| Area | Technology |
| --- | --- |
| Frontend and server | React 19, TanStack Router, TanStack Start, TypeScript |
| Build system | Vite 8, Nitro, Tailwind CSS 4 |
| UI | Radix UI, Lucide React, Recharts |
| Market data | Yahoo Finance through the application data services |
| Forecasting | LSTM sequence model and technical features |
| Sentiment | Financial-news analysis with an optional OpenAI assistant integration |
| Container | Docker with Node.js 22 Alpine |
| Hosting | Render Web Service |
| Supporting ML API | Optional FastAPI service under `python/` |

## Repository Layout

```text
src/
  components/       Reusable application and UI components
  lib/              Market, forecast, sentiment, portfolio, and risk utilities
  routes/           TanStack Router pages
  server.ts         Server entrypoint and SSR error handling
python/
  backend/          Optional FastAPI backend
  ml/               Feature engineering, preprocessing, models, and training
  tests/            Python unit and API tests
Dockerfile          Main production container
Dockerfile.websocket WebSocket container definition
render.yaml         Render Blueprint configuration
```

## Run Locally

### Requirements

- Node.js 22 or newer
- npm 10 or newer
- Python 3.10 or newer if you use the optional Python services

Node 18 is not supported by the current Vite, Rolldown, Nitro, and TanStack dependencies.

### Install and start the web application

```bash
git clone https://github.com/rohanrai8565/stock-prediction.git
cd stock-prediction
npm ci
npm run dev
```

Open the local URL shown by Vite, normally `http://localhost:5173`.

### Environment variables

Create a `.env` file in the project root and fill in the values locally:

```env
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
ASSISTANT_MODE=auto
```

The main application variables are:

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Optional | Server-only key for the OpenAI assistant integration |
| `OPENAI_MODEL` | Optional | Assistant model, default `gpt-4o-mini` |
| `ASSISTANT_MODE` | Optional | `auto`, `local`, or `openai`; default `auto` |
| `DATABASE_URL` | Optional | Database connection string when persistence is enabled |
| `REDIS_URL` | Optional | Redis connection string when caching is enabled |

Never commit `.env`, expose an API key through a `VITE_*` variable, or place credentials in example files. Use an empty value or a descriptive placeholder in `.env.example`.

## Verify Changes

```bash
npm run build
npm run lint
```

Run the optional Python test suite from the repository root:

```bash
python -m pip install -r python/requirements.txt
pytest -q python/tests
```

## Docker

Build and run the main application locally:

```bash
docker build -t stock-prediction .
docker run --rm -p 3000:3000 --env-file .env stock-prediction
```

The production container uses Nitro's Node server output and listens on the `PORT` environment variable, defaulting to port `3000`.

The repository also contains a `docker-compose.yml` for the broader local stack, including PostgreSQL, Redis, the web application, Nginx, and the optional WebSocket service.

## Deploy To Render

The repository includes [`render.yaml`](render.yaml), which defines the web service and enables automatic deployment from the `main` branch.

1. Open the Render dashboard and choose **New > Blueprint**.
2. Select `rohanrai8565/stock-prediction`.
3. Confirm the `stock-prediction` web service from `render.yaml`.
4. Add `OPENAI_API_KEY` as a secret environment variable if the assistant is enabled.
5. Deploy and wait for the health check at `/` to pass.

Render builds the application with [`Dockerfile`](Dockerfile), uses Node.js 22, and automatically provides the `PORT` value required by the server.

## Security

- Keep API keys and database credentials in environment variables or Render secret settings.
- Rotate any key that has ever been committed, pasted into logs, or shared publicly.
- Do not use `VITE_` for server-only credentials because Vite exposes those variables to browser code.
- Treat market-data credentials and generated model artifacts as sensitive operational data.

## Disclaimer

This dashboard is an experimental research tool. Historical backtests do not predict future performance. Forecasts may be inaccurate, delayed, or unavailable when market-data providers, news sources, model services, or external APIs fail. Always verify information independently and consult a qualified financial professional before making investment decisions.

## License

No license has been declared yet. Add a `LICENSE` file before distributing this project as open-source software.
