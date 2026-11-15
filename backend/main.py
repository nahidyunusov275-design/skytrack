from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import httpx
import math
import os

app = FastAPI()

# CORS ayarları (Frontend-in qoşulması üçün)
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

AIRLABS_KEY = os.getenv("AIRLABS_API_KEY", "")


# ============ MÖVCUD ENDPOINT-LƏR ============

@app.get("/api/planes")
async def get_planes():
    url = "https://opensky-network.org/api/states/all?lamin=38.0&lomin=44.0&lamax=42.0&lomax=51.0"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                states = data.get("states", [])
                planes = []
                if states:
                    for s in states:
                        if s[5] is not None and s[6] is not None:
                            planes.append({
                                "icao24": s[0],
                                "callsign": s[1].strip() if s[1] else "Naməlum",
                                "country": s[2],
                                "longitude": s[5],
                                "latitude": s[6],
                                "altitude_m": s[7],
                                "on_ground": s[8] if len(s) > 8 and s[8] is not None else False,
                                "velocity_ms": s[9],
                                "heading": s[10],
                                "vertical_rate": s[11] if len(s) > 11 else None,
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


@app.get("/api/transport")
async def get_transport():
    return {
        "airport": "Heydər Əliyev Beynəlxalq Hava Limanı (GYD)",
        "options": [
            {
                "type": "Aero Express (Metro)",
                "price": "1.50 AZN",
                "time": "30 dəqiqə",
                "schedule": "Hər 20 dəqiqədə bir",
                "note": "Birbaşa mərkəzə gedir"
            },
            {
                "type": "Avtobus (N1)",
                "price": "0.50 AZN",
                "time": "45 dəqiqə",
                "schedule": "Gecə saatlarında da işləyir",
                "note": "Bakı dəmir yolu vağzalına qədər"
            },
            {
                "type": "Taksi (Bolt/Uber)",
                "price": "15-25 AZN",
                "time": "20 dəqiqə",
                "schedule": "24/7",
                "note": "Tətbiq vasitəsilə sifariş verin"
            }
        ]
    }


# ============ YENİ: ETA + GECİKMƏ ============

def haversine(lat1, lon1, lat2, lon2):
    """İki koordinat arasındakı məsafə (km)"""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_eta(lat, lon, dest_code, velocity, vertical_rate, on_ground):
    """Təyyarənin eniş vaxtını hesabla"""
    if dest_code not in AIRPORTS_COORDS:
        return None

    dest = AIRPORTS_COORDS[dest_code]
    distance_km = haversine(lat, lon, dest["lat"], dest["lon"])

    # Artıq enib
    if on_ground:
        return {
            "status": "landed",
            "status_label": "Enib",
            "distance_km": round(distance_km, 1),
            "eta_minutes": 0,
            "eta_human": "Enib",
        }

    # Sürət yoxdursa
    if not velocity or velocity < 10:
        return {
            "status": "unknown",
            "status_label": "Hesablanır...",
            "distance_km": round(distance_km, 1),
            "eta_minutes": None,
            "eta_human": "—",
        }

    speed_kmh = velocity * 3.6
    eta_minutes = (distance_km / speed_kmh) * 60

    # Status təyini
    if distance_km < 5:
        status, label = "approaching", "Enişə yaxın"
    elif vertical_rate and vertical_rate < -2 and distance_km < 50:
        status, label = "descending", "Enir"
    else:
        status, label = "cruising", "Uçur"

    h = int(eta_minutes // 60)
    m = int(eta_minutes % 60)
    eta_human = f"{h}s {m}d" if h > 0 else f"{m} dəq"

    return {
        "status": status,
        "status_label": label,
        "distance_km": round(distance_km, 1),
        "eta_minutes": round(eta_minutes),
        "eta_human": eta_human,
        "speed_kmh": round(speed_kmh),
    }


async def get_flight_schedule(callsign: str):
    """airlabs.co-dan reys cədvəli və gecikmə məlumatı (optional)"""
    if not AIRLABS_KEY or not callsign:
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                "https://airlabs.co/api/v9/flight",
                params={"flight_icao": callsign, "api_key": AIRLABS_KEY},
            )
            if r.status_code != 200:
                return None
            flight = r.json().get("response")
            if not flight:
                return None
            delay = flight.get("delayed") or 0
            return {
                "scheduled_arrival": flight.get("arr_time"),
                "estimated_arrival": flight.get("arr_estimated"),
                "delay_minutes": int(delay),
                "is_delayed": delay > 5,
                "airline": flight.get("airline_name"),
                "flight_number": flight.get("flight_number"),
            }
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
    eta = calculate_eta(
        req.lat, req.lon, dest,
        req.velocity, req.vertical_rate, req.on_ground
    )
    schedule = await get_flight_schedule((req.callsign or "").strip())
    return {"eta": eta, "schedule": schedule}