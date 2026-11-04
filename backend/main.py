from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI()

# CORS ayarları (Frontend-in qoşulması üçün)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/planes")
async def get_planes():
    # Azərbaycan ətrafı
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
                                "velocity_ms": s[9],
                                "heading": s[10]
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