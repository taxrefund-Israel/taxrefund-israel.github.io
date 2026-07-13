from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://tac:tac_password@localhost:5432/tax_advance_checker"
    jwt_secret: str = "change_me_in_production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    storage_backend: str = "minio"   # "minio" (production) | "local" (preview)
    local_storage_dir: str = "./uploads"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "tac-files"
    minio_secure: bool = False

    cors_origins: str = "http://localhost:3000"

    seed_admin_email: str = "admin@example.com"
    seed_admin_password: str = "Admin123!"
    seed_admin_name: str = "מנהל מערכת"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
