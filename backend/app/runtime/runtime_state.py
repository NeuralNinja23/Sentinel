from typing import Dict
from collections import deque
import asyncio
import time
from app.tasks.task_models import Task, TaskEvent

# Single source of truth for all tasks
tasks: Dict[str, Task] = {}

# Notification Center queue (recent events)
events: deque[TaskEvent] = deque(maxlen=1000)

# The queue for the single background worker to pull from (contains task_ids)
task_queue: asyncio.Queue[str] = asyncio.Queue()

class RuntimeState:
    READY = "READY"
    LISTENING = "LISTENING"
    THINKING = "THINKING"
    SPEAKING = "SPEAKING"
    STANDBY = "STANDBY"
    WAKING = "WAKING"

class RuntimeStore:
    def __init__(self):
        self._state = RuntimeState.READY
        self.standby_entered_at = 0.0
        self.last_activity_time = time.time()
        self.standby_locked = False

    @property
    def state(self):
        return self._state

    def set_state(self, new_state: str):
        self._state = new_state

    def update_activity(self, source="user"):
        if source == "user":
            self.last_activity_time = time.time()

runtime_store = RuntimeStore()

class RuntimeEvents:
    def __init__(self):
        self._listeners = {}

    def on(self, event: str, callback):
        if event not in self._listeners:
            self._listeners[event] = []
        self._listeners[event].append(callback)

    def off(self, event: str, callback):
        if event in self._listeners:
            try:
                self._listeners[event].remove(callback)
            except ValueError:
                pass

    def emit(self, event: str, *args, **kwargs):
        if event in self._listeners:
            for cb in list(self._listeners[event]):
                try:
                    cb(*args, **kwargs)
                except Exception:
                    pass

runtime_events = RuntimeEvents()

