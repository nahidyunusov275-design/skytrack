import requests
import time
import random

OPENSKY_URL = "https://opensky-network.org/api/states/all"

AZ_BBOX = {
    "lamin": 38.0,
    "lomin": 44.0,
    "lamax": 42.0,
    "lomax": 51.0,
}

_cache = {
    "data": [],
    "timestamp": 0
}

def generate_fake_planes():
    print("🚀 SİMULYASİYA BAŞLADI: 15 təyyarə yaradılır...")
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
    print(f"✅ SİMULYASİYA BİTDİ: {len(fake_planes)} təyyarə yaradıldı.")
    return fake_planes

def fetch_planes_from_opensky():
    try:
        r = requests.get(OPENSKY_URL, params=AZ_BBOX, timeout=15)
        if r.status_code == 200:
            states = r.json().get("states") or []
            planes = []
            for s in states:
                planes.append({
                    "icao24": s[0],
                    "callsign": (s[1] or "").strip() or "Naməlum",
                    "country": s[2] or "Naməlum",
                    "longitude": s[5],
                    "latitude": s[6],
                    "altitude_m": round(s[7]) if s[7] is not None else None,
                    "velocity_ms": round(s[9]) if s[9] is not None else None,
                    "heading": round(s[10]) if s[10] is not None else None,
                })
            return planes
        else:
            print(f"❌ OpenSky Xətası: {r.status_code}")
            return []
    except Exception as e:
        print(f"❌ Bağlantı xətası: {e}")
        return []

def get_planes():
    global _cache
    now = time.time()
    
    if not _cache["data"] or (now - _cache["timestamp"] > 60):
        print("OpenSky-dən yeni data çəkilir...")
        new_data = fetch_planes_from_opensky()
        
        if new_data: 
            _cache["data"] = new_data
            _cache["timestamp"] = now
            print(f"✅ OpenSky-dən {len(new_data)} təyyarə gəldi.")
        else:
            print("⚠️ OpenSky data vermədi. Simulyasiya (fallback) işə düşür.")
            _cache["data"] = generate_fake_planes()
            _cache["timestamp"] = now
            
    return _cache["data"]