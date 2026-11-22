import requests
import time
import random

ADSB_URL = "https://opensky-network.org/api/states/all?lamin=38.5&lomin=44.5&lamax=41.5&lomax=50.5"
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
            states = data.get("states", [])
            planes = []
            if states:
                for s in states:
                    if s[5] is None or s[6] is None:
                        continue
                    planes.append({
                        "icao24": s[0],
                        "callsign": s[1].strip() if s[1] else "Naməlum",
                        "country": s[2],
                        "longitude": s[5],
                        "latitude": s[6],
                        "altitude_m": round(s[7]) if s[7] else 0,
                        "velocity_ms": round(s[9]) if s[9] else 0,
                        "heading": s[10] if s[10] else 0,
                        "vertical_rate": s[11] if s[11] else 0, # YENİ
                        "on_ground": s[8] if s[8] is not None else False, # YENİ
                    })
            _last_error = "Uğurlu"
            return planes
        else:
            _last_error = f"Status xətası: {r.status_code}"
            return []
    except Exception as e:
        _last_error = f"Qoşulma xətası: {str(e)}"
        return []

def get_planes_3d():
    global _cache, _last_error
    now = time.time()
    if not _cache["data"] or (now - _cache["timestamp"] > 15):
        new_data = fetch_planes_from_adsb()
        if not new_data:
            new_data = generate_fake_planes()
        _cache["data"] = new_data
        _cache["timestamp"] = now
    return _cache["data"], _last_error