"""RBHU Sales Analytics Service (Module 3).

Design:
  - FastAPI exposes POST /analyze (multipart CSV upload).
  - pandas does parsing/aggregation; column names are normalised
    (case/whitespace/underscore tolerant) so slightly different CSVs still work.
  - Charts are built with plotly.graph_objects and returned as JSON figure
    specs (portable; the web app can render them directly with plotly.js).
  - Bonus: ?format=png renders PNG via kaleido and returns base64 payloads.
    failures here degrade gracefully (png_export_available: false).

Evaluation focus: clean API design, robust input validation, error handling.
"""
from __future__ import annotations

import base64
import io
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import pandas as pd
import plotly.graph_objects as go
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rbhu-analytics")

RBR_COLORS = [
    "#636efa", "#EF553B", "#00cc96", "#ab63fa", "#FFA15A",
    "#19d3f3", "#FF6692", "#B6E880", "#FF97FF", "#FECB52",
]

# Optional PNG export (Bonus) – probed at startup, never crashes the service
kaleido_available = False
try:  # pragma: no cover
    import plotly.io as pio  # noqa: N813

    pio.kaleido  # type: ignore[truthy-function]
    kaleido_available = True
    log.info("kaleido available – PNG export enabled")
except Exception:  # noqa: BLE001
    log.warning("kaleido not available – PNG export will return empty (ui falls back to JSON)")


def _encode_png(fig: go.Figure) -> Optional[str]:
    """Render a figure to base64 PNG, or None when kaleido is missing."""
    if not kaleido_available:
        return None
    try:  # pragma: no cover
        import plotly.io as pio  # noqa: N813

        data = pio.to_image(fig, format="png", scale=2, width=900, height=520)
        return base64.b64encode(data).decode()
    except Exception:  # noqa: BLE001
        log.exception("PNG export failed for a chart")
        return None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    log.info("analytics service up")
    yield


app = FastAPI(title="RBHU Sales Analytics", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ----------------------------------------------------------------- helpers
def _norm_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise header names: lower/case-insensitive, ignore spaces/underscores."""
    df = df.rename(columns=lambda c: str(c).strip().lower().replace("_", "").replace(" ", ""))
    aliases = {
        "salesperson": "salesperson",
        "salesman": "salesperson",
        "rep": "salesperson",
        "seller": "salesperson",
        "name": "salesperson",
        "revenue": "revenue",
        "sales": "revenue",
        "amount": "revenue",
        "region": "region",
        "zone": "region",
        "territory": "region",
    }
    df = df.rename(columns=lambda c: aliases.get(c, c))
    missing = {"salesperson", "revenue"} - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "Missing required column(s)",
                "required": sorted(missing),
                "received": list(df.columns),
            },
        )
    if "region" not in df.columns:
        df["region"] = "Unknown"
    return df


def _parse_csv(raw_bytes: bytes) -> pd.DataFrame:
    """Decode + validate the uploaded CSV into a normalised, numeric frame."""
    try:
        text = raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise HTTPException(422, f"CSV must be UTF-8 encoded: {e}") from e

    df = pd.read_csv(io.StringIO(text))
    df = _norm_cols(df)

    df = df[["salesperson", "revenue", "region"]].copy()
    df["salesperson"] = df["salesperson"].astype(str).str.strip()
    df["region"] = df["region"].astype(str).str.strip()
    df["revenue"] = pd.to_numeric(df["revenue"], errors="coerce")
    df = df.dropna(subset=["salesperson", "revenue"])
    df = df[df["salesperson"].ne("") & df["revenue"].gt(0)]

    if df.empty:
        raise HTTPException(
            422,
            "No valid rows found – every row needs a salesperson name and a positive numeric revenue",
        )
    return df


def _build_charts(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Revenue-by-region + top-salespeople Plotly figures."""
    by_region = df.groupby("region", as_index=False)["revenue"].sum().sort_values("revenue", ascending=False)
    top = df.groupby("salesperson", as_index=False)["revenue"].sum().sort_values("revenue", ascending=False).head(10)

    rbr = go.Figure(
        data=[
            go.Bar(
                x=[str(v) for v in by_region["region"]],
                y=[float(v) for v in by_region["revenue"]],
                marker_color=RBR_COLORS[: len(by_region)],
                text=[f"{v:,.0f}" for v in by_region["revenue"]],
                textposition="auto",
            )
        ],
        layout=go.Layout(
            title={"text": "Revenue by Region", "font": {"size": 16}},
            xaxis={"title": "Region"},
            yaxis={"title": "Revenue"},
            plot_bgcolor="white",
            paper_bgcolor="white",
        ),
    )

    topf = go.Figure(
        data=[
            go.Bar(
                x=[str(v) for v in top["salesperson"]],
                y=[float(v) for v in top["revenue"]],
                marker_color="#1e1b4b",
                text=[f"{v:,.0f}" for v in top["revenue"]],
                textposition="auto",
            )
        ],
        layout=go.Layout(
            title={"text": "Top Salespeople by Revenue", "font": {"size": 16}},
            xaxis={"title": "Salesperson"},
            yaxis={"title": "Revenue"},
            plot_bgcolor="white",
            paper_bgcolor="white",
        ),
    )
    return [rbr.to_plotly_json(), topf.to_plotly_json()]


# ------------------------------------------------------------------ routes
@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "service": "rbhu-analytics", "pngExport": kaleido_available}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(..., description="CSV with columns salesperson,revenue,region"),
    format: str = "json",
) -> JSONResponse:
    """Analyse an uploaded sales CSV.

    - JSON (default): plotly figure specs + summary statistics
    - format=png: same payload + base64 PNG renders (Bonus), when kaleido is installed
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(422, "Uploaded CSV is empty")

    try:
        df = _parse_csv(raw)
    except pd.errors.EmptyDataError as e:
        raise HTTPException(422, f"CSV could not be parsed: {e}") from e
    except pd.errors.ParserError as e:
        raise HTTPException(422, f"CSV structure invalid: {e}") from e

    revenue = df["revenue"]
    stats: Dict[str, Any] = {
        "count": int(revenue.count()),
        "salespeople": int(df["salesperson"].nunique()),
        "regions": int(df["region"].nunique()),
        "total": float(revenue.sum()),
        "mean": float(revenue.mean()),
        "median": float(revenue.median()),
        "min": float(revenue.min()),
        "max": float(revenue.max()),
        "std": float(revenue.std()),
    }

    charts = _build_charts(df)
    payload: Dict[str, Any] = {
        "summary": stats,
        "charts": {
            "revenueByRegion": charts[0],
            "topSalespeople": charts[1],
        },
        "rowsAnalyzed": int(len(df)),
        "pngExportAvailable": kaleido_available,
    }

    if format == "png":
        payload["png"] = {
            "revenueByRegion": _encode_png(charts[0]),
            "topSalespeople": _encode_png(charts[1]),
        }

    return JSONResponse(payload)
