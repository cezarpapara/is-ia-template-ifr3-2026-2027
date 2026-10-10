from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import settings
from app.routers import ai, comments, health, projects, tasks

# Aplicatia FastAPI. Documentatia interactiva (Swagger) este la http://localhost:8000/docs
app = FastAPI(
    title="IS + IA – API template",
    description="API pentru laboratoarele de Inginerie software si Inteligenta artificiala.",
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
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


# Adresa principala trimite la documentatie
@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")
