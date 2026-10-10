from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import settings
from app.routers import health, jobs, memory, modele, projects, system, tasks
from app.services import system as telemetry
from app.services import worker


# La pornire: telemetria (CPU/RAM) si worker-ul care proceseaza agenda; la oprire le oprim
@asynccontextmanager
async def lifespan(app: FastAPI):
    telemetry.start()
    worker.start()
    yield
    worker.stop()
    telemetry.stop()


# Aplicatia FastAPI. Documentatia interactiva (Swagger) este la /docs
app = FastAPI(
    title="Scriptorium – orchestrator de modele locale",
    description="Agenda de joburi pentru LLM-uri, istoric, memorie si telemetria serverului.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS: permite frontend-ului React (alt port) sa apeleze API-ul din browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Toate rutele API incep cu /api
for module in (health, jobs, memory, modele, system, projects, tasks):
    app.include_router(module.router, prefix="/api")


# Adresa principala trimite la documentatie
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")
