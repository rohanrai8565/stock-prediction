# Market Mind AI

You are a Senior AI/ML Engineer, Python Developer, NLP Engineer, Backend Developer, and Full-Stack Software Architect.

I am building a major/final-year project titled:

"AI-Based Stock Market Prediction Using LSTM and News Sentiment Analysis"

I already have the project structure and backend partially implemented. I now want you to focus ONLY on the IMPLEMENTATION of the complete working project.

Do not give me a theoretical explanation first. Do not redesign the project unnecessarily. Inspect the existing code structure/files I provide and extend or correct them while preserving working functionality.

==================================================

CORE PROJECT REQUIREMENT

==================================================

Build a complete end-to-end stock prediction system using:

1. Historical stock market data

2. Technical indicators

3. LSTM time-series forecasting

4. Financial news collection

5. Financial news sentiment analysis

6. Market + sentiment feature fusion

7. Model training and evaluation

8. REST APIs

9. Interactive frontend dashboard

10. Database persistence where useful

The final application must be actually runnable, not pseudo-code.

==================================================

TECHNOLOGY STACK

==================================================

Backend:

- Python

- FastAPI

- Uvicorn

- Pydantic

Machine Learning:

- TensorFlow/Keras

- NumPy

- Pandas

- Scikit-learn

Stock Data:

- yfinance as the default provider

- Make the provider configurable

NLP:

- Prefer FinBERT or another suitable financial sentiment model

- Use a practical fallback if FinBERT is unavailable

News:

- Configurable news provider

- Support mock data for development

- Support a real news API through environment variables

Frontend:

- React.js or Next.js

- TypeScript where appropriate

- Tailwind CSS

- Recharts/Chart.js or another suitable chart library

Database:

- PostgreSQL preferred

- SQLAlchemy if required

==================================================

ENVIRONMENT CONFIGURATION

==================================================

Use .env and never hard-code API keys.

Example:

DATA_PROVIDER=yfinance

STOCK_API_KEY=

NEWS_PROVIDER=mock

NEWS_API_KEY=

STOCK_SYMBOL=AAPL

START_DATE=2022-01-01

END_DATE=2026-01-01

LOOKBACK=60

PREDICTION_HORIZON=1

EPOCHS=50

BATCH_SIZE=32

DATABASE_URL=...

The stock provider must not require STOCK_API_KEY when DATA_PROVIDER=yfinance.

The system must validate environment variables and provide useful error messages.

==================================================

STOCK DATA IMPLEMENTATION

==================================================

Implement a robust stock-data loader.

Using yfinance, retrieve:

- Open

- High

- Low

- Close

- Adjusted Close where available

- Volume

The loader must support:

- AAPL

- MSFT

- GOOGL

- TSLA

- TCS.NS

- INFY.NS

- RELIANCE.NS

- HDFCBANK.NS

- ICICIBANK.NS

Do not hard-code these stocks.

The user must be able to enter any valid Yahoo Finance symbol.

Implement:

- Validation

- Empty-data detection

- Network-error handling

- Retry logic

- Timeout/error handling where supported

- Clear exceptions

- Logging

- Date validation

- Minimum-data validation

Do NOT report a valid stock as "delisted" merely because a temporary Yahoo Finance request failed.

Do not crash the entire application unnecessarily.

==================================================

DATA PREPROCESSING

==================================================

Implement a reusable preprocessing pipeline.

Perform:

- Missing-value handling

- Duplicate removal

- Date normalization

- Chronological sorting

- Numeric conversion

- Data validation

- Feature generation

- Scaling

- Sequence generation

IMPORTANT:

Never randomly shuffle financial time-series data before train/test splitting.

Use chronological splitting.

Prevent data leakage.

The scaler must be fitted only on training data.

==================================================

TECHNICAL INDICATORS

==================================================

Implement useful indicators such as:

- SMA

- EMA

- RSI

- MACD

- MACD Signal

- Bollinger Upper Band

- Bollinger Lower Band

- Daily Return

- Volatility

- Momentum

Make the indicator implementation modular.

Do not use future information when calculating features.

==================================================

NEWS IMPLEMENTATION

==================================================

Implement a configurable news service.

Each article should contain:

- title

- source

- published_at

- URL where available

- stock symbol/company

Support mock news during development.

Support a real news provider through:

NEWS_PROVIDER

