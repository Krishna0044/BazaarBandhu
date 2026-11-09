
import httpx
import json
import io
import wave
import array

from app.config import settings


def inspect_audio(audio_bytes: bytes):
    """Inspect WAV audio to check whether it contains recorded sound."""

    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wav:
            channels = wav.getnchannels()
            sample_rate = wav.getframerate()
            frames = wav.getnframes()
            sample_width = wav.getsampwidth()
            duration = frames / sample_rate if sample_rate else 0

            raw = wav.readframes(frames)

            if sample_width == 2:
                samples = array.array("h")
                samples.frombytes(raw)

                if samples:
                    peak = max(abs(s) for s in samples)
                    rms = (
                        sum(s * s for s in samples) / len(samples)
                    ) ** 0.5
                else:
                    peak = 0
                    rms = 0
            else:
                peak = -1
                rms = -1

            print("\n========== AUDIO INSPECTION ==========")
            print("Channels:", channels)
            print("Sample rate:", sample_rate)
            print("Duration:", round(duration, 2), "seconds")
            print("Sample width:", sample_width)
            print("Peak amplitude:", peak)
            print("Average RMS:", round(rms, 2))
            print("======================================\n")

    except Exception as e:
        print("AUDIO INSPECTION ERROR:", repr(e))


async def transcribe_audio_gnani(
    audio_bytes: bytes,
    language_code: str = "indic-auto",
    filename: str = "audio.wav"
) -> str:

    if not settings.GNANI_API_KEY:
        raise ValueError(
            "GNANI_API_KEY is not configured in backend .env"
        )

    if not audio_bytes:
        raise ValueError("Received empty audio file.")

    inspect_audio(audio_bytes)

    headers = {
        "X-API-Key-ID": settings.GNANI_API_KEY
    }

    files = {
        "audio_file": (
            filename,
            audio_bytes,
            "audio/wav"
        )
    }

    # Always use automatic language identification.
    # The mobile app may still send en-IN, but we intentionally
    # override it so regional languages can be detected.
    detected_language_setting = "indic-auto"

    data = {
        "language_code": detected_language_setting,
        "model": "prisma-v3.0",
        "format": "transcribe",
        "itn_native_numerals": "true",
        "topic": (
            "Retail shop and vegetable market sales. "
            "Vendors speak about product names, fruits, vegetables, "
            "quantities, kilograms, prices and rupees. "
            "Speech may mix Indian regional languages and English."
        )
    }

    print("\n========== GNANI REQUEST ==========")
    print("Endpoint:", settings.GNANI_PRISMA_ENDPOINT)
    print("Filename:", filename)
    print("Audio bytes:", len(audio_bytes))
    print("Requested language:", language_code)
    print("Actual language setting:", detected_language_setting)
    print("Model: prisma-v3.0")
    print("Format: codemix")
    print("===================================\n")

    async with httpx.AsyncClient(timeout=60.0) as client:

        response = await client.post(
            settings.GNANI_PRISMA_ENDPOINT,
            headers=headers,
            files=files,
            data=data
        )

        print("\n========== GNANI RESPONSE ==========")
        print("HTTP status:", response.status_code)
        print("Response body:", response.text)
        print("====================================\n")

        if response.status_code != 200:
            raise Exception(
                f"Gnani Prisma error "
                f"({response.status_code}): {response.text}"
            )

        try:
            result = response.json()
        except json.JSONDecodeError:
            raise Exception(
                "Gnani returned a non-JSON response: "
                + response.text
            )

        if not isinstance(result, dict):
            raise Exception(
                f"Unexpected Gnani response: {repr(result)}"
            )

        if result.get("success") is False:
            raise Exception(
                f"Gnani transcription failed: {result}"
            )

        # Read detected language when provided by Prisma.
        detected_language = (
            result.get("detected_language_code")
            or result.get("language_code")
            or "unknown"
        )

        transcript = result.get("transcript")

        if not transcript:
            output = result.get("output")

            if isinstance(output, dict):
                transcript = (
                    output.get("literal")
                    or output.get("transcript")
                    or output.get("text")
                )

            elif isinstance(output, str):
                transcript = output

        if not isinstance(transcript, str) or not transcript.strip():
            raise Exception(
                "Gnani returned no usable transcript. "
                f"Full response: {result}"
            )

        transcript = transcript.strip()

        print("\n========== TRANSCRIPTION RESULT ==========")
        print("Detected language:", detected_language)
        print("Transcript:", transcript)
        print("==========================================\n")

        return transcript
