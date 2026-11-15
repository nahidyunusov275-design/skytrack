from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx
import math
import os

app = FastAPI()

# CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ HAVA LİMANI KOORDİNATLARI ============
AIRPORTS_COORDS = {
    "GYD": {"lat": 40.4675, "lon": 50.0467, "name": "Bakı"},
    "KVD": {"lat": 40.7378, "lon": 46.3175, "name": "Gəncə"},
    "GBB": {"lat": 40.8267, "lon": 47.7125, "name": "Qəbələ"},
    "LLK": {"lat": 38.7464, "lon": 48.8181, "name": "Lənkəran"},
    "FZL": {"lat": 39.5944, "lon": 47.1967, "name": "Füzuli"},
    "NAJ": {"lat": 39.1888, "lon": 45.4584, "name": "Naxçıvan"},
}

# ============ DİNAMİK TRANSPORT MƏLUMATLARI ============
TRANSPORT_DATA = {
    "GYD": {
        "airport": "Heydər Əliyev Beynəlxalq Hava Limanı (GYD)",
        "options": [
            {"type": "Aero Express (Metro)", "price": "1.50 AZN", "time": "30 dəqiqə", "schedule": "Hər 20 dəqiqədə bir", "note": "Birbaşa mərkəzə gedir"},
            {"type": "Avtobus (N1)", "price": "0.50 AZN", "time": "45 dəqiqə", "schedule": "Gecə saatlarında da işləyir", "note": "Bakı dəmir yolu vağzalına qədər"},
            {"type": "Taksi (Bolt/Uber)", "price": "15-25 AZN", "time": "20 dəqiqə", "schedule": "24/7", "note": "Tətbiq vasitəsilə sifariş verin"}
        ]
    },
    "KVD": {
        "airport": "Gəncə Beynəlxalq Hava Limanı (KVD)",
        "options": [
            {"type": "Avtobus (1 nömrəli)", "price": "0.50 AZN", "time": "20 dəqiqə", "schedule": "Hər 30 dəqiqədə bir", "note": "Şəhər mərkəzinə qədər"},
            {"type": "Taksi", "price": "5-10 AZN", "time": "15 dəqiqə", "schedule": "24/7", "note": "Hava limanında dayanır"}
        ]
    },
    "GBB": {
        "airport": "Qəbələ Beynəlxalq Hava Limanı (GBB)",
        "options": [
            {"type": "Avtobus", "price": "0.50 AZN", "time": "30 dəqiqə", "schedule": "Hər 1 saatdan bir", "note": "Qəbələ mərkəzinə"},
            {"type": "Taksi", "price": "10-15 AZN", "time": "20 dəqiqə", "schedule": "24/7", "note": "Şəhər mərkəzinə"}
        ]
    },
    "LLK": {
        "airport": "Lənkəran Beynəlxalq Hava Limanı (LLK)",
        "options": [
            {"type": "Avtobus", "price": "0.40 AZN", "time": "15 dəqiqə", "schedule": "Hər 30 dəqiqədə bir", "note": "Lənkəran mərkəzinə"},
            {"type": "Taksi", "price": "5-8 AZN", "time": "10 dəqiqə", "schedule": "24/7", "note": "Şəhər mərkəzinə"}
        ]
    },
    "FZL": {
        "airport": "Füzuli Beynəlxalq Hava Limanı (FZL)",
        "options": [
            {"type": "Avtobus", "price": "0.40 AZN", "time": "15 dəqiqə", "schedule": "Hər 30 dəqiqədə bir", "note": "Füzuli mərkəzinə"},
            {"type": "Taksi", "price": "5-10 AZN", "time": "10 dəqiqə", "schedule": "24/7", "note": "Şəhər mərkəzinə"}
        ]
    },
    "NAJ": {
        "airport": "Naxçıvan Beynəlxalq Hava Limanı (NAJ)",
        "options": [
            {"type": "Avtobus", "price": "0.40 AZN", "time": "15 dəqiqə", "schedule": "Hər 30 dəqiqədə bir", "note": "Naxçıvan mərkəzinə"},
            {"type": "Taksi", "price": "5-10 AZN", "time": "10 dəqiqə", "schedule": "24/7", "note": "Şəhər mərkəzinə"}
        ]
    }
}

AIRLABS_KEY = os.getenv("AIRLABS_API_KEY", "")

# ============ MÖVCUD ENDPOINT-LƏR ============

