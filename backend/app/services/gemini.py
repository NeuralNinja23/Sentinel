import time
import asyncio
import functools
from fastapi import WebSocket
from google import genai
from google.genai import types
from app.config import PROJECT_ID, REGION
from app.services.logger import get_logger

from app.Sentinel.tools.fs_tools import list_directory, read_file, get_file_tree
from app.Sentinel.tools.search import search_code
from app.Sentinel.tools.mapper import explain_architecture, explain_module, find_dependencies
from app.Sentinel.tools.context import analyze_codebase_for_query


# ── FIX #1: Global task registry for cancellation ────────────────────────────
# All active tool tasks are tracked here so they can be cancelled on interrupt.
_active_tool_tasks: set[asyncio.Task] = set()

def _cancel_all_tool_tasks() -> None:
    """Cancel every in-flight tool task immediately."""
    for task in list(_active_tool_tasks):
        if not task.done():
            task.cancel()
    _active_tool_tasks.clear()

# ─────────────────────────────────────────────────────────────────────────────

TOOL_REGISTRY = {
    # System/Codebase Tools
    "list_directory": list_directory,
    "read_file": read_file,
    "get_file_tree": get_file_tree,
    "search_code": search_code,
    "explain_architecture": explain_architecture,
    "explain_module": explain_module,
    "find_dependencies": find_dependencies,
    "analyze_codebase_for_query": analyze_codebase_for_query,
}

logger = get_logger("gemini_service")

logger.info(f"Initializing Vertex AI Client for project {PROJECT_ID} in {REGION}...")
try:
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=REGION)
except Exception as e:
    logger.error(f"Failed to initialize GenAI client: {e}")
    client = None

async def execute_tool_call(session, function_call, websocket: WebSocket):
    """Execute a single tool call and send the result back to the Gemini session."""
    tool_name = function_call.name
    tool_args = function_call.args if function_call.args else {}
    tool_id = function_call.id
    
    logger.info(f"Executing tool: {tool_name} with args: {tool_args}")
    try:
        if tool_name in TOOL_REGISTRY:
            func = TOOL_REGISTRY[tool_name]
            # Execute in background process so we completely bypass the GIL and don't freeze the audio stream!
            loop = asyncio.get_running_loop()
            executor = websocket.app.state.tool_executor
            
            pfunc = functools.partial(func, **tool_args)
            result = await loop.run_in_executor(executor, pfunc)
        else:
            result = f"Error: Tool {tool_name} not found."
            
        logger.info(f"Tool {tool_name} executed successfully.")
    except asyncio.CancelledError:
        # FIX #1: Tool was cancelled by an interrupt — report it cleanly.
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
        logger.warning(f"Could not send tool response for {tool_name} (session may have ended): {e}")


# FIX #3: Sequential tool execution — runs all tool calls one after another,
# never concurrently, preventing race conditions and focus-stealing.
async def _run_tools_sequentially(function_calls, session, websocket: WebSocket):
    """Execute a list of function calls one-by-one in order."""
    for fc in function_calls:
        # Check if this batch was already cancelled before starting the next tool
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
    try:
        while True:
            async for response in session.receive():
                
                # FIX #3: Collect ALL function calls and dispatch as one sequential task
                # instead of spawning a separate fire-and-forget task per tool call.
                if getattr(response, "tool_call", None) and getattr(response.tool_call, "function_calls", None):
                    fcs = list(response.tool_call.function_calls)
                    tool_batch_task = asyncio.create_task(
                        _run_tools_sequentially(fcs, session, websocket)
                    )
                    # FIX #1: Register the task so it can be cancelled on interrupt
                    _active_tool_tasks.add(tool_batch_task)
                    tool_batch_task.add_done_callback(_active_tool_tasks.discard)

                server_content = response.server_content
                if server_content is not None:
                    # FIX #1 + #2: On barge-in/interrupt — cancel all running tools
                    # AND notify the frontend so it can signal turn_complete to Gemini.
                    if server_content.interrupted:
                        logger.warning("User barge-in detected. Cancelling all active tool tasks.")
                        _cancel_all_tool_tasks()
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
                                    
                                # FIX #14: Send raw binary PCM audio over WebSocket
                                await websocket.send_bytes(raw_pcm)
                            
                            if part.text:
                                logger.info(f"Text Response: {part.text}")
                                await websocket.send_json({
                                    "type": "text",
                                    "data": part.text
                                })
                    
                    if server_content.turn_complete:
                        session_state["is_model_speaking"] = False
                        
    except asyncio.CancelledError:
        logger.info("Receive task cancelled cleanly.")
        # FIX #1: Cancel any lingering tools when the receive loop is torn down
        _cancel_all_tool_tasks()
    except Exception as e:
        logger.error(f"Error receiving from Gemini: {e}")
