from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx
import time
import math

app = FastAPI(title="SkyTrack 3D API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- CACHE ----------
_cache = {}
CACHE_TTL = 10  # saniyə

def get_cache(key):
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None

def set_cache(key, data):
    _cache[key] = (data, time.time())

# ---------- AZƏRBAYCAN HAVA LİMANLARI ----------
AZ_AIRPORTS = {
    "GYD": {"name": "Heydər Əliyev Intl", "city": "Bakı",       "lat": 40.4675, "lon": 50.0467},
    "NAJ": {"name": "Naxçıvan",           "city": "Naxçıvan",   "lat": 39.1888, "lon": 45.4584},
    "GAN": {"name": "Gəncə Intl",         "city": "Gəncə",      "lat": 40.7377, "lon": 46.3176},
    "LLK": {"name": "Lənkəran Intl",      "city": "Lənkəran",   "lat": 38.7464, "lon": 48.8180},
    "GBB": {"name": "Qəbələ Intl",        "city": "Qəbələ",     "lat": 40.8267, "lon": 47.7125},
    "ZTU": {"name": "Zaqatala Intl",      "city": "Zaqatala",   "lat": 41.5622, "lon": 46.6672},
}

AZ_CENTER = {"lat": 40.4093, "lon": 49.8671}  # Bakı mərkəzi
RADIUS_NM = 400  # 250 → 400 NM

# ---------- HAVERSINE ----------
def haversine(lat1, lon1, lat2, lon2):
    """Məsafə km ilə"""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def find_nearest_airport(lat, lon):
    best, best_dist = None, float('inf')
    for code, ap in AZ_AIRPORTS.items():
        d = haversine(lat, lon, ap["lat"], ap["lon"])
        if d < best_dist:
            best_dist = d
            best = {**ap, "code": code, "distance_km": round(d, 1)}
    return best

def calculate_eta(distance_km, groundspeed_kts):
    """ETA dəqiqə ilə. Sürət < 50 kts → None (yerə enib/qalxır)"""
    if not groundspeed_kts or groundspeed_kts < 50:
        return None
    speed_kmh = groundspeed_kts * 1.852
    return round((distance_km / speed_kmh) * 60, 1)

# ---------- API FALLBACK SİSTEMİ ----------
async def fetch_adsb_lol(client, lat, lon, radius_nm):
    url = f"https://api.adsb.lol/v2/point/{lat}/{lon}/{radius_nm}"
    r = await client.get(url, timeout=10)
    r.raise_for_status()
    return r.json().get("ac", []), "adsb.lol"

async def fetch_airplanes_live(client, lat, lon, radius_nm):
    url = f"https://api.airplanes.live/v2/point/{lat}/{lon}/{radius_nm}"
    r = await client.get(url, timeout=10)
    r.raise_for_status()
    return r.json().get("ac", []), "airplanes.live"

async def fetch_adsb_fi(client, lat, lon, radius_nm):
    url = f"https://opendata.adsb.fi/api/v2/lat/{lat}/lon/{lon}/dist/{radius_nm}"
    r = await client.get(url, timeout=10)
    r.raise_for_status()
    return r.json().get("ac", []), "adsb.fi"

async def fetch_opensky(client, lat, lon, radius_nm):
    dlat = radius_nm / 60.0
    dlon = radius_nm / (60.0 * math.cos(math.radians(lat)))
    url = (f"https://opensky-network.org/api/states/all?"
           f"lamin={lat-dlat}&lomin={lon-dlon}&lamax={lat+dlat}&lomax={lon+dlon}")
    r = await client.get(url, timeout=15)
    r.raise_for_status()
    states = r.json().get("states") or []
    planes = []
    for s in states:
        planes.append({
            "hex": s[0],
            "flight": (s[1] or "").strip(),
            "lat": s[6],
            "lon": s[5],
            "alt_baro": s[13] if s[13] else (s[7] * 3.28084 if s[7] else None),
            "gs": s[9] * 1.94384 if s[9] else None,
            "track": s[10],
            "baro_rate": s[11],
        })
    return planes, "opensky"

async def fetch_planes(lat, lon, radius_nm):
    cache_key = f"planes:{lat}:{lon}:{radius_nm}"
    cached = get_cache(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient() as client:
        for fetcher in [fetch_adsb_lol, fetch_airplanes_live, fetch_adsb_fi, fetch_opensky]:
            try:
                planes, source = await fetcher(client, lat, lon, radius_nm)
                if planes:
                    result = {"source": source, "count": len(planes), "planes": planes}
                    set_cache(cache_key, result)
                    return result
            except Exception as e:
                print(f"⚠️ {fetcher.__name__} failed: {e}")
                continue

    return {"source": "none", "count": 0, "planes": []}

# ---------- ENDPOINT-LƏR ----------
@app.get("/")
def root():
    return {"status": "ok", "service": "SkyTrack 3D", "version": "2.0"}

@app.get("/api/planes-3d")
async def planes_3d():
    return await fetch_planes(AZ_CENTER["lat"], AZ_CENTER["lon"], RADIUS_NM)

@app.get("/api/planes-az")
async def planes_az():
    result = await fetch_planes(AZ_CENTER["lat"], AZ_CENTER["lon"], RADIUS_NM)
    enriched = []
    for p in result["planes"]:
        lat, lon = p.get("lat"), p.get("lon")
        if lat is None or lon is None:
            continue
        nearest = find_nearest_airport(lat, lon)
        gs = p.get("gs") or 0
        eta_min = calculate_eta(nearest["distance_km"], gs)
        enriched.append({
            **p,
            "nearest_airport": nearest["code"],
            "airport_name": nearest["name"],
            "airport_city": nearest["city"],
            "distance_km": nearest["distance_km"],
            "eta_minutes": eta_min,
        })
    # ETA-ya görə sırala (ETA-sı olanlar əvvəl, ən yaxın əvvəl)
    enriched.sort(key=lambda x: (x["eta_minutes"] is None, x["eta_minutes"] or 99999))
    return {"source": result["source"], "count": len(enriched), "planes": enriched}