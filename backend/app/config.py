from pydantic_settings import BaseSettings, SettingsConfigDict


# Setarile aplicatiei, citite din variabilele de mediu
# (in Docker: din .env-ul din folderul principal, transmise prin compose.yaml).
# Numele variabilei este numele campului scris cu litere mari (database_url -> DATABASE_URL).
# Valorile de mai jos sunt folosite doar daca variabila lipseste.
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://isia:isia@localhost:5432/isia"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:1.5b"
    cors_origins: str = "http://localhost:5173"

    # "http://a,http://b" -> ["http://a", "http://b"]
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
