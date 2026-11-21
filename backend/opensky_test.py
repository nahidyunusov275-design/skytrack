from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opensky import get_planes # Yuxarıdakı faylı import edirik

app = FastAPI()

# CORS (React-in backend-ə qoşulması üçün MÜTLƏQDİR)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # İnkişaf mərhələsində hər şeyə icazə veririk
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/planes")
def api_planes():
    planes = get_planes()
    if not planes:
        return {"planes": [], "error": "Heç bir təyyarə tapılmadı."}
    return {"planes": planes}
