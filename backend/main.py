import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== CACHE =====
_cache = {"data": None, "timestamp": None, "source": None}
CACHE_TTL = 10  # saniyə

# ===== MƏRKƏZ (Bakı) =====
BAKU_LAT = 40.4675
BAKU_LON = 50.0467
RADIUS_NM = 250  # ~460 km radius


# ===== FETCHERS =====
async def fetch_adsb_lol(client):
    url = f"https://api.adsb.lol/v2/point/{BAKU_LAT}/{BAKU_LON}/{RADIUS_NM}"
    r = await client.get(url, timeout=15)
    if r.status_code == 200:
        return r.json().get("ac", [])
    return None


async def fetch_airplanes_live(client):
    url = f"https://api.airplanes.live/v2/point/{BAKU_LAT}/{BAKU_LON}/{RADIUS_NM}"
    r = await client.get(url, timeout=15)
    if r.status_code == 200:
        return r.json().get("ac", [])
    return None


async def fetch_adsb_fi(client):
    url = f"https://opendata.adsb.fi/api/v2/lat/{BAKU_LAT}/lon/{BAKU_LON}/dist/{RADIUS_NM}"
    r = await client.get(url, timeout=15)
    if r.status_code == 200:
        return r.json().get("aircraft", [])
    return None


async def fetch_opensky(client):
    params = {
        "lamin": BAKU_LAT - 3, "lamax": BAKU_LAT + 3,
        "lomin": BAKU_LON - 4, "lomax": BAKU_LON + 4,
    }
    r = await client.get(
        "https://opensky-network.org/api/states/all",
        params=params, timeout=15,
    )
    if r.status_code == 200:
        states = r.json().get("states") or []
        return [
            {
                "hex": s[0],
                "flight": (s[1] or "").strip(),
                "lon": s[5], "lat": s[6],
                "alt_baro": s[7] * 3.28084 if s[7] else None,
                "gs": s[9] * 1.94384 if s[9] else None,
                "track": s[10],
                "country": s[2],
            }
            for s in states if s[5] and s[6]
        ]
    return None


# ===== NORMALIZER =====
def normalize(ac_list):
    out = []
    for ac in ac_list:
        try:
            lat, lon = ac.get("lat"), ac.get("lon")
            if lat is None or lon is None:
                continue
            out.append({
                "hex": ac.get("hex", ""),
                "callsign": (ac.get("flight") or ac.get("callsign") or "").strip(),
                "lat": lat, "lon": lon,
                "alt": ac.get("alt_baro") or ac.get("alt_geom") or ac.get("altitude"),
                "speed": ac.get("gs") or ac.get("speed"),
                "heading": ac.get("track") or ac.get("heading") or 0,
                "country": ac.get("country") or ac.get("origin_country") or "",
                "type": ac.get("t") or ac.get("type") or "",
            })
        except Exception:
            continue
    return out


# ===== ENDPOINT =====
@app.get("/api/planes-3d")
async def planes_3d():
    now = datetime.now()
    if (_cache["data"] and _cache["timestamp"]
            and (now - _cache["timestamp"]).total_seconds() < CACHE_TTL):
        return {
            "source": f"cache({_cache['source']})",
            "count": len(_cache["data"]),
            "planes": _cache["data"],
        }

    async with httpx.AsyncClient() as client:
        for name, fetcher in [
            ("adsb.lol", fetch_adsb_lol),
            ("airplanes.live", fetch_airplanes_live),
            ("adsb.fi", fetch_adsb_fi),
            ("opensky", fetch_opensky),
        ]:
            try:
                data = await fetcher(client)
                if data:
                    planes = normalize(data)
                    _cache.update(data=planes, timestamp=now, source=name)
                    return {"source": name, "count": len(planes), "planes": planes}
            except Exception as e:
                print(f"[{name}] xəta: {e}")
                continue

    # Hamısı uğursuz — köhnə cache qaytar
    if _cache["data"]:
        return {
            "source": "stale_cache",
            "count": len(_cache["data"]),
            "planes": _cache["data"],
        }
    return {"source": "none", "count": 0, "planes": [], "error": "Bütün API-lər cavab vermədi"}


@app.get("/")
def root():
    return {"status": "ok", "service": "skytrack-3d"}