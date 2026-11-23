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
CACHE_TTL = 10

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
    "GYD": {"name": "Bakı Heydər Əliyev", "city": "Bakı",     "lat": 40.4675, "lon": 50.0467},
    "NAJ": {"name": "Naxçıvan",           "city": "Naxçıvan", "lat": 39.1888, "lon": 45.4584},
    "GAN": {"name": "Gəncə",              "city": "Gəncə",    "lat": 40.7377, "lon": 46.3176},
    "LLK": {"name": "Lənkəran",           "city": "Lənkəran", "lat": 38.7464, "lon": 48.8180},
    "GBB": {"name": "Qəbələ",             "city": "Qəbələ",   "lat": 40.8267, "lon": 47.7125},
    "ZTU": {"name": "Zaqatala",           "city": "Zaqatala", "lat": 41.5622, "lon": 46.6672},
}

AZ_CENTER = {"lat": 40.4093, "lon": 49.8671}
RADIUS_NM = 400

# ---------- HELPERS ----------
def _get(p, *keys):
    """Hər iki field adı konvensiyası ilə işləyir"""
    for k in keys:
        v = p.get(k)
        if v is not None:
            return v
    return None

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1-a))

def bearing(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlon = math.radians(lon2 - lon1)
    x = math.sin(dlon) * math.cos(phi2)
    y = math.cos(phi1)*math.sin(phi2) - math.sin(phi1)*math.cos(phi2)*math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

def find_target_airport(lat, lon, heading):
    """İstiqamətə uyğun hava limanını tap"""
    best, best_score = None, float('inf')
    for code, ap in AZ_AIRPORTS.items():
        dist_km = haversine(lat, lon, ap["lat"], ap["lon"])
        dist_nm = dist_km / 1.852
        if heading is not None:
            brg = bearing(lat, lon, ap["lat"], ap["lon"])
            diff = abs((heading - brg + 180) % 360 - 180)
            if diff > 100:
                continue
        else:
            diff = 0
        score = dist_nm + diff * 0.5
        if score < best_score:
            best_score = score
            best = {
                "code": code,
                "name": ap["name"],
                "city": ap["city"],
                "distance_nm": round(dist_nm, 1),
                "bearing_diff": round(diff, 1),
            }
    return best

def classify_plane(alt, speed, target):
    if alt is None: alt = 0
    if speed is None: speed = 0
    if alt < 500 or speed < 50:
        return "ground"
    if target is None:
        return "cruise"
    if alt < 10000 and target["bearing_diff"] < 60:
        return "landing"
    if alt < 20000 and target["bearing_diff"] < 90:
        return "approach"
    if alt < 30000 and target["bearing_diff"] < 60:
        return "descending"
    return "cruise"

def calculate_eta(distance_nm, groundspeed_kts):
    if not groundspeed_kts or groundspeed_kts < 50:
        return None
    return round((distance_nm / groundspeed_kts) * 60, 1)

# ---------- API FALLBACK ----------
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
            "callsign": (s[1] or "").strip(),
            "lat": s[6],
            "lon": s[5],
            "alt": s[13] if s[13] else (s[7] * 3.28084 if s[7] else None),
            "speed": s[9] * 1.94384 if s[9] else None,
            "heading": s[10],
            "country": s[2],
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

# ---------- ENDPOINTS ----------
@app.get("/")
def root():
    return {"status": "ok", "service": "SkyTrack 3D", "version": "2.1"}

@app.get("/api/planes-3d")
async def planes_3d():
    return await fetch_planes(AZ_CENTER["lat"], AZ_CENTER["lon"], RADIUS_NM)

@app.get("/api/planes-az")
async def planes_az(status: str = None):
    result = await fetch_planes(AZ_CENTER["lat"], AZ_CENTER["lon"], RADIUS_NM)
    enriched = []
    for p in result["planes"]:
        lat = _get(p, "lat")
        lon = _get(p, "lon")
        if lat is None or lon is None:
            continue

        alt = _get(p, "alt", "alt_baro") or 0
        speed = _get(p, "speed", "gs") or 0
        heading = _get(p, "heading", "track")
        callsign = _get(p, "callsign", "flight") or ""

        if speed > 700:
            speed = 0

        target = find_target_airport(lat, lon, heading)
        plane_status = classify_plane(alt, speed, target)

        if status and plane_status != status:
            continue

        eta = None
        if target and plane_status in ("landing", "approach", "descending"):
            eta = calculate_eta(target["distance_nm"], speed)

        enriched.append({
            "hex": p.get("hex"),
            "callsign": callsign,
            "lat": lat,
            "lon": lon,
            "alt": alt,
            "speed": round(speed, 1) if speed else 0,
            "heading": heading,
            "country": p.get("country", ""),
            "status": plane_status,
            "target_airport": target["code"] if target else None,
            "airport_name": target["name"] if target else None,
            "airport_city": target["city"] if target else None,
            "distance_nm": target["distance_nm"] if target else None,
            "bearing_diff": target["bearing_diff"] if target else None,
            "eta_minutes": eta,
        })

    order = {"landing": 0, "approach": 1, "descending": 2, "cruise": 3, "ground": 4}
    enriched.sort(key=lambda x: (order.get(x["status"], 5), x["eta_minutes"] or 99999))

    return {
        "source": result["source"],
        "count": len(enriched),
        "landing_count": sum(1 for p in enriched if p["status"] in ("landing", "approach")),
        "planes": enriched,
    }