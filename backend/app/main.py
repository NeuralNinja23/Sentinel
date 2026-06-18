from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from app.api.websocket import router as websocket_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # FIX #11, #16, #20: Use ThreadPoolExecutor instead of ProcessPoolExecutor.
    # This keeps tools inside the main application memory space, which resolves
    # threading.Lock() corruption, global cache desyncs, and PyAutoGUI crashes.
    app.state.tool_executor = ThreadPoolExecutor(max_workers=8)
    yield
    # Shutdown cleanly
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

@app.get("/")
def read_root():
    return {"message": "Sentinel Voice Backend Online"}

