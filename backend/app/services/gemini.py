import time
import asyncio
from fastapi import WebSocket
from google import genai
from app.config import PROJECT_ID, REGION
from app.services.logger import get_logger

logger = get_logger("gemini_service")

logger.info(f"Initializing Vertex AI Client for project {PROJECT_ID} in {REGION}...")
try:
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=REGION)
except Exception as e:
    logger.error(f"Failed to initialize GenAI client: {e}")
    client = None

async def receive_from_gemini(session, websocket: WebSocket, session_state: dict):
    """Continuously receive responses from Gemini Live and forward to Frontend"""
    try:
        while True:
            async for response in session.receive():
                server_content = response.server_content
                if server_content is not None:
                    # Detect Barge-in / Interruption
                    if server_content.interrupted:
                        logger.warning("User barge-in detected. Sending interrupt signal.")
                        await websocket.send_json({"type": "interrupt"})
                        
                    model_turn = server_content.model_turn
                    if model_turn:
                        for part in model_turn.parts:
                            if part.inline_data and part.inline_data.data:
                                if not session_state.get("first_chunk_received", True):
                                    latency = time.time() - session_state.get("last_input_time", time.time())
                                    logger.info(f"[LATENCY] First audio chunk received in {latency * 1000:.0f} ms")
                                    session_state["first_chunk_received"] = True

                                audio_len = len(part.inline_data.data)
                                
                                # SDK returns bytes natively (base64 encoded)
                                if isinstance(part.inline_data.data, bytes):
                                    b64_audio = part.inline_data.data.decode("utf-8")
                                else:
                                    b64_audio = part.inline_data.data
                                    
                                await websocket.send_json({
                                    "type": "audio",
                                    "data": b64_audio
                                })
                            
                            if part.text:
                                logger.info(f"Text Response: {part.text}")
                                await websocket.send_json({
                                    "type": "text",
                                    "data": part.text
                                })
    except asyncio.CancelledError:
        logger.info("Receive task cancelled cleanly.")
    except Exception as e:
        logger.error(f"Error receiving from Gemini: {e}")
