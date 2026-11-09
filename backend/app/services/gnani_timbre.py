import httpx
from app.config import settings

VOICE_MAP = {
    "hi-IN": "Nalini",
    "kn-IN": "Kaveri",
    "te-IN": "Deepak",
    "ta-IN": "Nalini",
    "en-IN": "Nalini"
}

async def synthesize_speech_gnani(text: str, language_code: str = "hi-IN") -> bytes:
    """
    Generates audio using official Gnani Timbre REST API (timbre-v2.5)
    """
    if not settings.GNANI_API_KEY:
        raise ValueError("GNANI_API_KEY is not configured in backend .env")

    voice_name = VOICE_MAP.get(language_code, "Nalini")
    
    headers = {
        "X-API-Key-ID": settings.GNANI_API_KEY,
        "Content-Type": "application/json"
    }

    payload = {
        "text": text,
        "voice": voice_name,
        "model": "timbre-v2.5",
        "language": language_code,
        "speed": 1.0,
        "audio_config": {
            "encoding": "linear_pcm",
            "container": "wav",
            "sample_rate": 24000,
            "num_channels": 1,
            "sample_width": 2
        }
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            settings.GNANI_TIMBRE_ENDPOINT,
            headers=headers,
            json=payload
        )

        if response.status_code != 200:
            raise Exception(f"Gnani Timbre TTS Error ({response.status_code}): {response.text}")

        return response.content