"""Causa Backtest Microservice — FastAPI + vectorbt + DoWhy + AkShare"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backtest import run_backtest, BacktestRequest, BacktestResult
from causal import run_causal_validation, CausalRequest, CausalResult
from optimizer import run_optimize, OptimizeRequest, OptimizeResult
from walk_forward import run_walk_forward, WalkForwardRequest, WalkForwardResult
from akshare_ingest import fetch_realtime_quotes
from akshare_ingest import fetch_futures_daily, fetch_all_symbols, fetch_spread_data, fetch_term_structure
from industry_data import (
    fetch_inventory, fetch_spot_price, fetch_basis,
    fetch_position_rank, fetch_position_rank_multi,
    fetch_volatility_index, fetch_fund_flow, fetch_weather,
    fetch_fx_rate, fetch_shipping_bdi, fetch_macro_pmi, fetch_cftc_holding,
)
from tushare_ingest import fetch_daily_tushare, fetch_daily_as_market_bar
import os

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


@app.post("/optimize", response_model=OptimizeResult)
def optimize(req: OptimizeRequest):
    try:
        return run_optimize(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/walk-forward", response_model=WalkForwardResult)
def walk_forward(req: WalkForwardRequest):
    try:
        return run_walk_forward(req)
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


@app.get("/market-data/tushare/{symbol}")
def market_data_tushare(symbol: str, days: int = Query(default=5, le=30)):
    """Get daily OHLCV + OI/settle from Tushare (richer than AkShare)."""
    bars = fetch_daily_tushare(symbol, days)
    if not bars:
        raise HTTPException(status_code=404, detail=f"No Tushare data for {symbol}")
    return bars


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


@app.get("/term-structure/{symbol}")
def term_structure(symbol: str):
    """Get term structure (all active contract months) for a symbol."""
    try:
        points = fetch_term_structure(symbol)
        if not points:
            raise HTTPException(status_code=404, detail=f"No term structure for {symbol}")
        return points
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/realtime")
def realtime():
    """Get realtime price snapshot for all monitored futures."""
    quotes = fetch_realtime_quotes()
    return quotes


# --- Industry data endpoints ---

@app.get("/industry/inventory/{symbol}")
def inventory(symbol: str, limit: int = Query(default=60, le=500)):
    """Get exchange inventory / warehouse receipt data."""
    data = fetch_inventory(symbol, limit)
    if not data:
        raise HTTPException(status_code=404, detail=f"No inventory data for {symbol}")
    return data


@app.get("/industry/spot-price/{symbol}")
def spot_price(symbol: str):
    """Get current spot (cash) price."""
    data = fetch_spot_price(symbol, limit=1)
    if not data:
        raise HTTPException(status_code=404, detail=f"No spot price for {symbol}")
    return data


@app.get("/industry/basis/{symbol}")
def basis(symbol: str):
    """Get basis = spot - futures."""
    result = fetch_basis(symbol)
    if not result:
        raise HTTPException(status_code=404, detail=f"Cannot calculate basis for {symbol}")
    return result


@app.get("/industry/position-rank/{symbol}")
def position_rank(symbol: str):
    """Get top trader position rankings (龙虎榜)."""
    data = fetch_position_rank(symbol)
    if not data:
        raise HTTPException(status_code=404, detail=f"No position rank data for {symbol}")
    return data


@app.get("/industry/volatility")
def volatility():
    """Get 50ETF volatility index (iVX/QVIX)."""
    data = fetch_volatility_index()
    if not data:
        raise HTTPException(status_code=404, detail="No volatility index data")
    return data


@app.get("/industry/fund-flow")
def fund_flow():
    """Get northbound/southbound fund flow (沪深港通)."""
    data = fetch_fund_flow()
    if not data:
        raise HTTPException(status_code=404, detail="No fund flow data")
    return data


@app.get("/industry/weather/{symbol}")
def weather(symbol: str):
    """Get weather data for agricultural commodity production regions."""
    api_key = os.environ.get("OPENWEATHERMAP_API_KEY", "")
    data = fetch_weather(symbol, api_key)
    if not data:
        raise HTTPException(status_code=404, detail=f"No weather data for {symbol}")
    return data


@app.get("/industry/fx-rate")
def fx_rate():
    """Get USD/CNY spot exchange rate."""
    data = fetch_fx_rate()
    if not data:
        raise HTTPException(status_code=404, detail="No FX rate data")
    return data


@app.get("/industry/shipping-bdi")
def shipping_bdi():
    """Get Baltic Dry Index."""
    data = fetch_shipping_bdi()
    if not data:
        raise HTTPException(status_code=404, detail="No BDI data")
    return data


@app.get("/industry/macro-pmi")
def macro_pmi():
    """Get China manufacturing PMI."""
    data = fetch_macro_pmi()
    if not data:
        raise HTTPException(status_code=404, detail="No PMI data")
    return data


@app.get("/industry/cftc")
def cftc():
    """Get CFTC Commitments of Traders net positions."""
    data = fetch_cftc_holding()
    if not data:
        raise HTTPException(status_code=404, detail="No CFTC data")
    return data


@app.get("/industry/position-rank-v2/{symbol}")
def position_rank_v2(symbol: str):
    """Get position rank from correct exchange (SHFE/CZCE/GFEX/DCE)."""
    data = fetch_position_rank_multi(symbol)
    if not data:
        raise HTTPException(status_code=404, detail=f"No position rank for {symbol}")
    return data
