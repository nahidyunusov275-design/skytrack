import requests
import time
import random

# ADSB.fi API (Limitsiz və Cloudflare bloku yoxdur)
ADSB_URL = "https://opendata.adsb.fi/api/v2/lat/40.4093/lon/49.8671/dist/250"
_cache = {"data": [], "timestamp": 0}
_last_error = ""

def generate_fake_planes():
    fake_planes = []
    airlines = ["AHY", "THY", "UAE", "DLH", "QTR", "AFL", "SVR"]
    for i in range(15):
        fake_planes.append({
            "icao24": f"fake{i}",
            "callsign": f"{random.choice(airlines)}{random.randint(100, 999)}",
            "country": "Unknown",
            "longitude": random.uniform(44.5, 50.5),
            "latitude": random.uniform(38.5, 41.5),
            "altitude_m": random.randint(5000, 12000),
            "velocity_ms": random.randint(150, 280),
            "heading": random.randint(0, 359),
            "vertical_rate": 0,
            "on_ground": False,
        })
    return fake_planes

def fetch_planes_from_adsb():
    global _last_error
    try:
        headers = {'User-Agent': 'SkyTrack3D/1.0'}
        r = requests.get(ADSB_URL, headers=headers, timeout=15)
        if r.status_code == 200:
            data = r.json()
            states = data.get("ac", [])
            planes = []
            for s in states:
                if "lat" not in s or "lon" not in s:
                    continue
                
                alt_baro = s.get("alt_baro")
                altitude = round(alt_baro * 0.3048) if isinstance(alt_baro, (int, float)) else 0
                gs = s.get("gs")
                velocity = round(gs * 0.514444) if isinstance(gs, (int, float)) else 0

                planes.append({
                    "icao24": s.get("hex", "unknown"),
                    "callsign": (s.get("flight") or "").strip() or "Naməlum",
                    "country": "Unknown",
                    "longitude": s.get("lon"),
                    "latitude": s.get("lat"),
                    "altitude_m": altitude,
                    "velocity_ms": velocity,
                    "heading": s.get("track", 0),
                    "vertical_rate": s.get("baro_rate", 0), # Enmə/Qalxma sürəti
                    "on_ground": altitude == 0,
                })
            _last_error = "Uğurlu (ADSB.fi)"
            return planes
        else:
            _last_error = f"ADSB.fi Status xətası: {r.status_code}"
            return []
    except Exception as e:
        _last_error = f"ADSB.fi Qoşulma xətası: {str(e)}"
        return []

def get_planes_3d():
    global _cache, _last_error
    now = time.time()
    # Keş müddətini 60 saniyə etdik ki, API-ni yormayaq
    if not _cache["data"] or (now - _cache["timestamp"] > 60):
        new_data = fetch_planes_from_adsb()
        if not new_data:
            new_data = generate_fake_planes()
        _cache["data"] = new_data
        _cache["timestamp"] = now
    return _cache["data"], _last_error