NEWS_API_KEY

Do not fabricate real news.

If the API fails, return a controlled error or use mock data only when explicitly configured.

==================================================

SENTIMENT ANALYSIS

==================================================

Implement a dedicated sentiment-analysis module.

Pipeline:

News headline

→ preprocessing

→ financial NLP model

→ sentiment label

→ sentiment score

→ daily aggregation

Output:

- positive

- neutral

- negative

- sentiment score

Aggregate sentiment by trading date.

Avoid look-ahead bias.

Only use news that would have been available before the prediction cutoff.

==================================================

LSTM MODEL

==================================================

Implement two models.

MODEL 1:

Market-only LSTM

Features:

- OHLCV

- technical indicators

MODEL 2:

Market + Sentiment LSTM

Features:

- OHLCV

- technical indicators

- news sentiment

Use a configurable lookback window, default:

LOOKBACK=60

Sequence:

X[t-60:t] → y[t]

Use a sensible LSTM architecture with:

- LSTM layers

- Dropout

- Dense layer

- Adam optimizer

- appropriate loss function

- EarlyStopping

- ModelCheckpoint

- optional learning-rate scheduling

Do not blindly choose hyperparameters.

Keep them configurable.

==================================================

PREDICTION

==================================================

Primary prediction:

Next trading day's closing price.

Also calculate:

- Current price

- Predicted price

- Absolute change

- Percentage change

- Predicted direction: UP/DOWN

Do not claim guaranteed prediction accuracy.

Do not generate fake confidence percentages.

==================================================

MODEL EVALUATION

==================================================

Implement:

Regression:

- MAE

- MSE

- RMSE

- MAPE

- R²

Directional evaluation:

- Directional Accuracy

Compare:

1. Naive previous-close baseline

2. LSTM market-only

3. LSTM market + technical indicators

4. LSTM market + technical indicators + sentiment

Do not fabricate results.

If a model has not been trained, report that it has not been evaluated.

Save evaluation results to a structured format.

==================================================

MODEL STORAGE

==================================================

Save models using appropriate Keras format.

Example:

models/

    lstm_market_only.keras

    lstm_sentiment.keras

Also save:

- scaler

- feature list

- model configuration

- training date

- dataset period

- hyperparameters

- evaluation metrics

Use versioned/model metadata where practical.

==================================================

BACKEND API

==================================================

Implement clean FastAPI endpoints.

At minimum:

GET /api/health

GET /api/stocks/search

GET /api/stocks/{symbol}/history

GET /api/stocks/{symbol}/technical-indicators

GET /api/stocks/{symbol}/news

GET /api/stocks/{symbol}/sentiment

POST /api/predict

GET /api/predictions/{symbol}

GET /api/model/performance

Use Pydantic schemas.

Return proper HTTP status codes.

Handle errors properly.

Do not expose internal stack traces to API users.

==================================================

FRONTEND

==================================================

Implement a professional responsive dashboard.

Include:

1. Stock selector/search

2. Date range

3. Historical price chart

4. Volume chart

5. Technical indicators

6. News list

7. Sentiment labels

8. Sentiment summary

9. Current price

10. Predicted price

11. Expected percentage change

12. UP/DOWN prediction

13. Model metrics

14. Actual vs predicted chart

15. Prediction history

16. Loading states

17. Error states

18. Empty states

The UI should look like a serious AI/finance application, not a basic HTML demo.

==================================================

DATABASE

==================================================

Use PostgreSQL if database functionality is already present or required.

Store useful persistent information such as:

- stock metadata

- news articles

- sentiment results

- prediction history

- model metadata

- evaluation metrics

Do not store unnecessary duplicate market data.

Use SQLAlchemy models and migrations where appropriate.

==================================================

PROJECT STRUCTURE

==================================================

Maintain a clean structure similar to:

project/

│

├── backend/

│   ├── app/

│   │   ├── main.py

│   │   ├── routes/

│   │   ├── services/

│   │   ├── models/

│   │   ├── schemas/

│   │   ├── utils/

│   │   └── config/

│   └── requirements.txt

│

├── ml/

│   ├── preprocessing/

│   ├── features/

│   ├── sentiment/

│   ├── models/

│   ├── training/

│   └── evaluation/

│

├── frontend/

│   └── ...

│

├── models/

├── tests/

├── .env

├── .env.example

├── .gitignore

