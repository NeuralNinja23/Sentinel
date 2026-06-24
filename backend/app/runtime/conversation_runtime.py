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
    
    # Send tool invocation message to frontend
    args_str = ", ".join([f"{k}={json.dumps(v)}" for k, v in tool_args.items()])
    try:
        await websocket.send_json({
            "type": "system",
            "message": f"TOOL_CALL: {tool_name} ({args_str})"
        })
    except Exception as e:
        logger.warning(f"Could not send tool start log to websocket: {e}")
    
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
        
        try:
            await websocket.send_json({
                "type": "system",
                "message": "TOOL_RESULT: check_status -> Checked active background tasks."
            })
        except:
            pass
            
        return json.dumps({
            "active_tasks": active,
            "new_notifications": events_list
        })
        
    elif tool_name == "cancel_task":
        task_id = tool_args.get("task_id")
        if not task_id:
            try:
                await websocket.send_json({
                    "type": "system",
                    "message": "TOOL_ERROR: cancel_task -> task_id is required"
                })
            except:
                pass
            return json.dumps({"error": "task_id is required"})
            
        success = cancel_task(task_id)
        if success:
            try:
                await websocket.send_json({
                    "type": "system",
                    "message": f"TOOL_RESULT: cancel_task -> Task {task_id} cancelled."
                })
            except:
                pass
            return json.dumps({"status": "cancelled", "task_id": task_id})
            
        try:
            await websocket.send_json({
                "type": "system",
                "message": f"TOOL_ERROR: cancel_task -> Task {task_id} not found."
            })
        except:
            pass
        return json.dumps({"error": "Task not found or already completed/cancelled."})
        
    # Standard tools routing
    mode = TOOL_EXECUTION_MODE.get(tool_name)
    if not mode:
        err_msg = f"Tool {tool_name} not recognized in execution registry."
        try:
            await websocket.send_json({
                "type": "system",
                "message": f"TOOL_ERROR: {tool_name} -> {err_msg}"
            })
        except:
            pass
        return json.dumps({"error": err_msg})
        
    if mode == "background":
        task_id = create_task(task_type=tool_name, payload=tool_args)
        try:
            await websocket.send_json({
                "type": "system",
                "message": f"TOOL_RESULT: {tool_name} -> Dispatched background task {task_id}"
            })
        except:
            pass
        return json.dumps({
            "status": "Task dispatched to background.",
            "task_id": task_id,
            "message": "Continue the conversation seamlessly. Use check_status() later if the user asks for an update."
        })
        
    elif mode == "sync":
        func = TOOL_REGISTRY.get(tool_name)
        if not func:
            err_msg = f"Tool {tool_name} not found in actual TOOL_REGISTRY."
            try:
                await websocket.send_json({
                    "type": "system",
                    "message": f"TOOL_ERROR: {tool_name} -> {err_msg}"
                })
            except:
                pass
            return json.dumps({"error": err_msg})
            
        loop = asyncio.get_running_loop()
        executor = websocket.app.state.tool_executor
        pfunc = functools.partial(func, **tool_args)
        try:
            result = await loop.run_in_executor(executor, pfunc)
            
            # Send result log to websocket
            try:
                parsed_res = json.loads(result)
                if isinstance(parsed_res, dict) and "error" in parsed_res:
                    await websocket.send_json({
                        "type": "system",
                        "message": f"TOOL_ERROR: {tool_name} -> {parsed_res['error']}"
                    })
                else:
                    res_summary = str(result)[:100] + ("..." if len(str(result)) > 100 else "")
                    await websocket.send_json({
                        "type": "system",
                        "message": f"TOOL_RESULT: {tool_name} -> {res_summary}"
                    })
            except:
                res_summary = str(result)[:100] + ("..." if len(str(result)) > 100 else "")
                await websocket.send_json({
                    "type": "system",
                    "message": f"TOOL_RESULT: {tool_name} -> {res_summary}"
                })
                
            return result
        except Exception as e:
            try:
                await websocket.send_json({
                    "type": "system",
                    "message": f"TOOL_ERROR: {tool_name} -> {e}"
                })
            except:
                pass
            raise e
