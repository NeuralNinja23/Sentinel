from app.runtime.runtime_state import events
from app.tasks.task_models import TaskEvent

def emit_event(task_id: str, event_type: str, result: str | None = None):
    """Pushes a new unread event into the notification center."""
    event = TaskEvent(
        task_id=task_id,
        type=event_type,
        unread=True,
        result=result
    )
    events.append(event)

def get_unread_events() -> list[TaskEvent]:
    """Returns all unread events and marks them as read."""
    unread = []
    for event in events:
        if event.unread:
            unread.append(event)
            event.unread = False
    return unread
