import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import opensky

app = FastAPI(title="SkyTrack API")

# Frontend-in (React) bu API-yə girişinə icazə veririk
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Development üçün hər yerə açıqdır
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "SkyTrack API işləyir! 🚀"}

@app.get("/api/planes")
def get_planes():
    """Azərbaycan üzərindəki təyyarələrin siyahısını qaytarır."""
    planes = opensky.get_planes()
    return {
        "count": len(planes),
        "planes": planes
    }
@app.get("/api/transport")
def get_transport():
    """Hava limanından şəhərə nəqliyyat variantları"""
    return {
        "airport": "Heydər Əliyev Hava Limanı (GYD)",
        "options": [
            {
                "type": "🚌 Aero Express",
                "price": "1.30 AZN",
                "time": "40 dəq",
                "schedule": "Növbəti: 14:45, 15:15",
                "note": "28 May metro istiqaməti"
            },
            {
                "type": "🚕 Taksi (Bolt/Yango)",
                "price": "20-30 AZN",
                "time": "25 dəq",
                "schedule": "İstənilən vaxt",
                "note": "Rəsmi taksi Terminal 1-dədir"
            },
            {
                "type": "🚗 Şəxsi Transfer",
                "price": "50+ AZN",
                "time": "20 dəq",
                "schedule": "Əvvəlcədən bron",
                "note": "Lüks avtomobillər"
            }
        ]
    }
@app.get("/api/flight-route/{callsign}")
async def get_flight_route(callsign: str):
    # Callsign-ın əvvəlində/sonunda boşluqlar varsa təmizləyirik
    callsign = callsign.strip().upper()
    if not callsign:
        return {"error": "Callsign tapılmadı"}

    # Pulsuz marşrut API-si (adsbdb.com)
    url = f"https://api.adsbdb.com/v0/callsign/{callsign}"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                # API-dən gələn cavabı yoxlayırıq
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