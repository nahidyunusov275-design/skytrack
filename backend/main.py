from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opensky import get_planes
from opensky_3d import get_planes_3d

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2D üçün
@app.get("/api/planes")
def api_planes():
    planes = get_planes()
    return {"planes": planes}

# 3D üçün
@app.get("/api/planes-3d")
def api_planes_3d():
    planes = get_planes_3d()
    return {"planes": planes}