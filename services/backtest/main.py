"""Causa Backtest Microservice — FastAPI + vectorbt + DoWhy"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backtest import run_backtest, BacktestRequest, BacktestResult
from causal import run_causal_validation, CausalRequest, CausalResult

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
