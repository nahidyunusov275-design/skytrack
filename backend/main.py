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