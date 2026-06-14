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
            logger.info(f"Connecting to Gemini Live API using model: {MODEL} (Attempt {retry_count + 1}/{max_retries})")
            
            config = types.LiveConnectConfig(
                response_modalities=[types.Modality.AUDIO],
                system_instruction=SENTINEL_PROMPT,
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
                        receive_text_task = asyncio.create_task(websocket.receive_text())
                        done, pending = await asyncio.wait(
                            [receive_text_task, receive_task],
                            return_when=asyncio.FIRST_COMPLETED
                        )
                        
                        if receive_task in done:
                            logger.error("Gemini receive task terminated unexpectedly. Triggering reconnect...")
                            receive_text_task.cancel()
                            break # Break to trigger reconnect
                            
                        if receive_text_task in done:
                            try:
                                data = receive_text_task.result()
                                payload = json.loads(data)
                                
                                if payload.get("type") == "wake_word":
                                    logger.info("Wake word received. Triggering Sentinel online greeting.")
                                    await session.send(input="Say exactly: Sentinel online.")
                                    
                                elif payload.get("type") == "audio":
                                    b64_data = payload.get("data")
                                    raw_audio = base64.b64decode(b64_data)
                                    
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
            logger.error(f"Error in Gemini Live connection: {e}")
            if receive_task:
                receive_task.cancel()
            if vision_task:
                vision_task.cancel()
                
            retry_count += 1
            if retry_count < max_retries:
                logger.info(f"Reconnecting in 2 seconds...")
                try:
                    await websocket.send_json({"type": "system", "message": f"Reconnecting to AI core (Attempt {retry_count}/{max_retries})..."})
                except:
                    pass
                await asyncio.sleep(2)
            else:
                logger.error("Max retries reached. Closing WebSocket.")
                try:
                    await websocket.close()
                except:
                    pass
                return
