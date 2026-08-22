from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_name: str = "Podimart Seller Center"
    auth_mode: str = "local"  # local | cognito
    jwt_secret: str = "podimart-sellercenter-dev-change-me"
    jwt_expire_hours: int = 24 * 14
    storage: str = "local"  # local | dynamodb
    aws_region: str = "ap-south-1"
    table_sellers: str = "podimart-sellers"
    table_products: str = "podimart-products"
    table_orders: str = "podimart-orders"
    s3_bucket: str = ""
    public_asset_base: str = ""
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    upload_dir: Path = ROOT / "uploads"
    data_dir: Path = ROOT / "data"
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174,"
        "https://sellercenter.podimart.lk"
    )
    # email_provider: ses (Amazon SES API) | smtp
    email_provider: str = "ses"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "podimart.lk <no-reply@podimart.lk>"
    contact_to_email: str = "nadunovitigala@gmail.com"
    whatsapp_token: str = ""
    whatsapp_phone_id: str = ""
    whatsapp_template: str = ""
    whatsapp_template_lang: str = "en"


settings = Settings()
if settings.storage.lower() != "dynamodb":
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
