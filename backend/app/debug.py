from app.services.logger import get_logger

logger = get_logger("memory_debug")

def debug_log(message: str, channel: str = "general") -> None:
    """Logs memory/debug messages using Sentinel's logger."""
    logger.info(f"[{channel.upper()}] {message}")
