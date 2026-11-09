import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GNANI_API_KEY: str = os.getenv("GNANI_API_KEY", "")
    GNANI_PRISMA_ENDPOINT: str = os.getenv("GNANI_PRISMA_ENDPOINT", "https://api.vachana.ai/stt/v3")
    GNANI_TIMBRE_ENDPOINT: str = os.getenv("GNANI_TIMBRE_ENDPOINT", "https://api.vachana.ai/api/v1/tts/inference")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./bazaarbandhu.db")

settings = Settings()
