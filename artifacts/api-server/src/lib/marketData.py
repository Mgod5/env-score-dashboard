#!/usr/bin/env python3
"""
Market data fetcher using Polygon.io REST API.
Fetches H1 (hourly) OHLCV data, calculates ATR, ADX, momentum, volume,
and VIX for scoring. Includes a sub-score tie-breaker when multiple
instruments reach 100.

Accepts an optional INSTRUMENTS_JSON environment variable containing a
JSON array of { name, displayTicker, polyTicker } objects. If omitted,
defaults to BTCUSD / XAUUSD / EURUSD.
"""

import sys
import json
import os
import datetime
import math
import urllib.request
import urllib.error


API_KEY = os.environ.get("POLYGON_API_KEY", "")
BASE_URL = "https://api.polygon.io/v2/aggs/ticker"

# Instruments whose scoring is precisely calibrated
KNOWN_INSTRUMENTS = {"BTCUSD", "XAUUSD", "EURUSD"}

DEFAULT_INSTRUMENTS = [
    {"name": "BTCUSD", "displayTicker": "BTC-USD",  "polyTicker": "X:BTCUSD"},
    {"name": "XAUUSD", "displayTicker": "GC=F",     "polyTicker": "C:XAUUSD"},
    {"name": "EURUSD", "displayTicker": "EURUSD=X", "polyTicker": "C:EURUSD"},
]


# ---------------------------------------------------------------------------
# Polygon fetch helpers
# ---------------------------------------------------------------------------

def fetch_polygon_bars(ticker, from_date, to_date, timespan="hour", multiplier=1):
    """Fetch aggregate bars from Polygon.io."""
    url = (
        f"{BASE_URL}/{ticker}/range/{multiplier}/{timespan}"
        f"/{from_date}/{to_date}"
        f"?adjusted=true&sort=asc&limit=5000&apiKey={API_KEY}"
    )
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} from Polygon for {ticker}: {e.reason}")
    except Exception as e:
        raise RuntimeError(f"Request failed for {ticker}: {e}")

    if data.get("status") not in ("OK", "DELAYED"):
        raise RuntimeError(
            f"Polygon status '{data.get('status')}' for {ticker}: "
            f"{data.get('error', data.get('message', 'unknown error'))}"
        )

    results = data.get("results") or []
    if not results:
        raise RuntimeError(f"No bars returned from Polygon for {ticker}")
    return results


def fetch_vix(from_date, to_date):
    """
    Fetch the latest VIX level via Polygon (paid plan supports I:VIX).
    Returns the most-recent daily close, or None if unavailable.
    """
    try:
        bars = fetch_polygon_bars("I:VIX", from_date, to_date, timespan="day")
        return float(bars[-1]["c"])
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Technical indicator calculations (pure Python, no external TA libraries)
# ---------------------------------------------------------------------------

def calculate_atr(bars, period=14):
    """ATR using Wilder's EMA smoothing."""
    trs = []
    for i in range(1, len(bars)):
        h, l, pc = bars[i]["h"], bars[i]["l"], bars[i - 1]["c"]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))

    if not trs:
        return 0.0
    if len(trs) < period:
        return sum(trs) / len(trs)

    atr   = sum(trs[:period]) / period
    alpha = 1.0 / period
    for tr in trs[period:]:
        atr = alpha * tr + (1 - alpha) * atr
    return atr


def calculate_adx(bars, period=14):
    """ADX using Wilder's EMA smoothing."""
    plus_dms, minus_dms, trs = [], [], []

    for i in range(1, len(bars)):
        h, l, ph, pl, pc = (
            bars[i]["h"], bars[i]["l"],
            bars[i - 1]["h"], bars[i - 1]["l"], bars[i - 1]["c"],
        )
        up, down = h - ph, pl - l
        plus_dms.append(up   if (up > down and up > 0)   else 0.0)
        minus_dms.append(down if (down > up and down > 0) else 0.0)
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))

    if len(trs) < period:
        return 20.0

    alpha = 1.0 / period
    atr_s  = sum(trs[:period])      / period
    pdi_s  = sum(plus_dms[:period]) / period
    mdi_s  = sum(minus_dms[:period])/ period

    dxs = []
    for i in range(period, len(trs)):
        atr_s = alpha * trs[i]       + (1 - alpha) * atr_s
        pdi_s = alpha * plus_dms[i]  + (1 - alpha) * pdi_s
        mdi_s = alpha * minus_dms[i] + (1 - alpha) * mdi_s
        if atr_s == 0:
            continue
        pdi = 100 * pdi_s / atr_s
        mdi = 100 * mdi_s / atr_s
        denom = pdi + mdi
        dxs.append(100 * abs(pdi - mdi) / denom if denom else 0.0)

    if not dxs:
        return 20.0

    adx = sum(dxs[:period]) / min(period, len(dxs))
    for dx in dxs[period:]:
        adx = alpha * dx + (1 - alpha) * adx
    return adx


