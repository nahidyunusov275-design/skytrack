import requests
import time

OPENSKY_URL = "https://opensky-network.org/api/states/all"

# Azərbaycan bbox
AZ_BBOX = {
    "lamin": 38.0,
    "lomin": 44.0,
    "lamax": 42.0,
    "lomax": 51.0,
}

# Cache (60 saniyə)
_cache = {
    "data": [],
    "timestamp": 0
}

def fetch_planes_from_opensky():
    """OpenSky-dən real datanı çəkir."""
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
            print(f"OpenSky Xətası: {r.status_code}")
            return []
    except Exception as e:
        print(f"Bağlantı xətası: {e}")
        return []

def get_planes():
    """Cache-i yoxlayır, əgər 60 saniyə keçməyibsə yaddaşdan qaytarır."""
    global _cache
    now = time.time()
    
    # Əgər cache boşdursa və ya 60 saniyədən çox keçibsə, yenidən çək
    if not _cache["data"] or (now - _cache["timestamp"] > 60):
        print("OpenSky-dən yeni data çəkilir...")
        new_data = fetch_planes_from_opensky()
        if new_data: # Əgər xəta olub boş qayıtmayıbsa, cache-i yenilə
            _cache["data"] = new_data
            _cache["timestamp"] = now
        else:
            print("Yeni data gəlmədi, köhnə cache istifadə olunur.")
            
    return _cache["data"]