@app.get("/api/planes")
async def get_planes():
    # DƏYİŞİKLİK BURADADIR: OpenSky yerinə adsb.lol API istifadə edirik
    url = "https://api.adsb.lol/v2/lat/40.0/lon/47.5/dist/250"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                ac_list = data.get("ac", [])
                planes = []
                for ac in ac_list:
                    if ac.get("lat") and ac.get("lon"):
                        gs_knots = ac.get("gs", 0)
                        velocity_ms = round(gs_knots * 0.514444, 1) if gs_knots else None
                        
                        alt_ft = ac.get("alt_baro", 0)
                        altitude_m = round(alt_ft * 0.3048) if isinstance(alt_ft, (int, float)) else None
                        
                        vrate_ft = ac.get("baro_rate", 0)
                        vertical_rate = round(vrate_ft * 0.00508, 1) if isinstance(vrate_ft, (int, float)) else None

                        planes.append({
                            "icao24": ac.get("hex", ""),
                            "callsign": ac.get("flight", "").strip() or "Naməlum",
                            "country": "Bilinmir",
                            "longitude": ac.get("lon"),
                            "latitude": ac.get("lat"),
                            "altitude_m": altitude_m,
                            "on_ground": alt_ft == "ground",
                            "velocity_ms": velocity_ms,
                            "heading": ac.get("track", 0),
                            "vertical_rate": vertical_rate,
                        })
                return {"planes": planes}
            return {"planes": []}
        except Exception as e:
            return {"error": str(e)}

@app.get("/api/flight-route/{callsign}")
async def get_flight_route(callsign: str):
    callsign = callsign.strip().upper()
    if not callsign:
        return {"error": "Callsign tapılmadı"}

    url = f"https://api.adsbdb.com/v0/callsign/{callsign}"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                if "response" in data and "flightroute" in data["response"]:
                    route = data["response"]["flightroute"]
                    origin = route.get("origin", {})
                    destination = route.get("destination", {})
                    
                    return {
                        "callsign": callsign,
                        "origin_city": origin.get("municipality", "Bilinmir"),
                        "origin_iata": origin.get("iata_code", ""),
                        "origin_country": origin.get("country_name", ""),
                        "destination_city": destination.get("municipality", "Bilinmir"),
                        "destination_iata": destination.get("iata_code", ""),
                        "destination_country": destination.get("country_name", "")
                    }
            return {"error": "Bu təyyarə üçün marşrut məlumatı tapılmadı."}
        except Exception as e:
            return {"error": f"Xəta baş verdi: {str(e)}"}

# ============ YENİ: DİNAMİK TRANSPORT ============
@app.get("/api/transport/{airport_code}")
async def get_transport(airport_code: str):
    code = airport_code.strip().upper()
    if code not in TRANSPORT_DATA:
        return {"error": "Bu hava limanı üçün transport məlumatı yoxdur."}
    return TRANSPORT_DATA[code]


# ============ ETA + GECİKMƏ ============

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def calculate_eta(lat, lon, dest_code, velocity, vertical_rate, on_ground):
    if dest_code not in AIRPORTS_COORDS:
        return None
    dest = AIRPORTS_COORDS[dest_code]
    distance_km = haversine(lat, lon, dest["lat"], dest["lon"])

    if on_ground:
        return {"status": "landed", "status_label": "Enib", "distance_km": round(distance_km, 1), "eta_minutes": 0, "eta_human": "Enib"}
    if not velocity or velocity < 10:
        return {"status": "unknown", "status_label": "Hesablanır...", "distance_km": round(distance_km, 1), "eta_minutes": None, "eta_human": "—"}

    speed_kmh = velocity * 3.6
    eta_minutes = (distance_km / speed_kmh) * 60

    if distance_km < 5:
        status, label = "approaching", "Enişə yaxın"
    elif vertical_rate and vertical_rate < -2 and distance_km < 50:
        status, label = "descending", "Enir"
    else:
        status, label = "cruising", "Uçur"

    h = int(eta_minutes // 60)
    m = int(eta_minutes % 60)
    eta_human = f"{h}s {m}d" if h > 0 else f"{m} dəq"

    return {"status": status, "status_label": label, "distance_km": round(distance_km, 1), "eta_minutes": round(eta_minutes), "eta_human": eta_human, "speed_kmh": round(speed_kmh)}

async def get_flight_schedule(callsign: str):
    if not AIRLABS_KEY or not callsign:
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get("https://airlabs.co/api/v9/flight", params={"flight_icao": callsign, "api_key": AIRLABS_KEY})
            if r.status_code != 200:
                return None
            flight = r.json().get("response")
            if not flight:
                return None
            delay = flight.get("delayed") or 0
            return {"scheduled_arrival": flight.get("arr_time"), "estimated_arrival": flight.get("arr_estimated"), "delay_minutes": int(delay), "is_delayed": delay > 5, "airline": flight.get("airline_name"), "flight_number": flight.get("flight_number")}
    except Exception:
        return None

class FlightInfoRequest(BaseModel):
    icao24: str
    lat: float
    lon: float
    velocity: Optional[float] = None
    vertical_rate: Optional[float] = None
    on_ground: bool = False
    destination: Optional[str] = None
    callsign: Optional[str] = None

@app.post("/api/flight-info")
async def flight_info(req: FlightInfoRequest):
    dest = (req.destination or "").strip().upper()
    eta = calculate_eta(req.lat, req.lon, dest, req.velocity, req.vertical_rate, req.on_ground)
    schedule = await get_flight_schedule((req.callsign or "").strip())
    return {"eta": eta, "schedule": schedule}