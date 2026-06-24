import time
import asyncio
import functools
from fastapi import WebSocket
from google import genai
from google.genai import types
from app.config import PROJECT_ID, REGION
from app.services.logger import get_logger

logger = get_logger("gemini_service")

logger.info(f"Initializing Vertex AI Client for project {PROJECT_ID} in {REGION}...")
try:
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=REGION)
except Exception as e:
    logger.error(f"Failed to initialize GenAI client: {e}")
    client = None

async def execute_tool_call(session, function_call, websocket: WebSocket):
    """Executes a single tool call through the Conversation Runtime."""
    from app.runtime.conversation_runtime import handle_tool_call
    tool_name = function_call.name
    tool_id = function_call.id
    
    try:
        # Route to the Conversation Runtime
        result = await handle_tool_call(function_call, websocket)
    except asyncio.CancelledError:
        logger.warning(f"Tool {tool_name} was cancelled by user interrupt.")
        result = f"Tool {tool_name} was cancelled."
    except Exception as e:
        logger.error(f"Error executing tool {tool_name}: {e}")
        result = f"Error executing tool: {e}"
        
    response = types.FunctionResponse(
        name=tool_name,
        id=tool_id,
        response={"result": result}
    )
    try:
        await session.send(input=response)
    except Exception as e:
        logger.warning(f"Could not send tool response for {tool_name}: {e}")

async def _run_tools_sequentially(function_calls, session, websocket: WebSocket):
    """Execute a list of function calls one-by-one in order."""
    for fc in function_calls:
        current = asyncio.current_task()
        if current and current.cancelled():
            logger.warning("Tool batch cancelled — stopping sequential execution.")
            return
        try:
            await execute_tool_call(session, fc, websocket)
        except asyncio.CancelledError:
            logger.warning("Sequential tool runner cancelled mid-execution.")
            return
        except Exception as e:
            logger.error(f"Unhandled error in sequential tool runner: {e}")


async def receive_from_gemini(session, websocket: WebSocket, session_state: dict):
    """Continuously receive responses from Gemini Live and forward to Frontend"""
    from app.runtime.runtime_state import runtime_store, RuntimeState
    try:
        while True:
            async for response in session.receive():
                if runtime_store.state in (RuntimeState.STANDBY, RuntimeState.WAKING):
                    continue
                
                if getattr(response, "tool_call", None) and getattr(response.tool_call, "function_calls", None):

                    fcs = list(response.tool_call.function_calls)
                    for fc in fcs:
                        asyncio.create_task(execute_tool_call(session, fc, websocket))

                server_content = response.server_content
                if server_content is not None:
                    if server_content.interrupted:
                        logger.warning("User barge-in detected. Cancelling synchronous tool tasks.")
                        # We no longer cancel all background tasks automatically on interrupt. 
                        # We only interrupt the synchronous speech/responses.
                        await websocket.send_json({"type": "interrupt"})
                        
                    model_turn = server_content.model_turn
                    if model_turn:
                        session_state["is_model_speaking"] = True
                        for part in model_turn.parts:
                            if part.inline_data and part.inline_data.data:
                                if not session_state.get("first_chunk_received", True):
                                    latency = time.time() - session_state.get("last_input_time", time.time())
                                    logger.info(f"[LATENCY] First audio chunk received in {latency * 1000:.0f} ms")
                                    session_state["first_chunk_received"] = True

                                audio_len = len(part.inline_data.data)
                                
                                import base64
                                # SDK usually returns raw bytes, but sometimes base64 encoded strings/bytes
                                if isinstance(part.inline_data.data, bytes):
                                    try:
                                        raw_pcm = base64.b64decode(part.inline_data.data)
                                    except Exception:
                                        raw_pcm = part.inline_data.data
                                else:
                                    raw_pcm = base64.b64decode(part.inline_data.data)
                                    
                                # FIX #43: Drop audio if governance mute is active
                                if time.time() < session_state.get("ignore_audio_until", 0):
                                    continue
                                    
                                # FIX #14: Send raw binary PCM audio over WebSocket
                                await websocket.send_bytes(raw_pcm)
                            
                            if part.text:
                                if time.time() < session_state.get("ignore_audio_until", 0):
                                    continue
                                logger.info(f"Text Response: {part.text}")
                                await websocket.send_json({
                                    "type": "text",
                                    "data": part.text
                                })
                    
                    if server_content.turn_complete:
                        session_state["is_model_speaking"] = False
                        
    except asyncio.CancelledError:
        logger.info("Receive task cancelled cleanly.")
    except Exception as e:
        logger.error(f"Error receiving from Gemini: {e}")
