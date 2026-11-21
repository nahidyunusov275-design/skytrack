import requests
import time
import random

# ADSB.LOL API (Pulsuz, tokensiz, Render-də bloklanmır)
ADSB_URL = "https://api.adsb.lol/v2/lat/40.4093/lon/49.8671/dist/250"

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

def fetch_planes_from_adsb():
    try:
        r = requests.get(ADSB_URL, timeout=15)
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
                    # Futdan metrə çeviririk
                    "altitude_m": round(s.get("alt_baro", 0) * 0.3048) if s.get("alt_baro") else 10000,
                    # Düyündən m/s-ə çeviririk
                    "velocity_ms": round(s.get("gs", 0) * 0.514444) if s.get("gs") else 200,
                    "heading": s.get("track", 0),
                })
            return planes
        else:
            print(f"❌ ADSB.lol Xətası: {r.status_code}")
            return []
    except Exception as e:
        print(f"❌ Bağlantı xətası: {e}")
        return []

def get_planes():
    global _cache
    now = time.time()
    
    # 15 saniyəlik keş
    if not _cache["data"] or (now - _cache["timestamp"] > 15):
        print("ADSB.lol-dan yeni data çəkilir...")
        new_data = fetch_planes_from_adsb()
        
        if new_data: 
            _cache["data"] = new_data
            _cache["timestamp"] = now
            print(f"✅ Real datadan {len(new_data)} təyyarə gəldi.")
        else:
            print("⚠️ Real data gəlmədi. Simulyasiya (fallback) işə düşür.")
            _cache["data"] = generate_fake_planes()
            _cache["timestamp"] = now
            
    return _cache["data"]