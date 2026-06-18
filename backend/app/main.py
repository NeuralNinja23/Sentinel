from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
import asyncio

from app.api.websocket import router as websocket_router
from app.api.system_stats import router as system_stats_router
from app.runtime.task_runtime import task_worker_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background task worker loop for long-running tools
    task_loop = asyncio.create_task(task_worker_loop())

    # ThreadPool for synchronous tools
    app.state.tool_executor = ThreadPoolExecutor(max_workers=8)
    yield
    
    # Shutdown cleanly
    task_loop.cancel()
    app.state.tool_executor.shutdown(wait=True)

app = FastAPI(title="Sentinel Voice API", lifespan=lifespan)

# Allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(websocket_router)
app.include_router(system_stats_router)

@app.get("/")
def read_root():
    return {"message": "Sentinel Voice Backend Online"}

