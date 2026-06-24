import os
import urllib.request
import threading
import numpy as np
from app.services.logger import get_logger

logger = get_logger("vad_service")

VAD_MODEL_URL = "https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.onnx"

class VADService:
    _session = None
    _lock = threading.Lock()
    
    _cache_dir = os.path.join(os.path.dirname(__file__), "resources")
    _model_path = os.path.join(_cache_dir, "silero_vad.onnx")

    @classmethod
    def _ensure_model_file(cls):
        """Downloads the Silero VAD ONNX model file if it does not exist."""
        if not os.path.exists(cls._cache_dir):
            os.makedirs(cls._cache_dir, exist_ok=True)
            
        if not os.path.exists(cls._model_path):
            logger.info(f"Downloading Silero VAD ONNX from {VAD_MODEL_URL} to {cls._model_path}...")
            urllib.request.urlretrieve(VAD_MODEL_URL, cls._model_path)
            logger.info("Silero VAD ONNX downloaded successfully.")

    @classmethod
    def _get_session(cls):
        """Returns the initialized ONNX Runtime InferenceSession (cached singleton)."""
        if cls._session is None:
            with cls._lock:
                if cls._session is None:
                    cls._ensure_model_file()
                    import onnxruntime as ort
                    logger.info("Initializing Silero VAD InferenceSession on CPU...")
                    try:
                        # Force CPU execution provider to keep GPU VRAM completely clear
                        cls._session = ort.InferenceSession(
                            cls._model_path, 
                            providers=['CPUExecutionProvider']
                        )
                        logger.info("Silero VAD InferenceSession initialized successfully.")
                    except Exception as e:
                        logger.error(f"Failed to initialize Silero VAD session: {e}")
                        raise e
        return cls._session

    def __init__(self, sample_rate: int = 16000):
        self.session = self._get_session()
        self.sample_rate = sample_rate
        self.reset()

    def reset(self):
        """Resets the stateful LSTM memory."""
        self._state = np.zeros((2, 1, 128), dtype=np.float32)

    def is_speech(self, pcm_bytes: bytes) -> float:
        """
        Processes a single audio chunk (pcm_bytes).
        Audio must be 16kHz or 8kHz mono 16-bit PCM.
        Returns the speech probability [0.0, 1.0].
        """
        if not pcm_bytes:
            return 0.0
            
        try:
            # Convert 16-bit PCM bytes to float32 numpy array normalized to [-1.0, 1.0]
            audio_array = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            
            # Ensure input shape is (1, num_samples)
            audio_input = np.expand_dims(audio_array, axis=0)
            
            # Prepare inputs
            inputs = {
                "input": audio_input,
                "sr": np.array(self.sample_rate, dtype=np.int64),
                "state": self._state
            }
            
            # Run inference
            outputs = self.session.run(None, inputs)
            speech_prob = float(outputs[0][0][0])
            
            # Update state for next chunk
            self._state = outputs[1]
            
            return speech_prob
        except Exception as e:
            logger.error(f"VAD process error: {e}")
            return 0.0