def calculate_momentum(bars):
    """7-day % return: (current_close - close_7d_ago) / close_7d_ago * 100."""
    current_close = bars[-1]["c"]
    lookback      = min(168, len(bars) - 1)
    past_close    = bars[-lookback]["c"]
    if past_close == 0:
        return 0.0
    return (current_close - past_close) / past_close * 100


def calculate_avg_volume(bars):
    """Average hourly volume over the available bars."""
    vols = [b.get("v", 0) for b in bars]
    return sum(vols) / len(vols) if vols else 0.0


# ---------------------------------------------------------------------------
# Scoring logic — known instruments use calibrated formulas; all others
# fall back to a generic ATR% + ADX model.
# ---------------------------------------------------------------------------

def base_score(name, atr_val, adx_val, last_price=None):
    """Primary environment score (0–100)."""
    if name == "BTCUSD":
        return min(100.0, max(0.0, (atr_val / 5000 * 50) + (adx_val * 2)))
    if name == "XAUUSD":
        return min(100.0, max(0.0, (atr_val / 2 * 30) + (adx_val * 3.5)))
    if name == "EURUSD":
        return min(100.0, max(0.0, 100 - (atr_val / 0.005 * 50) + (adx_val * 1.5)))

    # Generic: normalise ATR as % of price + ADX component
    if last_price and last_price > 0:
        atr_pct = atr_val / last_price * 100
    else:
        atr_pct = 1.0
    atr_component = min(50.0, atr_pct * 15.0)
    adx_component = min(50.0, adx_val * 1.5)
    return min(100.0, max(0.0, atr_component + adx_component))


def sub_score(name, momentum, vix, avg_volume):
    """Tie-breaker sub-score (0–10) with human-readable reasons."""
    points = 0
    reasons = []

    if name == "BTCUSD":
        if momentum > 5:
            points += 5
            reasons.append(f"strong momentum ({momentum:+.1f}%)")
        if vix is not None and vix > 20:
            points += 3
            reasons.append(f"elevated VIX ({vix:.1f}) favouring BTC speculation")
        if avg_volume > 1e8:
            points += 2
            reasons.append(f"high volume ({avg_volume:,.0f})")

    elif name == "XAUUSD":
        if momentum > 0:
            points += 5
            reasons.append(f"positive momentum ({momentum:+.1f}%)")
        if vix is not None and vix > 25:
            points += 3
            reasons.append(f"high fear index VIX ({vix:.1f}) driving safe-haven demand")
        if avg_volume is not None and 1e5 <= avg_volume <= 1e6:
            points += 2
            reasons.append(f"steady volume ({avg_volume:,.0f})")

    elif name == "EURUSD":
        if abs(momentum) < 3:
            points += 5
            reasons.append(f"stable momentum ({momentum:+.1f}%)")
        if vix is not None and vix < 20:
            points += 3
            reasons.append(f"low fear index VIX ({vix:.1f}) suits steady FX trading")
        if avg_volume is not None and avg_volume < 1e6:
            points += 2
            reasons.append(f"low volume ({avg_volume:,.0f}) confirming calm conditions")

    else:
        # Generic sub-score: reward strong trend + positive momentum
        if momentum > 5:
            points += 4
            reasons.append(f"strong momentum ({momentum:+.1f}%)")
        elif momentum > 0:
            points += 2
            reasons.append(f"positive momentum ({momentum:+.1f}%)")
        if adx_from_reasons(reasons) is None:  # placeholder — use adx_val from caller
            pass
        # We return early here; adx points are added by the caller
        return max(1, points), reasons

    return points, reasons


def sub_score_generic(momentum, adx_val):
    """Generic sub-score when name is not a known instrument."""
    points = 0
    reasons = []
    if momentum > 5:
        points += 4
        reasons.append(f"strong momentum ({momentum:+.1f}%)")
    elif momentum > 0:
        points += 2
        reasons.append(f"positive momentum ({momentum:+.1f}%)")
    if adx_val > 40:
        points += 4
        reasons.append(f"strong trend (ADX {adx_val:.1f})")
    elif adx_val > 25:
        points += 2
        reasons.append(f"trending (ADX {adx_val:.1f})")
    return max(1, min(10, points)), reasons


