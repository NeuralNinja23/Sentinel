from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime

class TaskPriority(str, Enum):
    HIGH = "HIGH"
    NORMAL = "NORMAL"
    LOW = "LOW"

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class Task(BaseModel):
    id: str
    type: str
    status: TaskStatus
    priority: TaskPriority
    origin: str
    progress: int = 0
    cancel_requested: bool = False
    depends_on: str | None = None
    payload: dict = Field(default_factory=dict)
    result: str | None = None
    created_at: datetime
    updated_at: datetime
    
class TaskEvent(BaseModel):
    task_id: str
    type: str  # e.g., "TASK_COMPLETED", "TASK_FAILED", "TASK_STARTED"
    unread: bool = True
    result: str | None = None
