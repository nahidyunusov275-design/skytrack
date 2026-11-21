import requests
import time
import random

ADSB_URL = "https://api.adsb.lol/v2/lat/40.4093/lon/49.8671/dist/250"

_cache = {
    "data": [],
    "timestamp": 0
}

def generate_fake_planes():
    fake_planes = []
    airlines = ["AHY", "THY", "UAE", "DLH", "QTR", "AFL", "SVR"]
    countries = ["Azerbaijan", "Turkey", "UAE", "Germany", "Qatar", "Russia", "Russia"]
    for i in range(15):
        fake_planes.append({
            "icao24": f"fake{i}",
            "callsign": f"{random.choice(airlines)}{random.randint(100, 999)}",
            "country": random.choice(countries),
            "longitude": random.uniform(44.5, 50.5),
            "latitude": random.uniform(38.5, 41.5),
            "altitude_m": random.randint(5000, 12000),
            "velocity_ms": random.randint(150, 280),
            "heading": random.randint(0, 359),
        })
    return fake_planes

def fetch_planes_from_adsb():
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
                planes.append({
                    "icao24": s.get("hex", "unknown"),
                    "callsign": (s.get("flight") or "").strip() or "Naməlum",
                    "country": "Unknown",
                    "longitude": s.get("lon"),
                    "latitude": s.get("lat"),
                    "altitude_m": round(s.get("alt_baro", 0) * 0.3048) if s.get("alt_baro") else 10000,
                    "velocity_ms": round(s.get("gs", 0) * 0.514444) if s.get("gs") else 200,
                    "heading": s.get("track", 0),
                })
            return planes
        return []
    except Exception as e:
        return []

def get_planes_3d():
    global _cache
    now = time.time()
    
    if not _cache["data"] or (now - _cache["timestamp"] > 15):
        new_data = fetch_planes_from_adsb()
        if not new_data:
            new_data = generate_fake_planes()
        _cache["data"] = new_data
        _cache["timestamp"] = now
            
    return _cache["data"]