def adx_from_reasons(_):
    """Helper sentinel — always returns None; used as a flag."""
    return None


def build_explanation(name, score, atr_val, adx_val, momentum, vix, avg_volume, tie_reasons=None):
    """Build a human-readable explanation string."""
    if name == "BTCUSD":
        if score >= 70:
            base = (
                f"High score — elevated volatility (ATR: {atr_val:,.0f}) matches BTC's speculative nature. "
                "Market is in a high-energy state driven by speculation or hype."
            )
            risk = "Take high risk — increase lot sizes aggressively."
        elif score >= 40:
            base = f"Moderate volatility (ATR: {atr_val:,.0f}, ADX: {adx_val:.1f}). BTC active but not at peak."
            risk = "Take moderate risk — use standard lot sizes."
        else:
            base = f"Low score — BTC in a low-volatility environment (ATR: {atr_val:,.0f}, ADX: {adx_val:.1f})."
            risk = "Take low risk — reduce or avoid positions."

    elif name == "XAUUSD":
        if score >= 70:
            base = (
                f"High score — Gold showing strong trend (ADX: {adx_val:.1f}) "
                f"and healthy volatility (ATR: {atr_val:.2f}). Geopolitical uncertainty driving safe-haven demand."
            )
            risk = "Take high risk — Gold is in its ideal environment. Increase position sizes."
        elif score >= 40:
            base = f"Moderate conditions for Gold (ATR: {atr_val:.2f}, ADX: {adx_val:.1f}). Trend developing."
            risk = "Take moderate risk — use standard sizing."
        else:
            base = f"Low score — Gold in a calm environment (ATR: {atr_val:.2f}, ADX: {adx_val:.1f}). Weak trend."
            risk = "Take low risk — reduce or avoid positions."

    elif name == "EURUSD":
        if score >= 70:
            base = (
                f"High score — EUR/USD in calm, data-driven conditions "
                f"(ATR: {atr_val:.5f}, ADX: {adx_val:.1f}). Low volatility with mild trend is ideal."
            )
            risk = "Take high risk — EUR/USD environment is perfect. Increase lot sizes."
        elif score >= 40:
            base = f"Moderate EUR/USD conditions (ATR: {atr_val:.5f}, ADX: {adx_val:.1f}). Manageable volatility."
            risk = "Take moderate risk — use standard sizing."
        else:
            base = f"Low score — EUR/USD has high volatility (ATR: {atr_val:.5f}) or weak trend (ADX: {adx_val:.1f})."
            risk = "Take low risk — reduce or avoid positions."

    else:
        # Generic explanation
        if score >= 70:
            base = (
                f"{name} showing high-conviction conditions "
                f"(ATR: {atr_val:.4g}, ADX: {adx_val:.1f}). Strong volatility and trend alignment."
            )
            risk = "Take high risk — favourable environment."
        elif score >= 40:
            base = (
                f"{name} in moderate conditions "
                f"(ATR: {atr_val:.4g}, ADX: {adx_val:.1f}). Moderate trend strength."
            )
            risk = "Take moderate risk — use standard sizing."
        else:
            base = (
                f"{name} in a low-conviction environment "
                f"(ATR: {atr_val:.4g}, ADX: {adx_val:.1f}). Low volatility or weak trend."
            )
            risk = "Take low risk — reduce or avoid positions."

    explanation = f"{base} {risk}"
    if tie_reasons:
        explanation += f" Tie broken due to: {', '.join(tie_reasons)}."
    return explanation


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def process_instrument(name, display_ticker, poly_ticker, from_str, to_str, vix_level):
    """Fetch bars and compute all metrics for one instrument."""
    bars = fetch_polygon_bars(poly_ticker, from_str, to_str)

    if len(bars) < 20:
        raise RuntimeError(f"Only {len(bars)} bars returned — need at least 20.")

    atr_val    = calculate_atr(bars)
    adx_val    = calculate_adx(bars)
    momentum   = calculate_momentum(bars)
    avg_volume = calculate_avg_volume(bars)
    last_price = bars[-1]["c"]

    if math.isnan(atr_val) or math.isnan(adx_val):
        raise RuntimeError("NaN produced in ATR/ADX calculation.")

    raw_score = base_score(name, atr_val, adx_val, last_price)

    if name in KNOWN_INSTRUMENTS:
        sub_pts, sub_reasons = sub_score(name, momentum, vix_level, avg_volume)
    else:
        sub_pts, sub_reasons = sub_score_generic(momentum, adx_val)

    return {
        "name":       name,
        "ticker":     display_ticker,
        "rawScore":   raw_score,
        "subScore":   sub_pts,
        "subReasons": sub_reasons,
        "atr":        atr_val,
        "adx":        adx_val,
        "momentum":   momentum,
        "avgVolume":  avg_volume,
        "vix":        vix_level,
        "lastPrice":  last_price,
    }


