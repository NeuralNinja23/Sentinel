import asyncio
import functools
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

from app.runtime.runtime_state import tasks, task_queue
from app.tasks.task_models import TaskStatus
from app.tasks.task_registry import TOOL_REGISTRY
from app.runtime.task_events import emit_event
from app.services.logger import get_logger

logger = get_logger("task_runtime")

# We use a thread pool to execute the synchronous tools without blocking the event loop
worker_pool = ThreadPoolExecutor(max_workers=4)

async def task_worker_loop():
    """Continuously waits for tasks from the queue and executes them."""
    logger.info("Task Runtime worker started.")
    
    while True:
        task_id = await task_queue.get()
        
        if task_id not in tasks:
            task_queue.task_done()
            continue
            
        task = tasks[task_id]
        
        # Abort if cancelled before even starting
        if task.cancel_requested:
            task.status = TaskStatus.CANCELLED
            task.updated_at = datetime.now()
            emit_event(task_id, "TASK_CANCELLED")
            task_queue.task_done()
            continue
            
        # Update state to running
        task.status = TaskStatus.RUNNING
        task.progress = 10
        task.updated_at = datetime.now()
        emit_event(task_id, "TASK_PROGRESS")
        
        try:
            logger.info(f"Executing task {task_id} ({task.type})")
            func = TOOL_REGISTRY.get(task.type)
            
            if not func:
                raise ValueError(f"Tool {task.type} not found in registry.")
            
            # Since these are synchronous tools, run in executor
            loop = asyncio.get_running_loop()
            pfunc = functools.partial(func, **task.payload)
            result = await loop.run_in_executor(worker_pool, pfunc)
            
            # Check if it was cancelled during execution (since we can't easily kill thread pool threads)
            if task.cancel_requested:
                task.status = TaskStatus.CANCELLED
                task.progress = 0
                emit_event(task_id, "TASK_CANCELLED")
            else:
                task.result = result
                task.status = TaskStatus.COMPLETED
                task.progress = 100
                emit_event(task_id, "TASK_COMPLETED", result)
                
        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}")
            task.status = TaskStatus.FAILED
            task.result = str(e)
            emit_event(task_id, "TASK_FAILED", str(e))
            
        finally:
            task.updated_at = datetime.now()
            task_queue.task_done()
