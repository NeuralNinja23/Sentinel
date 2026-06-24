import threading
import numpy as np
from app.config import ASR_MODEL_SIZE
from app.services.logger import get_logger

logger = get_logger("asr_service")

class ASRService:
    _model = None
    _lock = threading.Lock()

    @classmethod
    def _get_model(cls):
        """Initialise and cache the WhisperModel instance (thread-safe)."""
        if cls._model is None:
            with cls._lock:
                if cls._model is None:
                    from faster_whisper import WhisperModel
                    logger.info(f"Loading local WhisperModel (size: '{ASR_MODEL_SIZE}') on CPU...")
                    try:
                        # Use cpu device and int8 compute type for fast execution and low memory overhead
                        cls._model = WhisperModel(
                            ASR_MODEL_SIZE, 
                            device="cpu", 
                            compute_type="int8"
                        )
                        logger.info("WhisperModel loaded successfully.")
                    except Exception as e:
                        logger.error(f"Failed to load WhisperModel: {e}")
                        raise e
        return cls._model

    @classmethod
    def transcribe(cls, pcm_bytes: bytes) -> str:
        """
        Transcribes raw 16-bit 16kHz PCM audio bytes into text.
        """
        if not pcm_bytes:
            return ""
            
        try:
            model = cls._get_model()
            
            # Convert 16-bit PCM bytes to float32 numpy array normalized to [-1.0, 1.0]
            audio_array = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            
            # Run transcription
            logger.info(f"Transcribing audio buffer of {len(pcm_bytes)} bytes locally...")
            segments, info = model.transcribe(audio_array, beam_size=5)
            
            text_segments = []
            for segment in segments:
                text_segments.append(segment.text)
                
            transcription = "".join(text_segments).strip()
            logger.info(f"Transcription complete: '{transcription}'")
            return transcription
        except Exception as e:
            logger.error(f"Error in local ASR transcription: {e}")
            return ""
