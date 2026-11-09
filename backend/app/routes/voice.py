
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response

from app.services.gnani_prisma import transcribe_audio_gnani
from app.services.gnani_timbre import synthesize_speech_gnani

router = APIRouter(prefix="/api/voice", tags=["Voice"])


@router.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form("en-IN")
):
    try:
        content = await audio.read()

        print("========== GNANI STT DEBUG ==========")
        print("Filename:", audio.filename)
        print("Content type:", audio.content_type)
        print("Audio size:", len(content))
        print("Language:", language)

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded audio is empty."
            )

        result = await transcribe_audio_gnani(
            content,
            language_code=language,
            filename=audio.filename or "recording.wav"
        )

        print("Raw Gnani result:", repr(result))
        print("Result type:", type(result).__name__)
        print("=====================================")

        if isinstance(result, dict):
            transcript = (
                result.get("transcript")
                or result.get("text")
                or result.get("data", {}).get("transcript")
                or result.get("data", {}).get("text")
            )
        else:
            transcript = result

        if not isinstance(transcript, str) or not transcript.strip():
            raise HTTPException(
                status_code=502,
                detail=f"Gnani returned no usable transcript. Raw result: {repr(result)}"
            )

        return {
            "success": True,
            "transcript": transcript.strip()
        }

    except HTTPException:
        raise
    except Exception as e:
        print("GNANI TRANSCRIPTION ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/speak")
async def speak(data: dict):
    text = data.get("text", "")
    language = data.get("language", "en-IN")

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Text parameter is required"
        )

    try:
        audio_bytes = await synthesize_speech_gnani(
            text,
            language_code=language
        )

        return Response(
            content=audio_bytes,
            media_type="audio/wav"
        )

    except Exception as e:
        print("GNANI SPEECH ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))
