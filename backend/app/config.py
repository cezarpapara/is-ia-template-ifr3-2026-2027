from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://isia:isia@localhost:5432/isia"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:1.5b"
    gemini_api_key: str = ""
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def DATABASE_URL(self) -> str:
        return self.database_url

    @property
    def OLLAMA_URL(self) -> str:
        return self.ollama_url

    @property
    def OLLAMA_MODEL(self) -> str:
        return self.ollama_model

    @property
    def GEMINI_API_KEY(self) -> str:
        return self.gemini_api_key

    @property
    def CORS_ORIGINS(self) -> str:
        return self.cors_origins


settings = Settings()