├── train_model.py

└── README.md

If my existing structure differs, inspect it first and adapt to it instead of unnecessarily restructuring everything.

==================================================

IMPORTANT: EXISTING CODE

==================================================

I already have working code.

Before changing anything:

1. Inspect the existing project.

2. Identify what is already implemented.

3. Identify broken/incomplete components.

4. Reuse working modules.

5. Modify only what is necessary.

6. Keep APIs and imports compatible.

7. Do not delete working functionality without a strong reason.

I previously encountered this yfinance training error:

"$AAPL: possibly delisted; no timezone found"

and:

"DataProviderError: Failed to load data: yfinance error: No data found for symbol: AAPL"

Fix the implementation so temporary provider failures, empty responses, invalid symbols, and network problems are handled robustly.

Do not assume AAPL is actually delisted simply because a request failed.

==================================================

TRAINING COMMAND

==================================================

The final project must support:

python train_model.py

and it should:

1. Load configuration

2. Load stock data

3. Validate data

4. Calculate technical indicators

5. Collect/process sentiment if enabled

6. Prepare features

7. Split chronologically

8. Scale correctly

9. Create sequences

10. Train market-only model

11. Train sentiment model

12. Evaluate both

13. Save models

14. Save scalers

15. Save metrics

16. Print a clear training summary

==================================================

CODE QUALITY

==================================================

Every implementation must be:

- Complete

- Runnable

- Modular

- Maintainable

- Type-safe where practical

- Properly logged

- Properly error-handled

- Free from hard-coded API keys

- Free from fake results

- Free from placeholder implementations

Never write:

"implement this yourself"

"remaining code"

"TODO: add code"

unless it is genuinely optional and clearly explained.

When fixing a file, provide the COMPLETE corrected file.

==================================================

TESTING

==================================================

Implement tests for:

- Stock data loading

- Invalid symbols

- Empty data

- Technical indicators

- Sequence generation

- Sentiment processing

- API endpoints

- Prediction pipeline

Include commands to run the tests.

==================================================

IMPORTANT ML RULES

==================================================

Strictly prevent:

- Data leakage

- Future-data usage

- Random time-series splitting

- Fitting scalers on test data

- Future news contamination

- Fake evaluation results

The system must distinguish clearly between:

Training data

Validation data

Test data

Live prediction data

==================================================

DEPLOYMENT

==================================================

Provide a working deployment configuration when implementation is complete.

Use environment variables.

Provide:

- backend startup command

- frontend startup command

- model training command

- database setup command

- test command

Docker/Docker Compose can be used if useful.

==================================================

IMPLEMENTATION RESPONSE FORMAT

==================================================

When modifying or creating files, use:

FILE: path/to/file.py

Then provide the COMPLETE contents.

For every changed file, explain briefly:

- Why it was changed

- What it does

- What dependencies it requires

Then provide the exact command to run/test it.

Do not give only snippets when a complete file is needed.

==================================================

IMPLEMENTATION ORDER

==================================================

Implement in this order:

PHASE 1:

Fix and verify stock data loading.

PHASE 2:

Implement/verify preprocessing and technical indicators.

PHASE 3:

Implement news provider.

PHASE 4:

Implement financial sentiment analysis.

PHASE 5:

Implement feature fusion.

PHASE 6:

Implement market-only LSTM.

PHASE 7:

Implement LSTM + sentiment.

PHASE 8:

Implement evaluation and comparison.

PHASE 9:

Implement model saving/loading.

PHASE 10:

Connect prediction pipeline to FastAPI.

PHASE 11:

Connect frontend dashboard.

PHASE 12:

Implement database persistence.

PHASE 13:

Testing.

PHASE 14:

Deployment and documentation.

==================================================

START NOW

==================================================

Do not give me theory.

Do not give me the complete project in one giant response.

Start with PHASE 1 only.

Inspect my existing implementation and fix the stock-data pipeline, especially the yfinance issue.

After making the changes, provide:

1. Exact files changed

2. Complete corrected code for each changed file

3. Required pip commands

4. .env configuration

5. Exact command to test yfinance

6. Exact command to run training

7. Expected successful output

8. Any dependency/version issues that need to be addressed

Do not proceed to Phase 2 until Phase 1 works successfully.   give full deploy project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ee190057-05e6-4be7-aac9-bc04d77cc3e9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
