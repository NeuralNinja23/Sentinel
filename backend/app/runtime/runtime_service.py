import time
import asyncio
import logging
import json
from datetime import datetime, timezone
from app.runtime.runtime_state import runtime_store, runtime_events, RuntimeState
from app.config import DATABASE_PATH
from app.memory.graph import GraphMemoryStore

logger = logging.getLogger("runtime_service")

class RuntimeService:
    def standby(self):
        if runtime_store.state == RuntimeState.STANDBY:
            return
        logger.info("Transitioning READY -> STANDBY")
        runtime_store.set_state(RuntimeState.STANDBY)
        runtime_store.standby_entered_at = time.time()
        
        # Log system event in GraphMemoryStore
        self._log_system_event("ENTER_STANDBY")
        
        # Emit event
        runtime_events.emit("STANDBY_ENTERED")

    async def wake(self, websocket=None):
        if runtime_store.state != RuntimeState.STANDBY:
            return
        logger.info("Transitioning STANDBY -> WAKING")
        runtime_store.set_state(RuntimeState.WAKING)
        
        # Notify websocket client of WAKING state
        if websocket:
            try:
                await websocket.send_json({"type": "state", "state": "WAKING"})
            except Exception as e:
                logger.warning(f"Could not send WAKING state to client: {e}")
        
        # Intentional 1-second delay
        await asyncio.sleep(1.0)
        
        duration = round(time.time() - runtime_store.standby_entered_at, 2)
        logger.info(f"Transitioning WAKING -> READY (standby duration: {duration}s)")
        
        runtime_store.set_state(RuntimeState.READY)
        
        # Log system event in GraphMemoryStore with duration
        self._log_system_event("EXIT_STANDBY", duration)
        # Log summary STANDBY_SESSION event node
        self._log_standby_session(runtime_store.standby_entered_at, time.time(), duration)
        
        # Emit event
        runtime_events.emit("STANDBY_EXITED")
        
        # Notify websocket client of READY state
        if websocket:
            try:
                await websocket.send_json({"type": "state", "state": "READY"})
            except Exception as e:
                logger.warning(f"Could not send READY state to client: {e}")

    def speaking(self) -> bool:
        if runtime_store.state in (RuntimeState.STANDBY, RuntimeState.WAKING):
            logger.warning(f"Speaking state denied. Currently in {runtime_store.state} state.")
            return False
        runtime_store.set_state(RuntimeState.SPEAKING)
        runtime_events.emit("SPEAKING")
        return True

    def _log_standby_session(self, started_at: float, ended_at: float, duration: float):
        try:
            store = GraphMemoryStore(DATABASE_PATH)
            started_iso = datetime.fromtimestamp(started_at, tz=timezone.utc).isoformat()
            ended_iso = datetime.fromtimestamp(ended_at, tz=timezone.utc).isoformat()
            
            # Ensure world_events anchor node exists
            now_iso = datetime.now(timezone.utc).isoformat()
            with store._lock:
                store.conn.execute(
                    """INSERT OR IGNORE INTO memory_nodes
                       (id, name, description, data, parent_id,
                        access_count, last_accessed, created_at, updated_at,
                        data_token_count)
                       VALUES (?, ?, ?, '', ?, 0, ?, ?, ?, 0)""",
                    (
                        "world_events",
                        "World Events",
                        "History of filesystem and system events.",
                        "world",
                        now_iso,
                        now_iso,
                        now_iso,
                    ),
                )
                store.conn.commit()

            payload = {
                "event_type": "STANDBY_SESSION",
                "duration_seconds": duration,
                "started_at": started_iso,
                "ended_at": ended_iso
            }
            event_data = json.dumps(payload)
            
            store.create_node(
                name=f"event:STANDBY_SESSION:{started_iso.replace(':', '-')}",
                description=f"Standby session: {duration}s idle time",
                data=event_data,
                parent_id="world_events"
            )
            logger.info(f"[MEMORY] Logged standby session: {duration}s")
        except Exception as e:
            logger.error(f"Failed to log standby session to database: {e}")

    def _log_system_event(self, action: str, duration: float = None):
        try:
            store = GraphMemoryStore(DATABASE_PATH)
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # Ensure world_events anchor node exists
            with store._lock:
                store.conn.execute(
                    """INSERT OR IGNORE INTO memory_nodes
                       (id, name, description, data, parent_id,
                        access_count, last_accessed, created_at, updated_at,
                        data_token_count)
                       VALUES (?, ?, ?, '', ?, 0, ?, ?, ?, 0)""",
                    (
                        "world_events",
                        "World Events",
                        "History of filesystem and system events.",
                        "world",
                        now_iso,
                        now_iso,
                        now_iso,
                    ),
                )
                store.conn.commit()

            payload = {
                "event_type": "SYSTEM_EVENT",
                "action": action,
                "timestamp": now_iso
            }
            if duration is not None:
                payload["standby_duration_seconds"] = duration

            event_data = json.dumps(payload)
            
            store.create_node(
                name=f"event:SYSTEM_EVENT:{action}:{now_iso.replace(':', '-')}",
                description=f"System event: {action}" + (f" (duration: {duration}s)" if duration is not None else ""),
                data=event_data,
                parent_id="world_events"
            )
            logger.info(f"[MEMORY] Logged system event: {action}")
        except Exception as e:
            logger.error(f"Failed to log system event to database: {e}")

runtime_service = RuntimeService()

