from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opensky import get_planes

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
    print("--- API SORĞUSU GƏLDİ ---")
    planes = get_planes()
    print(f"--- QAYTARILAN TƏYYARƏ SAYI: {len(planes)} ---")
    return {"planes": planes}