from typing import Dict
from collections import deque
import asyncio
from app.tasks.task_models import Task, TaskEvent

# Single source of truth for all tasks
tasks: Dict[str, Task] = {}

# Notification Center queue (recent events)
events: deque[TaskEvent] = deque(maxlen=1000)

# The queue for the single background worker to pull from (contains task_ids)
task_queue: asyncio.Queue[str] = asyncio.Queue()
