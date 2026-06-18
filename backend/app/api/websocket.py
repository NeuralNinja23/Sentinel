import json
import base64
import asyncio
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google.genai import types

from app.config import MODEL, SENTINEL_PROMPT, VISION_INTERVAL, VISION_MIN_DIFF
from app.services.gemini import client, receive_from_gemini
from app.services.logger import get_logger
from app.services.screen import capture_primary_display

router = APIRouter()
logger = get_logger("websocket")

async def vision_loop(session, session_state):
    """Background loop that continuously captures the screen and sends frames to Gemini."""
    logger.info("Continuous Vision loop started.")
    while True:
        try:
            await asyncio.sleep(VISION_INTERVAL)
            # Run the heavy screen capture & opencv diffing in a background thread
            img_bytes = await asyncio.to_thread(
                capture_primary_display, 
                min_diff_threshold=VISION_MIN_DIFF
            )
            if img_bytes:
                if session_state.get("is_model_speaking", False):
                    logger.debug("[VISION] Model is speaking. Skipping frame upload to prevent barge-in.")
                    continue
                    
                logger.info(f"[VISION] Screen changed. Sending frame ({len(img_bytes) // 1024} KB)")
                realtime_input = types.LiveClientRealtimeInput(
                    media_chunks=[types.Blob(data=img_bytes, mime_type="image/jpeg")]
                )
                await session.send(input=realtime_input)
        except asyncio.CancelledError:
            logger.info("Continuous Vision loop stopped.")
            break
        except Exception as e:
            logger.error(f"Error in vision loop: {e}")

