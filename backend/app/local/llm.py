from app.services.logger import get_logger
from app.local.reasoning_service import ReasoningService

logger = get_logger("llm_direct")

def call_llm_direct(base_url: str, chat_model: str, system_prompt: str, user_content: str, timeout_sec: float = 10.0, thinking: bool = False, num_ctx: int = 4096, temperature: float = None) -> str:
    """Redirects direct LLM calls from memory tasks to the local ReasoningService (Ollama)."""
    try:
        res = ReasoningService.generate(
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=temperature if temperature is not None else 0.0,
            stream=False,
            timeout_sec=timeout_sec
        )
        if res:
            return res
    except Exception as e:
        logger.error(f"Failed to call local LLM direct for memory tasks: {e}")
        return None
    return None

def call_llm_streaming(base_url: str, chat_model: str, system_prompt: str, user_content: str, on_token=None, timeout_sec: float = 30.0, thinking: bool = False) -> str:
    """Redirects streaming LLM calls from memory tasks to the local ReasoningService (Ollama)."""
    try:
        res = ReasoningService.generate(
            system_prompt=system_prompt,
            user_content=user_content,
            temperature=0.0,
            stream=True,
            on_token=on_token,
            timeout_sec=timeout_sec
        )
        return res
    except Exception as e:
        logger.error(f"Failed to call local LLM streaming for memory tasks: {e}")
        return None
