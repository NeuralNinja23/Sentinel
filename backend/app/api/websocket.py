import json
import base64
import asyncio
import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from google.genai import types

from app.config import MODEL, SENTINEL_PROMPT
from app.services.gemini import client, receive_from_gemini
from app.services.logger import get_logger

router = APIRouter()
logger = get_logger("websocket")

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
                    return # Exit completely if frontend drops
                finally:
                    if receive_task:
                        receive_task.cancel()
                    
        except Exception as e:
            logger.error(f"Error in Gemini Live connection: {e}")
            if receive_task:
                receive_task.cancel()
                
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
