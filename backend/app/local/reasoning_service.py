import json
import httpx
import asyncio
from app.config import OLLAMA_BASE_URL, OLLAMA_MODEL
from app.services.logger import get_logger

logger = get_logger("reasoning_service")

class ReasoningService:
    @staticmethod
    def generate(
        system_prompt: str,
        user_content: str,
        temperature: float = 0.0,
        stream: bool = False,
        on_token=None,
        timeout_sec: float = None
    ) -> str:
        """
        Sends a query to the local Ollama instance and returns the generated content.
        Uses synchronous streaming or block requests.
        """
        url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
        
        payload = {
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "options": {
                "temperature": temperature
            },
            "stream": stream
        }
        
        try:
            if stream and on_token:
                full_response = []
                with httpx.stream("POST", url, json=payload, timeout=timeout_sec) as response:
                    if response.status_code != 200:
                        logger.error(f"Ollama returned status {response.status_code}")
                        return ""
                    for line in response.iter_lines():
                        if line:
                            data = json.loads(line)
                            token = data.get("message", {}).get("content", "")
                            if token:
                                on_token(token)
                                full_response.append(token)
                return "".join(full_response)
            else:
                response = httpx.post(url, json=payload, timeout=timeout_sec)
                if response.status_code != 200:
                    logger.error(f"Ollama returned status {response.status_code}: {response.text}")
                    return ""
                data = response.json()
                return data.get("message", {}).get("content", "").strip()
        except Exception as e:
            logger.error(f"Failed to communicate with Ollama sync: {e}")
            return ""

    @staticmethod
    async def generate_async(
        system_prompt: str,
        user_content: str,
        temperature: float = 0.0,
        stream: bool = False,
        on_token=None,
        timeout_sec: float = None
    ) -> str:
        """
        Asynchronously sends a query to the local Ollama instance and returns the generated content.
        """
        url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/chat"
        
        payload = {
            "model": OLLAMA_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "options": {
                "temperature": temperature
            },
            "stream": stream
        }
        
        try:
            async with httpx.AsyncClient() as client:
                if stream and on_token:
                    full_response = []
                    async with client.stream("POST", url, json=payload, timeout=timeout_sec) as response:
                        if response.status_code != 200:
                            logger.error(f"Ollama returned status {response.status_code}")
                            return ""
                        async for line in response.aiter_lines():
                            if line:
                                data = json.loads(line)
                                token = data.get("message", {}).get("content", "")
                                if token:
                                    if asyncio.iscoroutinefunction(on_token):
                                        await on_token(token)
                                    else:
                                        on_token(token)
                                    full_response.append(token)
                    return "".join(full_response)
                else:
                    response = await client.post(url, json=payload, timeout=timeout_sec)
                    if response.status_code != 200:
                        logger.error(f"Ollama returned status {response.status_code}: {response.text}")
                        return ""
                    data = response.json()
                    return data.get("message", {}).get("content", "").strip()
        except Exception as e:
            logger.error(f"Failed to communicate with Ollama async: {e}")
            return ""
