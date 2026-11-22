import httpx
import math
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
CACHE_TTL = 10

# ===== MƏRKƏZ (Bakı) =====
BAKU_LAT = 40.4675
BAKU_LON = 50.0467
RADIUS_NM = 400  # 250 -> 400 (daha çox təyyarə)

# ===== AZƏRBAYCAN HAVA LİMANLARI =====
AIRPORTS = {
    "GYD": {"name": "Bakı Heydər Əliyev", "lat": 40.4675, "lon": 50.0467},
    "NAJ": {"name": "Naxçıvan", "lat": 39.1888, "lon": 45.4584},
    "GAN": {"name": "Gəncə", "lat": 40.7377, "lon": 46.3176},
    "LLK": {"name": "Lənkəran", "lat": 38.7464, "lon": 48.8183},
    "GBB": {"name": "Qəbələ", "lat": 40.8267, "lon": 47.7125},
    "ZTU": {"name": "Zaqatala", "lat": 41.5622, "lon": 46.6672},
}


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
        "lamin": BAKU_LAT - 4, "lamax": BAKU_LAT + 4,
        "lomin": BAKU_LON - 6, "lomax": BAKU_LON + 6,
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


# ===== HAVERSINE (məsafə NM ilə) =====
def haversine_nm(lat1, lon1, lat2, lon2):
    R = 3440.065
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))


# ===== ORTAQ CACHE FUNKSİYASI =====
async def get_planes_cached():
    now = datetime.now()
    if (_cache["data"] and _cache["timestamp"]
            and (now - _cache["timestamp"]).total_seconds() < CACHE_TTL):
        return _cache["data"], f"cache({_cache['source']})"

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
                    return planes, name
            except Exception as e:
                print(f"[{name}] xəta: {e}")
                continue

    if _cache["data"]:
        return _cache["data"], "stale_cache"
    return [], "none"


# ===== ENDPOINT 1: Bütün təyyarələr (3D xəritə üçün) =====
@app.get("/api/planes-3d")
async def planes_3d():
    planes, source = await get_planes_cached()
    return {"source": source, "count": len(planes), "planes": planes}


# ===== ENDPOINT 2: Azərbaycana enən təyyarələr (ETA ilə) =====
@app.get("/api/planes-az")
async def planes_az():
    planes, source = await get_planes_cached()

    result = []
    for p in planes:
        lat, lon = p.get("lat"), p.get("lon")
        speed = p.get("speed") or 0
        if not lat or not lon or speed < 50:
            continue

        # Ən yaxın hava limanını tap
        nearest = None
        min_dist = float("inf")
        for code, ap in AIRPORTS.items():
            d = haversine_nm(lat, lon, ap["lat"], ap["lon"])
            if d < min_dist:
                min_dist = d
                nearest = code

        if min_dist > 250:  # 250 NM-dən uzaqdırsa, keç
            continue

        # ETA hesabla (dəqiqə)
        eta_min = (min_dist / speed) * 60 if speed > 0 else None

        result.append({
            **p,
            "nearest_airport": nearest,
            "airport_name": AIRPORTS[nearest]["name"],
            "distance_nm": round(min_dist, 1),
            "eta_minutes": round(eta_min, 1) if eta_min else None,
        })

    # ETA-ya görə sırala (ən yaxın əvvəl)
    result.sort(key=lambda x: x["eta_minutes"] or 9999)

    return {
        "source": source,
        "count": len(result),
        "airports": AIRPORTS,
        "planes": result,
    }


@app.get("/")
def root():
    return {"status": "ok", "service": "skytrack-3d"}