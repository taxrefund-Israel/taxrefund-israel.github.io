from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, cases, imports, advances, calculations, admin, reports

app = FastAPI(title="בדיקת מקדמות מס וביטוח לאומי", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(imports.router)
app.include_router(advances.router)
app.include_router(calculations.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {"status": "ok"}