def apply_tie_breaking(instruments):
    """
    When multiple instruments hit 100, use the sub-score to differentiate.
    Sets the top instrument to exactly 100, second to 99.9, third to 99.8, etc.
    Returns a list of result dicts ready for the API response.
    """
    at_100 = [i for i in instruments if i["rawScore"] >= 100.0]

    results = []
    for inst in instruments:
        score      = inst["rawScore"]
        tie_broken = False
        tie_reasons = []

        if len(at_100) > 1 and inst in at_100:
            tie_broken  = True
            tie_reasons = inst["subReasons"]
            score = 100.0 + inst["subScore"] / 10.0

        explanation = build_explanation(
            inst["name"],
            inst["rawScore"],
            inst["atr"],
            inst["adx"],
            inst["momentum"],
            inst["vix"],
            inst["avgVolume"],
            tie_reasons if tie_broken else None,
        )

        color_category = (
            "green"  if inst["rawScore"] >= 70 else
            "yellow" if inst["rawScore"] >= 40 else
            "red"
        )

        results.append({
            "_sortScore":    score,
            "name":          inst["name"],
            "ticker":        inst["ticker"],
            "rawScore":      inst["rawScore"],
            "subScore":      inst["subScore"],
            "atr":           inst["atr"],
            "adx":           inst["adx"],
            "momentum":      inst["momentum"],
            "avgVolume":     inst["avgVolume"],
            "explanation":   explanation,
            "colorCategory": color_category,
        })

    results.sort(key=lambda x: x["_sortScore"], reverse=True)

    if len(at_100) > 1:
        for rank, res in enumerate(results):
            if res["rawScore"] >= 100.0:
                res["score"] = round(100.0 - rank * 0.1, 1)
            else:
                res["score"] = round(res["rawScore"], 1)
    else:
        for res in results:
            res["score"] = round(res["rawScore"], 1)

    for res in results:
        s = res["score"]
        if s >= 70:
            res["riskGuidance"] = (
                f"Score {s:.0f} = high conviction — aggressive risk. "
                "Increase lot sizes and run this in the algo."
            )
        elif s >= 40:
            res["riskGuidance"] = (
                f"Score {s:.0f} = moderate — use conservative sizing. "
                "Run with reduced lot sizes."
            )
        else:
            res["riskGuidance"] = (
                f"Score {s:.0f} = low conviction — preserve capital. "
                "Avoid or use minimal position sizes."
            )

        del res["_sortScore"]

    return results


def main():
    if not API_KEY:
        print(json.dumps({
            "error":   "config_error",
            "message": "POLYGON_API_KEY environment variable is not set.",
        }))
        sys.exit(1)

    # Load instrument list — prefer env var override, fall back to defaults
    instruments_json = os.environ.get("INSTRUMENTS_JSON", "").strip()
    if instruments_json:
        try:
            instruments_config = json.loads(instruments_json)
        except json.JSONDecodeError as e:
            print(json.dumps({
                "error":   "config_error",
                "message": f"Invalid INSTRUMENTS_JSON: {e}",
            }))
            sys.exit(1)
    else:
        instruments_config = DEFAULT_INSTRUMENTS

    end_date   = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=30)
    from_str   = start_date.strftime("%Y-%m-%d")
    to_str     = end_date.strftime("%Y-%m-%d")

    vix_level = fetch_vix(from_str, to_str)

    raw_instruments = []
    errors          = []

    for cfg in instruments_config:
        name           = cfg.get("name", "")
        display_ticker = cfg.get("displayTicker", name)
        poly_ticker    = cfg.get("polyTicker", "")
        try:
            data = process_instrument(name, display_ticker, poly_ticker, from_str, to_str, vix_level)
            raw_instruments.append(data)
        except Exception as e:
            errors.append(f"{name}: {e}")

    if not raw_instruments:
        print(json.dumps({
            "error":   "fetch_error",
            "message": "Failed to fetch data for all instruments: " + "; ".join(errors),
        }))
        sys.exit(1)

    results = apply_tie_breaking(raw_instruments)
    best    = results[0]

    output = {
        "instruments":    results,
        "bestInstrument": best["name"],
        "bestScore":      best["score"],
        "lastUpdated":    datetime.datetime.utcnow().isoformat() + "Z",
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
