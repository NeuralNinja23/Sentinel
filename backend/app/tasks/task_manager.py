import uuid
from datetime import datetime
import asyncio

from app.runtime.runtime_state import tasks, task_queue
from app.tasks.task_models import Task, TaskStatus, TaskPriority
from app.runtime.task_events import emit_event

def create_task(task_type: str, payload: dict, priority: TaskPriority = TaskPriority.NORMAL) -> str:
    """Creates a task, stores it, and pushes it to the worker queue."""
    task_id = str(uuid.uuid4())
    now = datetime.now()
    
    task = Task(
        id=task_id,
        type=task_type,
        status=TaskStatus.PENDING,
        priority=priority,
        origin="conversation",
        payload=payload,
        created_at=now,
        updated_at=now
    )
    
    tasks[task_id] = task
    
    try:
        loop = asyncio.get_running_loop()
        loop.call_soon_threadsafe(task_queue.put_nowait, task_id)
    except RuntimeError:
        # Fallback if somehow called outside of a running loop (unlikely in this arch)
        asyncio.run(task_queue.put(task_id))
        
    emit_event(task_id, "TASK_STARTED")
    return task_id

def cancel_task(task_id: str) -> bool:
    """Marks a task for cancellation if it is running or pending."""
    if task_id in tasks:
        task = tasks[task_id]
        if task.status in (TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.PAUSED):
            task.cancel_requested = True
            task.status = TaskStatus.CANCELLED
            task.updated_at = datetime.now()
            emit_event(task_id, "TASK_CANCELLED")
            return True
    return False

def pause_all_tasks():
    """Transitions any RUNNING tasks to PAUSED."""
    for task_id, task in tasks.items():
        if task.status == TaskStatus.RUNNING:
            task.status = TaskStatus.PAUSED
            task.updated_at = datetime.now()
            emit_event(task_id, "TASK_PAUSED")

def resume_all_tasks():
    """Transitions any PAUSED tasks back to RUNNING."""
    for task_id, task in tasks.items():
        if task.status == TaskStatus.PAUSED:
            task.status = TaskStatus.RUNNING
            task.updated_at = datetime.now()
            emit_event(task_id, "TASK_RESUMED")

def stop_all_tasks():
    """Cancels all active or pending tasks immediately."""
    for task_id, task in tasks.items():
        if task.status in (TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.PAUSED):
            task.cancel_requested = True
            task.status = TaskStatus.CANCELLED
            task.updated_at = datetime.now()
            emit_event(task_id, "TASK_CANCELLED")
