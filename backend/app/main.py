from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import settings
from app.routers import ai, health, incident_updates, incidents, services

# Aplicatia FastAPI. Documentatia interactiva (Swagger) este la http://localhost:8000/docs
app = FastAPI(
    title="Incidente on-call – API",
    description="Gestionarea incidentelor pentru serviciile unei echipe on-call (proiect IS + IA).",
    version="1.0.0",
)

# CORS: permite frontend-ului React (alt port) sa apeleze API-ul din browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Toate rutele API incep cu /api
app.include_router(health.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(incident_updates.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


# Adresa principala trimite la documentatie
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")