@router.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("Frontend client connected to /ws/voice")
    
    if client is None:
        await websocket.send_json({"type": "system", "message": "Failed to connect to Vertex AI."})
        await websocket.close()
        return

    session_state = {"last_input_time": time.time(), "first_chunk_received": True}
    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        receive_task = None
        vision_task = None
        try:
            from starlette.websockets import WebSocketState
            if websocket.client_state == WebSocketState.DISCONNECTED:
                logger.info("WebSocket is already disconnected. Aborting reconnect.")
                return

            logger.info(f"Connecting to Gemini Live API using model: {MODEL} (Attempt {retry_count + 1}/{max_retries})")
            
            # System tools declarations (codebase tools that still exist)
            # TOOL_DECLARATIONS from tools.py was removed — only system tools remain

            # Add system tools manually as they are defined in code directly
            system_tools_declarations = [
                {
                    "name": "list_directory",
                    "description": "Lists files and subdirectories in a specific directory path under the project root.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "path": {
                                "type": "STRING",
                                "description": "Directory path relative to workspace or absolute."
                            }
                        }
                    }
                },
                {
                    "name": "read_file",
                    "description": "Reads and returns content of a specific file. Returns up to 800 lines.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "path": {
                                "type": "STRING",
                                "description": "File path relative to workspace or absolute."
                            }
                        },
                        "required": ["path"]
                    }
                },
                {
                    "name": "get_file_tree",
                    "description": "Returns the full project file tree (excluding node_modules/venv). Useful to see the whole structure."
                },
                {
                    "name": "search_code",
                    "description": "Searches the codebase for specific text, filename, class, or function names.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "query": {
                                "type": "STRING",
                                "description": "Search query or pattern."
                            },
                            "search_type": {
                                "type": "STRING",
                                "description": "Type of search: 'text', 'filename', 'class', 'function'."
                            }
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "explain_architecture",
                    "description": "Generates a high-level architecture map of the codebase."
                },
                {
                    "name": "explain_module",
                    "description": "Explains a specific code module by locating files and listing content.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "module_name": {
                                "type": "STRING",
                                "description": "Name of the module to explain."
                            }
                        },
                        "required": ["module_name"]
                    }
                },
                {
                    "name": "find_dependencies",
                    "description": "Extracts imports and dependencies of a specific file.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "file_path": {
                                "type": "STRING",
                                "description": "File path relative to the workspace root."
                            }
                        },
                        "required": ["file_path"]
                    }
                },
                {
                    "name": "analyze_codebase_for_query",
                    "description": "Automated context assembly pipeline. Run this when you need detailed context on multiple files or complex issues.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "query": {
                                "type": "STRING",
                                "description": "Reasoning query to build codebase context for."
                            }
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "check_status",
                    "description": "Checks the status of all active background tasks and retrieves pending notifications/results. Run this when the user asks for status or updates."
                },
                {
                    "name": "cancel_task",
                    "description": "Cancels a specific background task.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "task_id": {
                                "type": "STRING",
                                "description": "The ID of the task to cancel."
                            }
                        },
                        "required": ["task_id"]
                    }
                }
            ]

            all_declarations = system_tools_declarations
            
            # Map declarations to the SDK expected format (types.Tool)
            func_decls = []
            for decl in all_declarations:
                # Build parameter schema if exists
                params = None
                if "parameters" in decl:
                    props = {}
                    for prop_name, prop_val in decl["parameters"].get("properties", {}).items():
                        props[prop_name] = types.Schema(
                            type=prop_val.get("type"),
                            description=prop_val.get("description")
                        )
                    params = types.Schema(
                        type=decl["parameters"].get("type", "OBJECT"),
                        properties=props,
                        required=decl["parameters"].get("required", [])
                    )
                
                func_decls.append(
                    types.FunctionDeclaration(
                        name=decl["name"],
                        description=decl["description"],
                        parameters=params
                    )
                )

            intelligence_tools = [types.Tool(function_declarations=func_decls)]

            from app.config import SENTINEL_SYSTEM_INSTRUCTION
            
            final_instruction = SENTINEL_SYSTEM_INSTRUCTION
                
            dynamic_prompt = types.Content(
                role="system",
                parts=[types.Part.from_text(text=final_instruction)]
            )

            config = types.LiveConnectConfig(
                response_modalities=[types.Modality.AUDIO],
                system_instruction=dynamic_prompt,
                tools=intelligence_tools,
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name="Charon"
                        )
                    )
                )
            )
            async with client.aio.live.connect(model=MODEL, config=config) as session:
                logger.info("Gemini Live session connected successfully!")
                await websocket.send_json({"type": "system", "message": "Gemini Live Connected via ADC"})
                retry_count = 0 # Reset retries on successful connection
                
                # Start background task to receive from Gemini
                receive_task = asyncio.create_task(receive_from_gemini(session, websocket, session_state))
                
                # Start Continuous Vision loop
                vision_task = asyncio.create_task(vision_loop(session, session_state))
                
                try:
                    while True:
                        receive_msg_task = asyncio.create_task(websocket.receive())
                        done, pending = await asyncio.wait(
                            [receive_msg_task, receive_task],
                            return_when=asyncio.FIRST_COMPLETED
                        )
                        
                        if receive_task in done:
                            logger.error("Gemini receive task terminated unexpectedly. Triggering reconnect...")
                            receive_msg_task.cancel()
                            break # Break to trigger reconnect
                            
                        if receive_msg_task in done:
                            try:
                                message = receive_msg_task.result()
                                
                                if message.get("type") == "websocket.disconnect":
                                    raise WebSocketDisconnect()
                                    
                                if "text" in message and message["text"]:
                                    payload = json.loads(message["text"])
                                    
                                    if payload.get("type") == "wake_word":
                                        logger.info("Wake word received. Triggering Sentinel online greeting.")
                                        await session.send(input="Say exactly: Sentinel online.")
                                        
                                    elif payload.get("type") == "turn_complete":
                                        logger.info("Frontend signalled turn_complete — forwarding to Gemini Live.")
                                        client_content = types.LiveClientContent(turn_complete=True)
                                        await session.send(input=client_content)
                                        
                                    # FIX #43: Handle command inputs from the frontend
                                    elif payload.get("type") == "command":
                                        cmd_text = payload.get("text", "")
                                        if cmd_text:
                                            logger.info(f"Command received: {cmd_text}")
                                            await session.send(input=cmd_text)
                                        
                                elif "bytes" in message and message["bytes"]:
                                    raw_audio = message["bytes"]
                                    
                                    session_state["last_input_time"] = time.time()
                                    session_state["first_chunk_received"] = False

                                    realtime_input = types.LiveClientRealtimeInput(
                                        media_chunks=[types.Blob(data=raw_audio, mime_type="audio/pcm;rate=16000")]
                                    )
                                    await session.send(input=realtime_input)



                            except WebSocketDisconnect:
                                raise # Handled by outer block
                            except Exception as send_err:
                                logger.error(f"Error processing frontend audio: {send_err}")
                                break # Break to trigger reconnect
                except WebSocketDisconnect:
                    logger.info("Frontend client disconnected")
                    if receive_task:
                        receive_task.cancel()
                    if 'vision_task' in locals() and vision_task:
                        vision_task.cancel()
                    return # Exit completely if frontend drops
                finally:
                    if receive_task:
                        receive_task.cancel()
                    if 'vision_task' in locals() and vision_task:
                        vision_task.cancel()
                    
        except Exception as e:
            error_str = str(e)
            if "websocket.close" in error_str or "closed" in error_str.lower():
                logger.info("WebSocket is closed. Exiting connection loop cleanly.")
                if receive_task: receive_task.cancel()
                if vision_task: vision_task.cancel()
                return

            logger.error(f"Error in Gemini Live connection: {e}")
            if receive_task:
                receive_task.cancel()
            if vision_task:
                vision_task.cancel()
                
            retry_count += 1
            if retry_count < max_retries:
                # FIX #19: Exponential backoff to prevent reconnect storms
                backoff = min(2 ** retry_count, 30)
                logger.info(f"Reconnecting in {backoff} seconds...")
                try:
                    await websocket.send_json({"type": "system", "message": f"Reconnecting to AI core (Attempt {retry_count}/{max_retries})..."})
                except:
                    pass
                await asyncio.sleep(backoff)
            else:
                logger.error("Max retries reached. Closing WebSocket.")
                try:
                    await websocket.close()
                except:
                    pass
                return
