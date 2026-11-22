from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opensky import get_planes
from opensky_3d import get_planes_3d
import math

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/planes")
def api_planes():
    planes = get_planes()
    return {"planes": planes}

@app.get("/api/planes-3d")
def api_planes_3d():
    planes, error = get_planes_3d()
    return {"planes": planes, "debug_error": error}

# YENİ: Azərbaycana enən və qalxan təyyarələr
@app.get("/api/planes-az")
def api_planes_az():
    planes, error = get_planes_3d()
    
    AZ_AIRPORTS = {
        "GYD (Bakı)": (40.4675, 50.0467),
        "NAJ (Naxçıvan)": (39.1888, 45.4584),
        "GAN (Gəncə)": (40.7377, 46.3176),
    }
    
    landing = []
    taking_off = []
    
    for p in planes:
        lat, lon = p["latitude"], p["longitude"]
        vr = p.get("vertical_rate", 0)
        
        for airport_name, (alat, alon) in AZ_AIRPORTS.items():
            # Haversine məsafə (km)
            R = 6371
            dlat = math.radians(alat - lat)
            dlon = math.radians(alon - lon)
            a = math.sin(dlat/2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(alat)) * math.sin(dlon/2)**2
            distance_km = 2 * R * math.asin(math.sqrt(a))
            
            # Enən təyyarələr
            if distance_km < 300 and vr < -2 and 0 < p["altitude_m"] < 10000:
                speed_ms = max(p["velocity_ms"], 50)
                eta_seconds = (distance_km * 1000) / speed_ms
                eta_minutes = round(eta_seconds / 60)
                
                landing.append({
                    **p,
                    "destination": airport_name,
                    "distance_km": round(distance_km, 1),
                    "eta_minutes": eta_minutes,
                })
                break
            
            # Qalxan təyyarələr
            if distance_km < 50 and vr > 2 and 0 < p["altitude_m"] < 5000:
                taking_off.append({
                    **p,
                    "origin": airport_name,
                    "distance_km": round(distance_km, 1),
                })
                break
    
    return {
        "landing": landing,
        "taking_off": taking_off,
        "debug_error": error,
    }