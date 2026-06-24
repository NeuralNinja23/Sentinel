import json
import asyncio
import time
import audioop
import re
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import DATABASE_PATH, STANDBY_TIMEOUT_SECONDS, SENTINEL_SYSTEM_INSTRUCTION
from app.services.logger import get_logger
from app.memory.graph import GraphMemoryStore
from app.memory.graph_ops import build_warm_profile, format_warm_profile_block
from app.runtime.runtime_state import runtime_store, RuntimeState, runtime_events

from app.local.asr_service import ASRService
from app.local.tts_service import TTSService
from app.local.vad_service import VADService
from app.local.reasoning_service import ReasoningService
from app.api.upload import get_all_documents_text_context

router = APIRouter()
logger = get_logger("websocket")

# Initialize graph memory store pointing to Sentinel.db
memory_store = GraphMemoryStore(DATABASE_PATH)

async def process_user_turn(speech_bytes: bytes, websocket: WebSocket, session_state: dict):
    """Processes speech input: transcribes with Whisper, calls Ollama, and speaks with Kokoro."""
    session_state["is_model_speaking"] = True
    try:
        # 1. Speech-to-Text (ASR)
        transcription = await asyncio.to_thread(ASRService.transcribe, speech_bytes)
        if not transcription or len(transcription.strip()) < 2:
            logger.info("ASR: Transcription too short or empty. Ignoring.")
            session_state["is_model_speaking"] = False
            await websocket.send_json({"type": "state", "state": "READY"})
            return
            
        logger.info(f"ASR Transcription: '{transcription}'")
        # Send USER log to frontend
        await websocket.send_json({"type": "user", "data": transcription})
        
        # Set UI state to THINKING
        await websocket.send_json({"type": "state", "state": "THINKING"})
        
        # 2. Reasoning (Ollama LLM)
        # Build memory-based warm profile
        try:
            profile = build_warm_profile(memory_store, user_max_chars=4000, directives_max_chars=2000)
            warm_profile_block = format_warm_profile_block(profile)
        except Exception as mem_err:
            logger.error(f"Failed to build warm profile: {mem_err}")
            warm_profile_block = ""
            
        final_instruction = SENTINEL_SYSTEM_INSTRUCTION
        if warm_profile_block:
            final_instruction += "\n\n" + warm_profile_block
            
        docs_context = get_all_documents_text_context()
        if docs_context:
            final_instruction += "\n\n=== UPLOADED DOCUMENTS CONTEXT ===\n" + docs_context + "\n=================================="
            
        logger.info("Querying local Ollama instance...")
        # Get complete response from LLM
        response_text = await ReasoningService.generate_async(
            system_prompt=final_instruction,
            user_content=transcription,
            temperature=0.0
        )
        
        if not response_text:
            logger.error("LLM returned no response.")
            session_state["is_model_speaking"] = False
            await websocket.send_json({"type": "state", "state": "READY"})
            return
            
        logger.info(f"Ollama response: {response_text}")
        
        # Log full text to frontend
        await websocket.send_json({"type": "text", "data": response_text})
        
        # 3. Text-to-Speech (TTS)
        # Split response into sentences to generate TTS streams sequentially
        sentences = re.split(r'(?<=[.!?])\s+', response_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # We set speakingState to SPEAKING
        await websocket.send_json({"type": "state", "state": "READY"})
        
        for sentence in sentences:
            if not session_state["is_model_speaking"]:
                logger.info("TTS: Synthesis interrupted by user. Stopping.")
                break
                
            logger.info(f"TTS: Generating audio for sentence: '{sentence}'")
            # TTSService yields 24kHz 16-bit Mono PCM bytes
            audio_generator = await asyncio.to_thread(list, TTSService.generate_audio_stream(sentence))
            
            for audio_chunk in audio_generator:
                if not session_state["is_model_speaking"]:
                    break
                await websocket.send_bytes(audio_chunk)
                # Small sleep to prevent flooding the socket buffer too fast
                await asyncio.sleep(0.005)
                
    except Exception as e:
        logger.error(f"Error in local speech processing turn: {e}")
    finally:
        session_state["is_model_speaking"] = False
        try:
            await websocket.send_json({"type": "state", "state": "READY"})
        except Exception:
            pass

async def process_user_text_turn(text_query: str, websocket: WebSocket, session_state: dict):
    """Processes text query directly, bypassing ASR but generating vocal response."""
    session_state["is_model_speaking"] = True
    try:
        # Send USER log to frontend
        await websocket.send_json({"type": "user", "data": text_query})
        
        # Set UI state to THINKING
        await websocket.send_json({"type": "state", "state": "THINKING"})
        
        # 1. Reasoning (Ollama LLM)
        try:
            profile = build_warm_profile(memory_store, user_max_chars=4000, directives_max_chars=2000)
            warm_profile_block = format_warm_profile_block(profile)
        except Exception as mem_err:
            logger.error(f"Failed to build warm profile: {mem_err}")
            warm_profile_block = ""
            
        final_instruction = SENTINEL_SYSTEM_INSTRUCTION
        if warm_profile_block:
            final_instruction += "\n\n" + warm_profile_block
            
        docs_context = get_all_documents_text_context()
        if docs_context:
            final_instruction += "\n\n=== UPLOADED DOCUMENTS CONTEXT ===\n" + docs_context + "\n=================================="
            
        response_text = await ReasoningService.generate_async(
            system_prompt=final_instruction,
            user_content=text_query,
            temperature=0.0
        )
        
        if not response_text:
            session_state["is_model_speaking"] = False
            await websocket.send_json({"type": "state", "state": "READY"})
            return
            
        logger.info(f"Ollama response: {response_text}")
        await websocket.send_json({"type": "text", "data": response_text})
        
        # 2. Text-to-Speech (TTS)
        sentences = re.split(r'(?<=[.!?])\s+', response_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        await websocket.send_json({"type": "state", "state": "READY"})
        
        for sentence in sentences:
            if not session_state["is_model_speaking"]:
                break
            audio_generator = await asyncio.to_thread(list, TTSService.generate_audio_stream(sentence))
            for audio_chunk in audio_generator:
                if not session_state["is_model_speaking"]:
                    break
                await websocket.send_bytes(audio_chunk)
                await asyncio.sleep(0.005)
                
    except Exception as e:
        logger.error(f"Error in local text processing turn: {e}")
    finally:
        session_state["is_model_speaking"] = False
        try:
            await websocket.send_json({"type": "state", "state": "READY"})
        except Exception:
            pass

@router.websocket("/ws/voice")
async def voice_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("Frontend client connected to local /ws/voice WebSocket")
    
    # Initialize stateful local services
    vad = VADService(16000)
    
    session_state = {
        "last_input_time": time.time(),
        "client_sample_rate": None,
        "is_model_speaking": False,
        "is_user_speaking": False,
        "silence_chunks": 0,
        "audioop_state": None
    }
    
    speech_buffer = bytearray()
    vad_accumulator = bytearray()
    
    # Notify frontend of clean connection
    await websocket.send_json({"type": "system", "message": "Sentinel Local Mode Connected"})
    
    # Listeners for standby state broadcasts
    def on_standby_entered():
        asyncio.create_task(websocket.send_json({"type": "state", "state": "STANDBY"}))

    def on_standby_exited():
        asyncio.create_task(websocket.send_json({"type": "state", "state": "READY"}))

    runtime_events.on("STANDBY_ENTERED", on_standby_entered)
    runtime_events.on("STANDBY_EXITED", on_standby_exited)

    # Inactivity checker task
    async def inactivity_checker():
        from app.runtime.runtime_service import runtime_service
        while True:
            try:
                await asyncio.sleep(10)
                if runtime_store.state not in (RuntimeState.STANDBY, RuntimeState.WAKING):
                    elapsed = time.time() - runtime_store.last_activity_time
                    if elapsed >= STANDBY_TIMEOUT_SECONDS:
                        logger.info(f"[INACTIVITY] {STANDBY_TIMEOUT_SECONDS}s of idle. Entering standby.")
                        runtime_service.standby()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Inactivity checker error: {e}")

    inactivity_task = asyncio.create_task(inactivity_checker())

    try:
        while True:
            message = await websocket.receive()
            
            if message.get("type") == "websocket.disconnect":
                raise WebSocketDisconnect()
                
            # Standby wake-up guard
            if runtime_store.state in (RuntimeState.STANDBY, RuntimeState.WAKING):
                is_wake_trigger = False
                if runtime_store.state == RuntimeState.STANDBY and "text" in message and message["text"]:
                    try:
                        payload = json.loads(message["text"])
                        p_type = payload.get("type")
                        cmd_text = payload.get("text", "").upper().strip()
                        if p_type == "wake_word":
                            is_wake_trigger = True
                        elif p_type == "command" and cmd_text in ("EXIT_STANDBY", "WAKE", "EXIT standby"):
                            is_wake_trigger = True
                        elif p_type == "governance" and payload.get("command") == "exit_standby":
                            is_wake_trigger = True
                    except Exception:
                        pass
                
                if is_wake_trigger:
                    logger.info("Wake word/command received. Waking up.")
                    runtime_store.update_activity()
                    from app.runtime.runtime_service import runtime_service
                    asyncio.create_task(runtime_service.wake(websocket))
                continue
            else:
                runtime_store.update_activity()

            # Process text messages/payloads
            if "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                    p_type = payload.get("type")
                    
                    if p_type == "config":
                        rate = payload.get("sampleRate", 16000)
                        session_state["client_sample_rate"] = rate
                        logger.info(f"Client sample rate configured: {rate} Hz")
                        
                    elif p_type == "command":
                        cmd_text = payload.get("text", "")
                        if cmd_text:
                            if cmd_text.upper().strip() == "ENTER_STANDBY":
                                from app.runtime.runtime_service import runtime_service
                                runtime_service.standby()
                            elif cmd_text.upper().strip() == "EXIT_STANDBY":
                                from app.runtime.runtime_service import runtime_service
                                asyncio.create_task(runtime_service.wake(websocket))
                            else:
                                # Intercept and process local text queries
                                asyncio.create_task(process_user_text_turn(cmd_text, websocket, session_state))
                                
                    elif p_type == "governance":
                        cmd = payload.get("command")
                        logger.info(f"Governance command received: {cmd}")
                        
                        if cmd == "pause":
                            from app.tasks.task_manager import pause_all_tasks
                            pause_all_tasks()
                        elif cmd == "resume":
                            from app.tasks.task_manager import resume_all_tasks
                            resume_all_tasks()
                        elif cmd == "stop":
                            from app.tasks.task_manager import stop_all_tasks
                            stop_all_tasks()
                            session_state["is_model_speaking"] = False
                            await websocket.send_json({"type": "interrupt"})
                        elif cmd == "enter_standby":
                            from app.runtime.runtime_service import runtime_service
                            runtime_service.standby()
                        elif cmd == "exit_standby":
                            from app.runtime.runtime_service import runtime_service
                            asyncio.create_task(runtime_service.wake(websocket))
                            
                except Exception as text_err:
                    logger.error(f"Error parsing json payload: {text_err}")

            # Process incoming binary audio bytes
            elif "bytes" in message and message["bytes"]:
                raw_audio = message["bytes"]
                
                if len(raw_audio) > 0 and len(raw_audio) % 2 == 0:
                    session_state["last_input_time"] = time.time()
                    client_rate = session_state.get("client_sample_rate")
                    
                    if client_rate is None:
                        continue
                        
                    # 1. Downsample audio to 16000 Hz if needed
                    if client_rate != 16000:
                        state = session_state.get("audioop_state", None)
                        raw_audio, new_state = audioop.ratecv(raw_audio, 2, 1, client_rate, 16000, state)
                        session_state["audioop_state"] = new_state
                        
                    # 2. Accumulate bytes for VAD (VAD processes in 512-sample/1024-byte blocks)
                    vad_accumulator.extend(raw_audio)
                    
                    while len(vad_accumulator) >= 1024:
                        chunk_to_vad = bytes(vad_accumulator[:1024])
                        del vad_accumulator[:1024]
                        
                        # Process VAD probability
                        prob = vad.is_speech(chunk_to_vad)
                        
                        if prob > 0.45:
                            # User is speaking
                            if not session_state["is_user_speaking"]:
                                logger.info(f"VAD: Speech detected (prob={prob:.2f}). Starting capture.")
                                session_state["is_user_speaking"] = True
                                session_state["silence_chunks"] = 0
                                
                                # Interrupt model playback immediately if it is speaking
                                if session_state["is_model_speaking"]:
                                    logger.info("VAD: User barge-in! Interrupting playback.")
                                    session_state["is_model_speaking"] = False
                                    await websocket.send_json({"type": "interrupt"})
                                    
                            # Accumulate PCM audio for Whisper translation
                            speech_buffer.extend(chunk_to_vad)
                            session_state["silence_chunks"] = 0
                        else:
                            # Silence
                            if session_state["is_user_speaking"]:
                                speech_buffer.extend(chunk_to_vad)
                                session_state["silence_chunks"] += 1
                                
                                # Detect speech boundary: 1.2s of silence (1.2 / 0.032 = 38 chunks)
                                if session_state["silence_chunks"] >= 38:
                                    logger.info("VAD: Silence threshold met. User completed speech.")
                                    session_state["is_user_speaking"] = False
                                    
                                    # Copy buffer and trigger local speech turn thread
                                    audio_turn_data = bytes(speech_buffer)
                                    speech_buffer.clear()
                                    asyncio.create_task(process_user_turn(audio_turn_data, websocket, session_state))
                                    
    except WebSocketDisconnect:
        logger.info("Frontend WebSocket client disconnected cleanly.")
    except Exception as e:
        logger.error(f"Error in websocket loop: {e}")
    finally:
        inactivity_task.cancel()
        runtime_events.off("STANDBY_ENTERED", on_standby_entered)
        runtime_events.off("STANDBY_EXITED", on_standby_exited)
        try:
            from starlette.websockets import WebSocketState
            if websocket.client_state != WebSocketState.DISCONNECTED:
                await websocket.close()
        except Exception:
            pass
