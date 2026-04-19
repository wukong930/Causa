"""Causa Backtest Microservice — FastAPI + vectorbt + DoWhy + AkShare"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backtest import run_backtest, BacktestRequest, BacktestResult
from causal import run_causal_validation, CausalRequest, CausalResult
from akshare_ingest import fetch_futures_daily, fetch_all_symbols, fetch_spread_data

app = FastAPI(title="Causa Backtest Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/backtest", response_model=BacktestResult)
def backtest(req: BacktestRequest):
    try:
        return run_backtest(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/causal", response_model=CausalResult)
def causal(req: CausalRequest):
    try:
        return run_causal_validation(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- AkShare market data endpoints ---

@app.get("/symbols")
def symbols():
    """List all supported futures symbols."""
    return fetch_all_symbols()


@app.get("/market-data/{symbol}")
def market_data(symbol: str, days: int = Query(default=250, le=1000)):
    """Get daily OHLCV for a symbol's main contract."""
    try:
        bars = fetch_futures_daily(symbol, days)
        if not bars:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        return bars
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/market-data/spread/{sym1}/{sym2}")
def spread_data(sym1: str, sym2: str, days: int = Query(default=250, le=1000)):
    """Get daily spread data for two symbols."""
    try:
        data = fetch_spread_data(sym1, sym2, days)
        if not data:
            raise HTTPException(status_code=404, detail=f"No spread data for {sym1}/{sym2}")
        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
