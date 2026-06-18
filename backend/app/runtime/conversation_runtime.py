import json
import functools
import asyncio
from fastapi import WebSocket

from app.services.logger import get_logger
from app.tasks.task_registry import TOOL_REGISTRY, TOOL_EXECUTION_MODE
from app.tasks.task_manager import create_task, cancel_task
from app.runtime.runtime_state import tasks
from app.runtime.task_events import get_unread_events

logger = get_logger("conversation_runtime")

async def handle_tool_call(function_call, websocket: WebSocket) -> str:
    """
    Intercepts tool calls from Gemini.
    - If tool is 'sync', executes it instantly in the standard threadpool.
    - If tool is 'background', dispatches a task to the runtime and returns immediately.
    - Also handles special 'check_status' and 'cancel_task' tools.
    """
    tool_name = function_call.name
    tool_args = function_call.args if function_call.args else {}
    
    logger.info(f"Intercepted tool call: {tool_name} | Mode: {TOOL_EXECUTION_MODE.get(tool_name, 'SPECIAL')}")
    
    if tool_name == "check_status":
        active = []
        for t_id, t in tasks.items():
            if t.status in ("PENDING", "RUNNING"):
                active.append({
                    "id": t.id,
                    "type": t.type,
                    "status": t.status,
                    "progress": t.progress
                })
        
        unread = get_unread_events()
        events_list = [{"task_id": e.task_id, "type": e.type, "result": e.result} for e in unread]
        
        return json.dumps({
            "active_tasks": active,
            "new_notifications": events_list
        })
        
    elif tool_name == "cancel_task":
        task_id = tool_args.get("task_id")
        if not task_id:
            return json.dumps({"error": "task_id is required"})
            
        success = cancel_task(task_id)
        if success:
            return json.dumps({"status": "cancelled", "task_id": task_id})
        return json.dumps({"error": "Task not found or already completed/cancelled."})
        
    # Standard tools routing
    mode = TOOL_EXECUTION_MODE.get(tool_name)
    if not mode:
        return json.dumps({"error": f"Tool {tool_name} not recognized in execution registry."})
        
    if mode == "background":
        task_id = create_task(task_type=tool_name, payload=tool_args)
        return json.dumps({
            "status": "Task dispatched to background.",
            "task_id": task_id,
            "message": "Continue the conversation seamlessly. Use check_status() later if the user asks for an update."
        })
        
    elif mode == "sync":
        func = TOOL_REGISTRY.get(tool_name)
        if not func:
            return json.dumps({"error": f"Tool {tool_name} not found in actual TOOL_REGISTRY."})
            
        loop = asyncio.get_running_loop()
        executor = websocket.app.state.tool_executor
        pfunc = functools.partial(func, **tool_args)
        result = await loop.run_in_executor(executor, pfunc)
        return result
